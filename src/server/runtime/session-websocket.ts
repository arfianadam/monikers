import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';

import { WebSocket, WebSocketServer, type RawData } from 'ws';

import { sessionCommandSchema } from '@/features/game/session-protocol/schemas';
import type {
  CommandAcknowledgement,
  ServerEvent,
  ServerMessage,
  SessionCommand,
} from '@/features/game/session-protocol/types';

import { getSessionCredential, isSameOriginRequest } from './http-utils';
import { SlidingWindowRateLimiter } from './rate-limiter';
import type { SessionRecord } from './session-repository';
import {
  SessionRuntime,
  type SessionRuntimeDeletion,
  type SessionRuntimeUpdate,
} from './session-runtime';

export const SESSION_LIVE_PATH = /^\/session\/([A-Za-z0-9_-]+)\/live$/;
export const SESSION_WEBSOCKET_MAX_PAYLOAD_BYTES = 8_192;
export const SESSION_HEARTBEAT_INTERVAL_MS = 30_000;
export const SESSION_COMMAND_RATE_LIMIT = {
  limit: 30,
  windowMs: 10_000,
} as const;

export const SESSION_SOCKET_CLOSE = {
  duplicate: 4009,
  revoked: 4001,
  ended: 4010,
  expired: 4004,
  shutdown: 1001,
} as const;

interface LiveConnection {
  actorId: string;
  record: SessionRecord;
  socket: WebSocket;
  alive: boolean;
  connected: Promise<boolean>;
  limiter: SlidingWindowRateLimiter;
}

export interface SessionWebSocketGatewayOptions {
  runtime: SessionRuntime;
  heartbeatIntervalMs?: number;
  setInterval?: typeof globalThis.setInterval;
  clearInterval?: typeof globalThis.clearInterval;
}

function sendUpgradeError(socket: Duplex, status: number, message: string) {
  if (!socket.writable) {
    socket.destroy();
    return;
  }
  const body = `${message}\n`;
  socket.end(
    `HTTP/1.1 ${status} ${message}\r\n` +
      'Connection: close\r\n' +
      'Content-Type: text/plain; charset=utf-8\r\n' +
      `Content-Length: ${Buffer.byteLength(body)}\r\n` +
      '\r\n' +
      body
  );
}

function invalidCommandAcknowledgement(
  record: SessionRecord,
  commandId = 'invalid'
): CommandAcknowledgement {
  return {
    type: 'command-ack',
    commandId,
    ok: false,
    revision: record.state.revision,
    error: {
      code: 'INVALID_COMMAND',
      message: 'Aksi tidak dapat dibaca.',
    },
  };
}

function commandIdFromUnknown(value: unknown): string {
  if (!value || typeof value !== 'object' || !('id' in value)) return 'invalid';
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 && id.length <= 128
    ? id
    : 'invalid';
}

export class SessionWebSocketGateway {
  private readonly runtime: SessionRuntime;
  private readonly server = new WebSocketServer({
    noServer: true,
    maxPayload: SESSION_WEBSOCKET_MAX_PAYLOAD_BYTES,
    perMessageDeflate: false,
  });
  private readonly connections = new Map<string, Map<string, LiveConnection>>();
  private readonly clearIntervalFn: typeof globalThis.clearInterval;
  private readonly heartbeatHandle: ReturnType<typeof globalThis.setInterval>;
  private readonly unsubscribeUpdate: () => boolean;
  private readonly unsubscribeDeletion: () => boolean;
  private attachedServer: HttpServer | null = null;
  private closing = false;

  constructor(options: SessionWebSocketGatewayOptions) {
    this.runtime = options.runtime;
    this.clearIntervalFn = options.clearInterval ?? globalThis.clearInterval;
    const setIntervalFn = options.setInterval ?? globalThis.setInterval;
    this.heartbeatHandle = setIntervalFn(
      () => this.runHeartbeat(),
      options.heartbeatIntervalMs ?? SESSION_HEARTBEAT_INTERVAL_MS
    );
    this.heartbeatHandle.unref?.();
    this.unsubscribeUpdate = this.runtime.onUpdate((update) =>
      this.deliverUpdate(update)
    );
    this.unsubscribeDeletion = this.runtime.onDeletion((deletion) =>
      this.deliverDeletion(deletion)
    );
  }

  attach(httpServer: HttpServer) {
    if (this.attachedServer) {
      throw new Error('Session WebSocket gateway is already attached');
    }
    this.attachedServer = httpServer;
    httpServer.prependListener('upgrade', this.handleUpgrade);
  }

