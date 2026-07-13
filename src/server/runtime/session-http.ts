import type { IncomingMessage, ServerResponse } from 'node:http';

import { z } from 'zod';

import { sessionModeSchema } from '@/features/game/session-protocol/schemas';
import type { ServerEvent } from '@/features/game/session-protocol/types';
import {
  activateOwnDeviceSession,
  addOwnDeviceParticipant,
  type OwnDeviceSessionState,
} from '@/server/session/session-state';

import {
  clearedSessionCookie,
  getClientAddress,
  getSessionCredential,
  isSameOriginRequest,
  readJsonBody,
  requestIsSecure,
  sendError,
  sendJson,
  sessionCookie,
} from './http-utils';
import { SlidingWindowRateLimiter } from './rate-limiter';
import { normalizeJoinCode } from './session-identifiers';
import {
  InMemorySessionRepository,
  type SessionRecord,
} from './session-repository';

const createSessionBodySchema = z.object({ mode: sessionModeSchema });
const displayNameBodySchema = z.object({
  name: z.string().max(256),
});

const CREATION_RATE_LIMIT = { limit: 30, windowMs: 10 * 60 * 1_000 };
const FAILED_CODE_RATE_LIMIT = { limit: 20, windowMs: 5 * 60 * 1_000 };

export interface LeaveResult {
  error?: { code: string; message: string };
  deleted?: boolean;
  events?: ServerEvent[];
  revokedActorIds?: string[];
}

export interface StateChangeDetails {
  events?: ServerEvent[];
  revokedActorIds?: string[];
  forceProjection?: boolean;
}

export interface SessionHttpControllerOptions {
  rateLimitsEnabled?: boolean;
  repository: InMemorySessionRepository;
  now?: () => number;
  onStateChanged?: (
    record: SessionRecord,
    details?: StateChangeDetails
  ) => void;
  onLeave: (record: SessionRecord, actorId: string, now: number) => LeaveResult;
  onDeleted?: (sessionId: string, reason: 'left' | 'ended' | 'expired') => void;
}

function activeParticipants(state: OwnDeviceSessionState) {
  return Object.values(state.participants).filter(
    (participant) => participant.departureStatus === 'active'
  );
}

function controllerName(state: OwnDeviceSessionState) {
  return state.participants[state.controllerId]?.displayName ?? 'Pembuat sesi';
}

function parseJoinCode(rawCode: string): string | null {
  try {
    return normalizeJoinCode(decodeURIComponent(rawCode));
  } catch {
    return null;
  }
}

export class SessionHttpController {
  private readonly repository: InMemorySessionRepository;
  private readonly now: () => number;
  private readonly onStateChanged: NonNullable<
    SessionHttpControllerOptions['onStateChanged']
  >;
  private readonly onLeave: SessionHttpControllerOptions['onLeave'];
  private readonly onDeleted: NonNullable<
    SessionHttpControllerOptions['onDeleted']
  >;
  private readonly rateLimitsEnabled: boolean;
  private readonly creationLimiter: SlidingWindowRateLimiter;
  private readonly failedCodeLimiter: SlidingWindowRateLimiter;

  constructor(options: SessionHttpControllerOptions) {
    this.repository = options.repository;
    this.now = options.now ?? Date.now;
    this.onStateChanged = options.onStateChanged ?? (() => undefined);
    this.onLeave = options.onLeave;
    this.onDeleted = options.onDeleted ?? (() => undefined);
    this.rateLimitsEnabled = options.rateLimitsEnabled ?? false;
    this.creationLimiter = new SlidingWindowRateLimiter(this.now);
    this.failedCodeLimiter = new SlidingWindowRateLimiter(this.now);
  }

  async handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    const pathname = url.pathname;

    if (request.method === 'POST' && pathname === '/api/sessions') {
      await this.createSession(request, response);
      return true;
    }

    const activationMatch = pathname.match(
      /^\/session\/([A-Za-z0-9_-]+)\/actions\/activate$/
    );
    if (request.method === 'POST' && activationMatch) {
      await this.activateSession(request, response, activationMatch[1]);
      return true;
    }

