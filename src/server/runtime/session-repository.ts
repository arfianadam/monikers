import type { CommandAcknowledgement } from '@/features/game/session-protocol/types';
import {
  createPendingSession,
  type SessionState,
} from '@/server/session/session-state';

import {
  createCredentialToken,
  createJoinCode,
  createSessionId,
  normalizeJoinCode,
} from './session-identifiers';

export const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1_000;
export const SESSION_IDLE_TTL_MS = 24 * 60 * 60 * 1_000;
const COMMAND_CACHE_TTL_MS = 10 * 60 * 1_000;
const COMMAND_CACHE_LIMIT = 256;

function commandCacheKey(actorId: string, commandId: string) {
  return `${actorId.length}:${actorId}:${commandId}`;
}

export interface SessionCredential {
  actorId: string;
  token: string;
}

interface CachedCommandResult {
  actorId: string;
  acknowledgement: CommandAcknowledgement;
  createdAt: number;
}

export interface SessionRecord {
  state: SessionState;
  credentials: Map<string, SessionCredential>;
  connectedActorIds: Set<string>;
  lastConnectionClosedAt: number;
  recentCommands: Map<string, CachedCommandResult>;
  queue: Promise<void>;
}

export interface CreatedSession {
  record: SessionRecord;
  credential: SessionCredential;
}

export interface SessionRepositoryOptions {
  now?: () => number;
  sessionId?: () => string;
  credentialToken?: () => string;
}

export class InMemorySessionRepository {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly sessionsByJoinCode = new Map<string, string>();
  private readonly now: () => number;
  private readonly sessionId: () => string;
  private readonly credentialToken: () => string;

  constructor(options: SessionRepositoryOptions = {}) {
    this.now = options.now ?? Date.now;
    this.sessionId = options.sessionId ?? createSessionId;
    this.credentialToken = options.credentialToken ?? createCredentialToken;
  }

  create(mode: SessionState['mode']): CreatedSession {
    let sessionId = this.sessionId();
    while (this.sessions.has(sessionId)) sessionId = this.sessionId();

    const controllerId = this.credentialToken();
    const token = this.credentialToken();
    const now = this.now();
    const credential: SessionCredential = {
      actorId: controllerId,
      token,
    };
    const record: SessionRecord = {
      state: createPendingSession({
        sessionId,
        mode,
        controllerId,
        now,
      }),
      credentials: new Map([[token, credential]]),
      connectedActorIds: new Set(),
      lastConnectionClosedAt: now,
      recentCommands: new Map(),
      queue: Promise.resolve(),
    };

    this.sessions.set(sessionId, record);
    return { record, credential };
  }

  get(sessionId: string): SessionRecord | null {
    return this.sessions.get(sessionId) ?? null;
  }

  findByJoinCode(joinCode: string): SessionRecord | null {
    const sessionId = this.sessionsByJoinCode.get(normalizeJoinCode(joinCode));
    return sessionId ? this.get(sessionId) : null;
  }

  authenticate(
    sessionId: string,
    token: string | null
  ): { record: SessionRecord; credential: SessionCredential } | null {
    if (!token) return null;
    const record = this.get(sessionId);
    const credential = record?.credentials.get(token);
    if (!record || !credential) return null;
    return { record, credential };
  }

  issueCredential(record: SessionRecord, actorId = this.credentialToken()) {
    const token = this.credentialToken();
    const credential: SessionCredential = {
      actorId,
      token,
    };
    record.credentials.set(token, credential);
    return credential;
  }

  revokeCredential(record: SessionRecord, token: string) {
    return record.credentials.delete(token);
  }

  revokeActor(record: SessionRecord, actorId: string) {
    let revoked = false;
    for (const [token, credential] of record.credentials) {
      if (credential.actorId === actorId) {
        record.credentials.delete(token);
        revoked = true;
      }
    }
    return revoked;
  }

  allocateJoinCode(): string {
    return createJoinCode((code) => !this.sessionsByJoinCode.has(code));
  }

  replaceState(record: SessionRecord, state: SessionState) {
    const previousCode =
      record.state.mode === 'own-device' ? record.state.joinCode : '';
    const nextCode = state.mode === 'own-device' ? state.joinCode : '';

    if (previousCode && previousCode !== nextCode) {
      this.sessionsByJoinCode.delete(normalizeJoinCode(previousCode));
    }
    if (nextCode) {
      const normalized = normalizeJoinCode(nextCode);
      const indexedSession = this.sessionsByJoinCode.get(normalized);
      if (indexedSession && indexedSession !== state.sessionId) {
        throw new Error('Join code is already assigned to another session');
      }
      this.sessionsByJoinCode.set(normalized, state.sessionId);
    }

    record.state = state;
  }

  markConnected(record: SessionRecord, actorId: string) {
    record.connectedActorIds.add(actorId);
  }

  markDisconnected(record: SessionRecord, actorId: string) {
    record.connectedActorIds.delete(actorId);
    if (record.connectedActorIds.size === 0) {
      record.lastConnectionClosedAt = this.now();
    }
  }

  getCachedCommand(
    record: SessionRecord,
    actorId: string,
    commandId: string
  ): CommandAcknowledgement | null {
    const key = commandCacheKey(actorId, commandId);
    const cached = record.recentCommands.get(key);
    if (!cached) return null;
    if (this.now() - cached.createdAt > COMMAND_CACHE_TTL_MS) {
      record.recentCommands.delete(key);
      return null;
    }
    return cached.acknowledgement;
  }

  cacheCommand(
    record: SessionRecord,
    actorId: string,
    acknowledgement: CommandAcknowledgement
  ) {
    record.recentCommands.set(
      commandCacheKey(actorId, acknowledgement.commandId),
      {
        actorId,
        acknowledgement,
        createdAt: this.now(),
      }
    );

    while (record.recentCommands.size > COMMAND_CACHE_LIMIT) {
      const oldestKey = record.recentCommands.keys().next().value as
        string | undefined;
      if (!oldestKey) break;
      record.recentCommands.delete(oldestKey);
    }
  }

  enqueue<T>(
    record: SessionRecord,
    operation: () => Promise<T> | T
  ): Promise<T> {
    const result = record.queue.then(operation, operation);
    record.queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  delete(sessionId: string): boolean {
    const record = this.sessions.get(sessionId);
    if (!record) return false;
    if (record.state.mode === 'own-device' && record.state.joinCode) {
      this.sessionsByJoinCode.delete(normalizeJoinCode(record.state.joinCode));
    }
    record.credentials.clear();
    record.recentCommands.clear();
    return this.sessions.delete(sessionId);
  }

  cleanupExpired() {
    const cutoff = this.now() - SESSION_IDLE_TTL_MS;
    const deletedSessionIds: string[] = [];

    for (const [sessionId, record] of this.sessions) {
      if (
        record.connectedActorIds.size === 0 &&
        record.lastConnectionClosedAt <= cutoff
      ) {
        this.delete(sessionId);
        deletedSessionIds.push(sessionId);
      }
    }

    return deletedSessionIds;
  }

  get size() {
    return this.sessions.size;
  }
}