  readonly handleUpgrade = (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ) => {
    if (this.closing) return;
    const host = request.headers.host ?? 'localhost';
    let pathname: string;
    try {
      pathname = new URL(request.url ?? '/', `http://${host}`).pathname;
    } catch {
      return;
    }
    const match = SESSION_LIVE_PATH.exec(pathname);
    if (!match) return;

    if (!isSameOriginRequest(request)) {
      sendUpgradeError(socket, 403, 'Forbidden');
      return;
    }

    const sessionId = match[1];
    const record = this.runtime.repository.get(sessionId);
    if (!record) {
      this.acceptTerminalConnection(
        request,
        socket,
        head,
        SESSION_SOCKET_CLOSE.expired,
        'Session expired'
      );
      return;
    }
    const authenticated = this.runtime.repository.authenticate(
      sessionId,
      getSessionCredential(request)
    );
    if (!authenticated) {
      this.acceptTerminalConnection(
        request,
        socket,
        head,
        SESSION_SOCKET_CLOSE.revoked,
        'Membership revoked'
      );
      return;
    }

    try {
      this.server.handleUpgrade(request, socket, head, (webSocket) => {
        this.acceptConnection(
          webSocket,
          authenticated.record,
          authenticated.credential.actorId
        );
      });
    } catch {
      socket.destroy();
    }
  };

  private acceptTerminalConnection(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    closeCode: number,
    reason: string
  ) {
    try {
      this.server.handleUpgrade(request, socket, head, (webSocket) => {
        webSocket.close(closeCode, reason);
      });
    } catch {
      socket.destroy();
    }
  }