    const leaveMatch = pathname.match(
      /^\/session\/([A-Za-z0-9_-]+)\/actions\/leave$/
    );
    if (request.method === 'POST' && leaveMatch) {
      await this.leaveSession(request, response, leaveMatch[1]);
      return true;
    }

    const endMatch = pathname.match(
      /^\/session\/([A-Za-z0-9_-]+)\/actions\/end$/
    );
    if (request.method === 'POST' && endMatch) {
      await this.endSession(request, response, endMatch[1]);
      return true;
    }

    const joinMatch = pathname.match(/^\/api\/join\/([^/]+)$/);
    if (joinMatch && request.method === 'GET') {
      this.previewJoin(request, response, joinMatch[1]);
      return true;
    }
    if (joinMatch && request.method === 'POST') {
      await this.joinSession(request, response, joinMatch[1]);
      return true;
    }

    return false;
  }

  private requireSameOrigin(
    request: IncomingMessage,
    response: ServerResponse
  ) {
    if (isSameOriginRequest(request)) return true;
    sendError(response, 403, 'ORIGIN_REJECTED', 'Permintaan tidak diizinkan.');
    return false;
  }

  private async createSession(
    request: IncomingMessage,
    response: ServerResponse
  ) {
    if (!this.requireSameOrigin(request, response)) return;
    if (this.rateLimitsEnabled) {
      const rate = this.creationLimiter.consume(
        getClientAddress(request),
        CREATION_RATE_LIMIT
      );
      if (!rate.allowed) {
        sendError(
          response,
          429,
          'RATE_LIMITED',
          'Terlalu banyak sesi dibuat. Coba lagi sebentar.',
          { 'retry-after': String(Math.ceil(rate.retryAfterMs / 1_000)) }
        );
        return;
      }
    }

    try {
      const parsed = createSessionBodySchema.safeParse(
        await readJsonBody(request)
      );
      if (!parsed.success) {
        sendError(
          response,
          400,
          'INVALID_REQUEST',
          'Pilihan cara main tidak sah.'
        );
        return;
      }

      const { record, credential } = this.repository.create(parsed.data.mode);
      const { sessionId } = record.state;
      sendJson(
        response,
        201,
        { sessionId, route: `/session/${sessionId}`, mode: parsed.data.mode },
        {
          'set-cookie': sessionCookie(
            sessionId,
            credential.token,
            requestIsSecure(request)
          ),
        }
      );
    } catch {
      sendError(
        response,
        400,
        'INVALID_REQUEST',
        'Permintaan tidak dapat dibaca.'
      );
    }
  }

  private async activateSession(
    request: IncomingMessage,
    response: ServerResponse,
    sessionId: string
  ) {
    if (!this.requireSameOrigin(request, response)) return;
    const token = getSessionCredential(request);
    const authenticated = this.repository.authenticate(sessionId, token);
    if (!authenticated) {
      sendError(
        response,
        401,
        'CREDENTIAL_REVOKED',
        'Akses sesi tidak berlaku.'
      );
      return;
    }
    if (authenticated.record.state.mode !== 'own-device') {
      sendError(
        response,
        409,
        'INVALID_MODE',
        'Sesi ini tidak perlu diaktifkan.'
      );
      return;
    }

    try {
      const body = displayNameBodySchema.safeParse(await readJsonBody(request));
      if (!body.success) {
        sendError(response, 400, 'INVALID_NAME', 'Nama belum valid.');
        return;
      }

      await this.repository.enqueue(authenticated.record, () => {
        if (
          this.repository.get(sessionId) !== authenticated.record ||
          !this.repository.authenticate(sessionId, token)
        ) {
          sendError(
            response,
            401,
            'CREDENTIAL_REVOKED',
            'Akses sesi tidak berlaku.'
          );
          return;
        }
        const state = authenticated.record.state;
        if (state.mode !== 'own-device') return;
        const result = activateOwnDeviceSession(state, {
          participantId: authenticated.credential.actorId,
          displayName: body.data.name,
          joinCode: this.repository.allocateJoinCode(),
          now: this.now(),
        });
        if (result.error) {
          sendError(response, 409, result.error.code, result.error.message);
          return;
        }
        this.repository.replaceState(authenticated.record, result.state);
        this.onStateChanged(authenticated.record);
        sendJson(response, 200, {
          route: `/session/${sessionId}`,
          joinCode: result.state.joinCode,
        });
      });
    } catch {
      if (!response.headersSent) {
        sendError(
          response,
          400,
          'INVALID_REQUEST',
          'Permintaan tidak dapat dibaca.'
        );
      }
    }
  }

  private previewJoin(
    request: IncomingMessage,
    response: ServerResponse,
    rawCode: string
  ) {
    const code = parseJoinCode(rawCode);
    if (!code) {
      this.rejectUnknownCode(request, response);
      return;
    }
    const record = this.repository.findByJoinCode(code);
    if (!record || record.state.mode !== 'own-device') {
      this.rejectUnknownCode(request, response);
      return;
    }

    const state = record.state;
    if (state.phase !== 'lobby') {
      sendError(
        response,
        409,
        'ROOM_STARTED',
        'Permainan di sesi ini sudah dimulai.'
      );
      return;
    }
    const players = activeParticipants(state);
    if (players.length >= 20) {
      sendError(response, 409, 'ROOM_FULL', 'Sesi ini sudah penuh.');
      return;
    }

    sendJson(response, 200, {
      code: state.joinCode,
      controllerName: controllerName(state),
      playerCount: players.length,
    });
  }

  private async joinSession(
    request: IncomingMessage,
    response: ServerResponse,
    rawCode: string
  ) {
    if (!this.requireSameOrigin(request, response)) return;
    const code = parseJoinCode(rawCode);
    if (!code) {
      this.rejectUnknownCode(request, response);
      return;
    }
    const record = this.repository.findByJoinCode(code);
    if (!record || record.state.mode !== 'own-device') {
      this.rejectUnknownCode(request, response);
      return;
    }
    if (record.state.phase !== 'lobby') {
      sendError(
        response,
        409,
        'ROOM_STARTED',
        'Permainan di sesi ini sudah dimulai.'
      );
      return;
    }
    if (activeParticipants(record.state).length >= 20) {
      sendError(response, 409, 'ROOM_FULL', 'Sesi ini sudah penuh.');
      return;
    }

    try {
      const body = displayNameBodySchema.safeParse(await readJsonBody(request));
      if (!body.success) {
        sendError(response, 400, 'INVALID_NAME', 'Nama belum valid.');
        return;
      }

      await this.repository.enqueue(record, () => {
        const liveRecord = this.repository.findByJoinCode(code);
        if (
          liveRecord !== record ||
          this.repository.get(record.state.sessionId) !== record
        ) {
          this.rejectUnknownCode(request, response);
          return;
        }
        const state = record.state;
        if (state.mode !== 'own-device') return;
        if (state.phase !== 'lobby') {
          sendError(
            response,
            409,
            'ROOM_STARTED',
            'Permainan di sesi ini sudah dimulai.'
          );
          return;
        }
        if (activeParticipants(state).length >= 20) {
          sendError(response, 409, 'ROOM_FULL', 'Sesi ini sudah penuh.');
          return;
        }
        const credential = this.repository.issueCredential(record);
        const result = addOwnDeviceParticipant(state, {
          participantId: credential.actorId,
          displayName: body.data.name,
          now: this.now(),
        });
        if (result.error) {
          record.credentials.delete(credential.token);
          const status = result.error.code === 'NAME_TAKEN' ? 409 : 400;
          sendError(response, status, result.error.code, result.error.message);
          return;
        }

        this.repository.replaceState(record, result.state);
        this.onStateChanged(record);
        sendJson(
          response,
          201,
          { sessionId: state.sessionId, route: `/session/${state.sessionId}` },
          {
            'set-cookie': sessionCookie(
              state.sessionId,
              credential.token,
              requestIsSecure(request)
            ),
          }
        );
      });
    } catch {
      if (!response.headersSent) {
        sendError(
          response,
          400,
          'INVALID_REQUEST',
          'Permintaan tidak dapat dibaca.'
        );
      }
    }
  }

  private async leaveSession(
    request: IncomingMessage,
    response: ServerResponse,
    sessionId: string
  ) {
    if (!this.requireSameOrigin(request, response)) return;
    const token = getSessionCredential(request);
    const authenticated = this.repository.authenticate(sessionId, token);
    if (!authenticated || !token) {
      sendError(
        response,
        401,
        'CREDENTIAL_REVOKED',
        'Akses sesi tidak berlaku.'
      );
      return;
    }

    await this.repository.enqueue(authenticated.record, () => {
      const currentAuthentication = this.repository.authenticate(
        sessionId,
        token
      );
      if (
        this.repository.get(sessionId) !== authenticated.record ||
        currentAuthentication?.credential.actorId !==
          authenticated.credential.actorId
      ) {
        sendError(
          response,
          401,
          'CREDENTIAL_REVOKED',
          'Akses sesi tidak berlaku.'
        );
        return;
      }
      const result = this.onLeave(
        authenticated.record,
        authenticated.credential.actorId,
        this.now()
      );
      if (result.error) {
        sendError(response, 409, result.error.code, result.error.message);
        return;
      }
      this.repository.revokeCredential(authenticated.record, token);
      if (result.deleted) {
        this.repository.delete(sessionId);
        this.onDeleted(sessionId, 'left');
      } else {
        this.onStateChanged(authenticated.record, {
          events: result.events,
          revokedActorIds: result.revokedActorIds,
        });
      }
      sendJson(
        response,
        200,
        { route: '/' },
        {
          'set-cookie': clearedSessionCookie(
            sessionId,
            requestIsSecure(request)
          ),
        }
      );
    });
  }

  private async endSession(
    request: IncomingMessage,
    response: ServerResponse,
    sessionId: string
  ) {
    if (!this.requireSameOrigin(request, response)) return;
    const token = getSessionCredential(request);
    const authenticated = this.repository.authenticate(sessionId, token);
    if (!authenticated) {
      sendError(
        response,
        401,
        'CREDENTIAL_REVOKED',
        'Akses sesi tidak berlaku.'
      );
      return;
    }
    if (
      authenticated.credential.actorId !==
      authenticated.record.state.controllerId
    ) {
      sendError(
        response,
        403,
        'NOT_AUTHORIZED',
        'Hanya pengendali yang dapat mengakhiri sesi.'
      );
      return;
    }

    await this.repository.enqueue(authenticated.record, () => {
      const currentAuthentication = this.repository.authenticate(
        sessionId,
        token
      );
      if (
        this.repository.get(sessionId) !== authenticated.record ||
        currentAuthentication?.credential.actorId !==
          authenticated.credential.actorId
      ) {
        sendError(
          response,
          401,
          'CREDENTIAL_REVOKED',
          'Akses sesi tidak berlaku.'
        );
        return;
      }
      if (
        authenticated.credential.actorId !==
        authenticated.record.state.controllerId
      ) {
        sendError(
          response,
          403,
          'NOT_AUTHORIZED',
          'Hanya pengendali yang dapat mengakhiri sesi.'
        );
        return;
      }
      this.repository.delete(sessionId);
      this.onDeleted(sessionId, 'ended');
      sendJson(
        response,
        200,
        { route: '/' },
        {
          'set-cookie': clearedSessionCookie(
            sessionId,
            requestIsSecure(request)
          ),
        }
      );
    });
  }

  private rejectUnknownCode(
    request: IncomingMessage,
    response: ServerResponse
  ) {
    if (this.rateLimitsEnabled) {
      const result = this.failedCodeLimiter.consume(
        getClientAddress(request),
        FAILED_CODE_RATE_LIMIT
      );
      if (!result.allowed) {
        sendError(
          response,
          429,
          'RATE_LIMITED',
          'Terlalu banyak kode yang gagal. Coba lagi sebentar.',
          { 'retry-after': String(Math.ceil(result.retryAfterMs / 1_000)) }
        );
        return;
      }
    }
    sendError(
      response,
      404,
      'CODE_NOT_FOUND',
      'Kode sesi tidak ditemukan atau sudah kedaluwarsa.'
    );
  }

  pruneRateLimits() {
    if (!this.rateLimitsEnabled) return;
    this.creationLimiter.prune();
    this.failedCodeLimiter.prune();
  }
}