  async close() {
    if (this.closing) return;
    this.closing = true;
    this.clearIntervalFn(this.heartbeatHandle);
    this.unsubscribeUpdate();
    this.unsubscribeDeletion();
    if (this.attachedServer) {
      this.attachedServer.removeListener('upgrade', this.handleUpgrade);
      this.attachedServer = null;
    }

    for (const sessionConnections of this.connections.values()) {
      for (const connection of sessionConnections.values()) {
        connection.socket.close(
          SESSION_SOCKET_CLOSE.shutdown,
          'Server shutdown'
        );
      }
    }

    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
      if (this.server.clients.size === 0) resolve();
    });
    this.connections.clear();
  }

  private acceptConnection(
    socket: WebSocket,
    record: SessionRecord,
    actorId: string
  ) {
    const sessionId = record.state.sessionId;
    let sessionConnections = this.connections.get(sessionId);
    if (!sessionConnections) {
      sessionConnections = new Map();
      this.connections.set(sessionId, sessionConnections);
    }

    const oldConnection = sessionConnections.get(actorId);
    const connection: LiveConnection = {
      actorId,
      record,
      socket,
      alive: true,
      connected: Promise.resolve(false),
      limiter: new SlidingWindowRateLimiter(() => this.runtime.serverTime),
    };
    sessionConnections.set(actorId, connection);

    socket.on('pong', () => {
      connection.alive = true;
    });
    socket.on('message', (data, isBinary) => {
      void this.handleMessage(connection, data, isBinary);
    });
    socket.once('close', () => {
      void this.handleClose(connection);
    });
    socket.once('error', () => {
      // The close event owns presence cleanup.
    });

    connection.connected = this.runtime
      .connect(record, actorId)
      .then((result) => {
        if (result) return true;
        if (this.isCurrent(connection)) {
          const sessionStillExists = Boolean(
            this.runtime.repository.get(record.state.sessionId)
          );
          socket.close(
            sessionStillExists
              ? SESSION_SOCKET_CLOSE.revoked
              : SESSION_SOCKET_CLOSE.expired,
            sessionStillExists ? 'Membership revoked' : 'Session expired'
          );
        }
        return false;
      });

    if (oldConnection && oldConnection.socket.readyState < WebSocket.CLOSING) {
      oldConnection.socket.close(
        SESSION_SOCKET_CLOSE.duplicate,
        'Duplicate connection'
      );
    }
  }

  private async handleMessage(
    connection: LiveConnection,
    data: RawData,
    isBinary: boolean
  ) {
    if (isBinary) {
      connection.socket.close(1003, 'Text messages only');
      return;
    }
    if (!(await connection.connected) || !this.isCurrent(connection)) return;

    const rate = connection.limiter.consume(
      'commands',
      SESSION_COMMAND_RATE_LIMIT
    );
    let raw: unknown;
    try {
      raw = JSON.parse(data.toString()) as unknown;
    } catch {
      await this.rejectInvalidMessage(connection, 'invalid', rate.allowed);
      return;
    }

    const parsed = sessionCommandSchema.safeParse(raw);
    if (!parsed.success) {
      await this.rejectInvalidMessage(
        connection,
        commandIdFromUnknown(raw),
        rate.allowed
      );
      return;
    }

    const outcome = rate.allowed
      ? await this.runtime.executeCommand(
          connection.record,
          connection.actorId,
          parsed.data as SessionCommand
        )
      : await this.runtime.rejectRateLimitedCommand(
          connection.record,
          connection.actorId,
          parsed.data.id
        );
    if (!outcome) return;

    if (this.isCurrent(connection)) {
      this.send(connection.socket, outcome.acknowledgement);
    }
    this.runtime.publishCommandOutcome(outcome);
  }

  private async rejectInvalidMessage(
    connection: LiveConnection,
    commandId: string,
    rateAllowed: boolean
  ) {
    if (rateAllowed) {
      this.send(
        connection.socket,
        invalidCommandAcknowledgement(connection.record, commandId)
      );
      return;
    }
    const outcome = await this.runtime.rejectRateLimitedCommand(
      connection.record,
      connection.actorId,
      commandId
    );
    if (!outcome) return;
    if (this.isCurrent(connection)) {
      this.send(connection.socket, outcome.acknowledgement);
    }
    this.runtime.publishCommandOutcome(outcome);
  }

  private async handleClose(connection: LiveConnection) {
    if (!this.isCurrent(connection)) return;
    const sessionConnections = this.connections.get(
      connection.record.state.sessionId
    );
    sessionConnections?.delete(connection.actorId);
    if (sessionConnections?.size === 0) {
      this.connections.delete(connection.record.state.sessionId);
    }
    await connection.connected;
    await this.runtime.disconnect(connection.record, connection.actorId);
  }

  private deliverUpdate(update: SessionRuntimeUpdate) {
    for (const actorId of update.revokedActorIds) {
      this.closeActor(update.record.state.sessionId, actorId);
    }

    if (update.forceProjection) {
      this.broadcastProjections(update.record);
    }
    for (const event of update.events)
      this.broadcastEvent(update.record, event);
  }

  private deliverDeletion(deletion: SessionRuntimeDeletion) {
    const sessionConnections = this.connections.get(deletion.sessionId);
    if (!sessionConnections) return;
    if (deletion.announce) {
      const message: ServerMessage = {
        type: 'event',
        event: { type: 'session-ended' },
      };
      for (const connection of sessionConnections.values()) {
        this.send(connection.socket, message);
      }
    }

    const closeCode =
      deletion.reason === 'expired'
        ? SESSION_SOCKET_CLOSE.expired
        : SESSION_SOCKET_CLOSE.ended;
    for (const connection of [...sessionConnections.values()]) {
      connection.socket.close(closeCode, deletion.reason);
    }
  }

  private broadcastProjections(record: SessionRecord) {
    const sessionConnections = this.connections.get(record.state.sessionId);
    if (!sessionConnections) return;
    const serverTime = this.runtime.serverTime;
    for (const connection of sessionConnections.values()) {
      this.send(connection.socket, {
        type: 'projection',
        projection: this.runtime.project(
          record,
          connection.actorId,
          serverTime
        ),
      });
    }
  }

  private broadcastEvent(record: SessionRecord, event: ServerEvent) {
    if (event.type === 'code-rotation-requested') return;
    const sessionConnections = this.connections.get(record.state.sessionId);
    if (!sessionConnections) return;
    const message: ServerMessage = { type: 'event', event };

    if (event.type === 'sound') {
      const recipient = sessionConnections.get(event.recipientId);
      if (recipient) this.send(recipient.socket, message);
      return;
    }
    for (const connection of sessionConnections.values()) {
      this.send(connection.socket, message);
    }
  }

  private closeActor(sessionId: string, actorId: string) {
    const connection = this.connections.get(sessionId)?.get(actorId);
    if (!connection) return;
    connection.socket.close(SESSION_SOCKET_CLOSE.revoked, 'Membership revoked');
  }

  private runHeartbeat() {
    for (const sessionConnections of this.connections.values()) {
      for (const connection of sessionConnections.values()) {
        if (connection.socket.readyState !== WebSocket.OPEN) continue;
        if (!connection.alive) {
          connection.socket.terminate();
          continue;
        }
        connection.alive = false;
        connection.socket.ping();
      }
    }
  }

  private isCurrent(connection: LiveConnection) {
    return (
      this.connections
        .get(connection.record.state.sessionId)
        ?.get(connection.actorId) === connection
    );
  }

  private send(socket: WebSocket, message: ServerMessage) {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
  }
}
