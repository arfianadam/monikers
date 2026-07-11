import {
  request as sendHttpRequest,
  type IncomingHttpHeaders,
} from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import type {
  ServerMessage,
  SessionCommand,
  SessionProjection,
} from '@/features/game/session-protocol/types';

import { SESSION_IDLE_TTL_MS } from './session-repository';
import {
  createSessionServer,
  type SessionRequestHandler,
  type SessionServer,
} from './session-server';
import {
  SESSION_COMMAND_RATE_LIMIT,
  SESSION_SOCKET_CLOSE,
} from './session-websocket';

interface HttpResponse<T = unknown> {
  status: number;
  headers: IncomingHttpHeaders;
  body: T;
}

interface HttpRequestOptions {
  method?: 'GET' | 'POST';
  origin?: string;
  cookie?: string;
  body?: unknown;
}

interface HarnessOptions {
  now?: () => number;
  fallback?: SessionRequestHandler;
}

class MessageInbox {
  private readonly messages: ServerMessage[] = [];
  private readonly listeners = new Set<() => void>();
  private closeResult: { code: number; reason: string } | null = null;
  private readonly closeListeners = new Set<
    (result: { code: number; reason: string }) => void
  >();

  constructor(readonly socket: WebSocket) {
    socket.on('message', (data) => {
      this.messages.push(JSON.parse(data.toString()) as ServerMessage);
      for (const listener of this.listeners) listener();
    });
    socket.on('close', (code, reason) => {
      const result = { code, reason: reason.toString() };
      this.closeResult = result;
      for (const listener of this.closeListeners) listener(result);
      this.closeListeners.clear();
    });
    socket.on('error', () => {
      // Connection helpers surface setup errors. Keeping a listener here also
      // prevents teardown races from becoming uncaught test-process errors.
    });
  }

  take(
    predicate: (message: ServerMessage) => boolean,
    timeoutMs = 2_000
  ): Promise<ServerMessage> {
    return new Promise((resolve, reject) => {
      const inspect = () => {
        const index = this.messages.findIndex(predicate);
        if (index < 0) return;
        cleanup();
        resolve(this.messages.splice(index, 1)[0]);
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `Timed out waiting for a WebSocket message; received ${JSON.stringify(this.messages)}`
          )
        );
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timeout);
        this.listeners.delete(inspect);
      };

      this.listeners.add(inspect);
      inspect();
    });
  }

  closed(timeoutMs = 2_000) {
    if (this.closeResult) return Promise.resolve(this.closeResult);
    return new Promise<{ code: number; reason: string }>((resolve, reject) => {
      const listener = (result: { code: number; reason: string }) => {
        clearTimeout(timeout);
        resolve(result);
      };
      const timeout = setTimeout(() => {
        this.closeListeners.delete(listener);
        reject(new Error('Timed out waiting for WebSocket close'));
      }, timeoutMs);
      this.closeListeners.add(listener);
    });
  }
}

class SessionServerHarness {
  readonly clients = new Set<MessageInbox>();
  readonly origin: string;
  readonly webSocketOrigin: string;
  private closed = false;

  constructor(
    readonly sessionServer: SessionServer,
    readonly port: number,
    private readonly fallbackCounter: { count: number }
  ) {
    this.origin = `http://127.0.0.1:${port}`;
    this.webSocketOrigin = `ws://127.0.0.1:${port}`;
  }

  get fallbackRequests() {
    return this.fallbackCounter.count;
  }

  request<T = unknown>(path: string, options: HttpRequestOptions = {}) {
    const body =
      options.body === undefined ? undefined : JSON.stringify(options.body);
    return new Promise<HttpResponse<T>>((resolve, reject) => {
      const request = sendHttpRequest(
        `${this.origin}${path}`,
        {
          method: options.method ?? 'GET',
          agent: false,
          headers: {
            connection: 'close',
            ...(options.origin ? { origin: options.origin } : {}),
            ...(options.cookie ? { cookie: options.cookie } : {}),
            ...(body
              ? {
                  'content-length': Buffer.byteLength(body),
                  'content-type': 'application/json',
                }
              : {}),
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          response.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve({
              status: response.statusCode ?? 0,
              headers: response.headers,
              body: (text ? JSON.parse(text) : null) as T,
            });
          });
        }
      );
      request.once('error', reject);
      if (body) request.write(body);
      request.end();
    });
  }

  startSlowPost<T = unknown>(
    path: string,
    options: { origin: string; cookie?: string; body: unknown }
  ) {
    const body = JSON.stringify(options.body);
    let finishRequest: (() => void) | null = null;
    const response = new Promise<HttpResponse<T>>((resolve, reject) => {
      const request = sendHttpRequest(
        `${this.origin}${path}`,
        {
          method: 'POST',
          agent: false,
          headers: {
            connection: 'close',
            origin: options.origin,
            ...(options.cookie ? { cookie: options.cookie } : {}),
            'content-length': Buffer.byteLength(body),
            'content-type': 'application/json',
          },
        },
        (incomingResponse) => {
          const chunks: Buffer[] = [];
          incomingResponse.on('data', (chunk) =>
            chunks.push(Buffer.from(chunk))
          );
          incomingResponse.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve({
              status: incomingResponse.statusCode ?? 0,
              headers: incomingResponse.headers,
              body: (text ? JSON.parse(text) : null) as T,
            });
          });
        }
      );
      request.once('error', reject);
      request.flushHeaders();
      finishRequest = () => request.end(body);
    });

    return {
      response,
      finish() {
        if (!finishRequest) throw new Error('Slow request was not initialized');
        finishRequest();
        finishRequest = null;
      },
    };
  }

  async openWebSocket(sessionId: string, cookie: string, origin = this.origin) {
    const socket = new WebSocket(
      `${this.webSocketOrigin}/session/${sessionId}/live`,
      {
        headers: { Cookie: cookie, Origin: origin },
      }
    );
    const inbox = new MessageInbox(socket);
    this.clients.add(inbox);

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        socket.off('open', onOpen);
        socket.off('error', onError);
      };
      socket.on('open', onOpen);
      socket.on('error', onError);
    });

    return inbox;
  }

  expectUpgradeRejection(
    sessionId: string,
    cookie: string,
    origin: string,
    expectedStatus: number
  ) {
    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(
        `${this.webSocketOrigin}/session/${sessionId}/live`,
        { headers: { Cookie: cookie, Origin: origin } }
      );
      const timeout = setTimeout(() => {
        socket.terminate();
        reject(new Error('Timed out waiting for rejected WebSocket upgrade'));
      }, 2_000);
      socket.once('unexpected-response', (_request, response) => {
        clearTimeout(timeout);
        response.resume();
        try {
          expect(response.statusCode).toBe(expectedStatus);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      socket.once('open', () => {
        clearTimeout(timeout);
        socket.terminate();
        reject(new Error('Expected the WebSocket upgrade to be rejected'));
      });
      socket.on('error', () => {
        // `ws` reports an error after an HTTP upgrade rejection as well.
      });
    });
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    for (const client of this.clients) {
      if (client.socket.readyState < WebSocket.CLOSING) {
        client.socket.terminate();
      }
    }
    const closing = this.sessionServer.close();
    this.sessionServer.server.closeAllConnections();
    await closing;
  }
}

const activeHarnesses: SessionServerHarness[] = [];

async function startHarness(options: HarnessOptions = {}) {
  const fallbackCounter = { count: 0 };
  const fallback: SessionRequestHandler =
    options.fallback ??
    ((_request, response) => {
      fallbackCounter.count += 1;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ handledBy: 'fallback' }));
    });
  const sessionServer = createSessionServer({
    requestHandler: fallback,
    runtimeOptions: {
      now: options.now,
      cleanupIntervalMs: 60 * 60 * 1_000,
    },
  });
  const address = await sessionServer.listen(0, '127.0.0.1');
  const harness = new SessionServerHarness(
    sessionServer,
    address.port,
    fallbackCounter
  );
  activeHarnesses.push(harness);
  return harness;
}

function cookieFrom(response: HttpResponse) {
  const setCookie = response.headers['set-cookie']?.[0];
  if (!setCookie) throw new Error('Expected a session cookie');
  return { header: setCookie, cookie: setCookie.split(';', 1)[0] };
}

function projection(
  inbox: MessageInbox,
  predicate: (value: SessionProjection) => boolean = () => true
) {
  return inbox.take(
    (message) => message.type === 'projection' && predicate(message.projection)
  ) as Promise<{ type: 'projection'; projection: SessionProjection }>;
}

function acknowledgement(inbox: MessageInbox, commandId: string) {
  return inbox.take(
    (message) =>
      message.type === 'command-ack' && message.commandId === commandId
  );
}

async function command(inbox: MessageInbox, value: SessionCommand) {
  inbox.socket.send(JSON.stringify(value));
  return acknowledgement(inbox, value.id);
}

async function createOwnDeviceSession(
  harness: SessionServerHarness,
  creatorName = 'Ayu'
) {
  const created = await harness.request<{
    sessionId: string;
    route: string;
    mode: string;
  }>('/api/sessions', {
    method: 'POST',
    origin: harness.origin,
    body: { mode: 'own-device' },
  });
  expect(created.status).toBe(201);
  const credential = cookieFrom(created);
  const activated = await harness.request<{
    route: string;
    joinCode: string;
  }>(`/session/${created.body.sessionId}/actions/activate`, {
    method: 'POST',
    origin: harness.origin,
    cookie: credential.cookie,
    body: { name: creatorName },
  });
  expect(activated.status).toBe(200);
  return {
    sessionId: created.body.sessionId,
    route: created.body.route,
    joinCode: activated.body.joinCode,
    credential,
  };
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for an asynchronous server update');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

afterEach(async () => {
  const harnesses = activeHarnesses.splice(0).reverse();
  await Promise.all(harnesses.map((harness) => harness.close()));
});

describe('session HTTP and WebSocket server', () => {
  it('creates a path-cookie session and resumes it after reconnecting', async () => {
    const harness = await startHarness();
    const created = await harness.request<{
      sessionId: string;
      route: string;
      mode: string;
    }>('/api/sessions', {
      method: 'POST',
      origin: harness.origin,
      body: { mode: 'single-device' },
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      route: `/session/${created.body.sessionId}`,
      mode: 'single-device',
    });
    const credential = cookieFrom(created);
    expect(credential.header).toContain(
      `Path=/session/${created.body.sessionId}`
    );
    expect(credential.header).toContain('HttpOnly');
    expect(credential.header).toContain('SameSite=Lax');
    expect(credential.header).not.toContain('Secure');

    const route = await harness.request<{ handledBy: string }>(
      created.body.route,
      { cookie: credential.cookie }
    );
    expect(route).toMatchObject({
      status: 200,
      body: { handledBy: 'fallback' },
    });
    expect(harness.fallbackRequests).toBe(1);

    const first = await harness.openWebSocket(
      created.body.sessionId,
      credential.cookie
    );
    const initial = await projection(first);
    expect(initial.projection).toMatchObject({
      sessionId: created.body.sessionId,
      mode: 'single-device',
      phase: 'setup',
      isController: true,
      configuration: { players: 4, cardsPerPlayer: 5 },
    });
    expect(initial.projection.recipientId).toEqual(expect.any(String));

    first.socket.close(1000, 'refresh');
    await first.closed();

    const resumed = await harness.openWebSocket(
      created.body.sessionId,
      credential.cookie
    );
    const resumedProjection = await projection(resumed);
    expect(resumedProjection.projection).toMatchObject({
      sessionId: created.body.sessionId,
      phase: 'setup',
      recipientId: initial.projection.recipientId,
      isController: true,
    });
  });

  it('activates, previews, and joins an own-device session', async () => {
    const harness = await startHarness();
    const created = await harness.request<{
      sessionId: string;
      route: string;
      mode: string;
    }>('/api/sessions', {
      method: 'POST',
      origin: harness.origin,
      body: { mode: 'own-device' },
    });
    const creatorCredential = cookieFrom(created);

    const activated = await harness.request<{
      route: string;
      joinCode: string;
    }>(`/session/${created.body.sessionId}/actions/activate`, {
      method: 'POST',
      origin: harness.origin,
      cookie: creatorCredential.cookie,
      body: { name: '  Ayu   Sari  ' },
    });
    expect(activated).toMatchObject({
      status: 200,
      body: { route: created.body.route },
    });
    expect(activated.body.joinCode).toMatch(/^[23456789A-HJ-NP-Z]{6}$/);

    const formattedCode =
      `${activated.body.joinCode.slice(0, 3)}-${activated.body.joinCode.slice(3)}`.toLowerCase();
    const preview = await harness.request<{
      code: string;
      controllerName: string;
      playerCount: number;
    }>(`/api/join/${formattedCode}`);
    expect(preview).toMatchObject({
      status: 200,
      body: {
        code: activated.body.joinCode,
        controllerName: 'Ayu Sari',
        playerCount: 1,
      },
    });

    const joined = await harness.request<{
      sessionId: string;
      route: string;
    }>(`/api/join/${formattedCode}`, {
      method: 'POST',
      origin: harness.origin,
      body: { name: 'Bima' },
    });
    expect(joined).toMatchObject({
      status: 201,
      body: {
        sessionId: created.body.sessionId,
        route: created.body.route,
      },
    });
    const joinerCredential = cookieFrom(joined);
    expect(joinerCredential.header).toContain(
      `Path=/session/${created.body.sessionId}`
    );
    expect(joinerCredential.cookie).not.toBe(creatorCredential.cookie);

    const creator = await harness.openWebSocket(
      created.body.sessionId,
      creatorCredential.cookie
    );
    const joiner = await harness.openWebSocket(
      created.body.sessionId,
      joinerCredential.cookie
    );
    const creatorLobby = await projection(
      creator,
      (value) =>
        value.phase === 'lobby' &&
        value.participants.every(
          (participant) => participant.presence === 'connected'
        )
    );
    const joinerLobby = await projection(
      joiner,
      (value) =>
        value.phase === 'lobby' &&
        value.participants.every(
          (participant) => participant.presence === 'connected'
        )
    );
    if (creatorLobby.projection.phase !== 'lobby') {
      throw new Error('Expected the creator lobby projection');
    }

    expect(creatorLobby.projection).toMatchObject({
      phase: 'lobby',
      isController: true,
      canManage: true,
      participants: [
        { displayName: 'Ayu Sari', team: 'team1' },
        { displayName: 'Bima', team: 'team2' },
      ],
    });
    expect(joinerLobby.projection).toMatchObject({
      phase: 'lobby',
      isController: false,
      canManage: false,
      participants: creatorLobby.projection.participants,
    });
    expect(joinerLobby.projection.recipientId).not.toBe(
      creatorLobby.projection.recipientId
    );
  });

  it('does not retain a credential when admission fails', async () => {
    const harness = await startHarness();
    const session = await createOwnDeviceSession(harness, 'Ayu');
    const record = harness.sessionServer.repository.get(session.sessionId);
    if (!record) throw new Error('Expected the created session record');
    const credentialCount = record.credentials.size;

    const rejected = await harness.request<{ code: string; error: string }>(
      `/api/join/${session.joinCode}`,
      {
        method: 'POST',
        origin: harness.origin,
        body: { name: 'AYU' },
      }
    );

    expect(rejected).toMatchObject({
      status: 409,
      body: { code: 'NAME_TAKEN' },
    });
    expect(record.credentials.size).toBe(credentialCount);
  });

  it('rejects cross-origin HTTP mutations and WebSocket upgrades', async () => {
    const harness = await startHarness();
    const foreignOrigin = 'https://permainan.example';
    const rejectedCreate = await harness.request<{
      code: string;
      error: string;
    }>('/api/sessions', {
      method: 'POST',
      origin: foreignOrigin,
      body: { mode: 'single-device' },
    });
    expect(rejectedCreate).toMatchObject({
      status: 403,
      body: { code: 'ORIGIN_REJECTED' },
    });

    const created = await harness.request<{ sessionId: string }>(
      '/api/sessions',
      {
        method: 'POST',
        origin: harness.origin,
        body: { mode: 'single-device' },
      }
    );
    const credential = cookieFrom(created);

    await harness.expectUpgradeRejection(
      created.body.sessionId,
      credential.cookie,
      foreignOrigin,
      403
    );
  });

  it('replaces an older socket for the same participant', async () => {
    const harness = await startHarness();
    const created = await harness.request<{ sessionId: string }>(
      '/api/sessions',
      {
        method: 'POST',
        origin: harness.origin,
        body: { mode: 'single-device' },
      }
    );
    const credential = cookieFrom(created);
    const older = await harness.openWebSocket(
      created.body.sessionId,
      credential.cookie
    );
    await projection(older);
    const olderClosed = older.closed();

    const replacement = await harness.openWebSocket(
      created.body.sessionId,
      credential.cookie
    );
    await expect(olderClosed).resolves.toEqual({
      code: SESSION_SOCKET_CLOSE.duplicate,
      reason: 'Duplicate connection',
    });
    await expect(projection(replacement)).resolves.toMatchObject({
      projection: { phase: 'setup', isController: true },
    });

    const result = await command(replacement, {
      id: 'after-duplicate',
      type: 'update-setup',
      players: 2,
    });
    expect(result).toMatchObject({
      type: 'command-ack',
      commandId: 'after-duplicate',
      ok: true,
    });
    await expect(
      projection(
        replacement,
        (value) => value.phase === 'setup' && value.configuration.players === 2
      )
    ).resolves.toMatchObject({ projection: { phase: 'setup' } });
  });

  it('rate-limits command bursts per connection and recovers after the window', async () => {
    let now = 1_000;
    const harness = await startHarness({ now: () => now });
    const created = await harness.request<{ sessionId: string }>(
      '/api/sessions',
      {
        method: 'POST',
        origin: harness.origin,
        body: { mode: 'single-device' },
      }
    );
    const credential = cookieFrom(created);
    const client = await harness.openWebSocket(
      created.body.sessionId,
      credential.cookie
    );
    await projection(client);

    for (let index = 0; index < SESSION_COMMAND_RATE_LIMIT.limit; index += 1) {
      await expect(
        command(client, {
          id: `allowed-${index}`,
          type: 'update-setup',
          players: 4,
        })
      ).resolves.toMatchObject({ ok: true });
    }

    await expect(
      command(client, {
        id: 'rate-limited',
        type: 'update-setup',
        players: 2,
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'RATE_LIMITED' },
    });

    now += SESSION_COMMAND_RATE_LIMIT.windowMs + 1;
    await expect(
      command(client, {
        id: 'after-rate-window',
        type: 'update-setup',
        players: 2,
      })
    ).resolves.toMatchObject({ ok: true });
  });

  it('rotates the public code and immediately retires the old code', async () => {
    const harness = await startHarness();
    const session = await createOwnDeviceSession(harness);
    const creator = await harness.openWebSocket(
      session.sessionId,
      session.credential.cookie
    );
    await projection(creator, (value) => value.phase === 'lobby');

    const result = await command(creator, {
      id: 'rotate-code',
      type: 'rotate-code',
    });
    expect(result).toMatchObject({
      type: 'command-ack',
      commandId: 'rotate-code',
      ok: true,
    });
    const rotated = await projection(
      creator,
      (value) => value.phase === 'lobby' && value.joinCode !== session.joinCode
    );
    if (rotated.projection.phase !== 'lobby') {
      throw new Error('Expected a lobby projection after rotating the code');
    }

    const oldPreview = await harness.request<{ code: string }>(
      `/api/join/${session.joinCode}`
    );
    expect(oldPreview).toMatchObject({
      status: 404,
      body: { code: 'CODE_NOT_FOUND' },
    });
    const newPreview = await harness.request<{ code: string }>(
      `/api/join/${rotated.projection.joinCode}`
    );
    expect(newPreview).toMatchObject({
      status: 200,
      body: { code: rotated.projection.joinCode },
    });
  });

  it('revalidates a join code after a slow request enters the room queue', async () => {
    const harness = await startHarness();
    const session = await createOwnDeviceSession(harness);
    const creator = await harness.openWebSocket(
      session.sessionId,
      session.credential.cookie
    );
    await projection(creator, (value) => value.phase === 'lobby');
    const record = harness.sessionServer.repository.get(session.sessionId);
    if (!record || record.state.mode !== 'own-device') {
      throw new Error('Expected the own-device room');
    }
    const slowJoin = harness.startSlowPost<{ code: string; error: string }>(
      `/api/join/${session.joinCode}`,
      {
        origin: harness.origin,
        body: { name: 'Terlambat' },
      }
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    await command(creator, { id: 'rotate-during-join', type: 'rotate-code' });
    await projection(
      creator,
      (value) => value.phase === 'lobby' && value.joinCode !== session.joinCode
    );
    slowJoin.finish();

    await expect(slowJoin.response).resolves.toMatchObject({
      status: 404,
      body: { code: 'CODE_NOT_FOUND' },
    });
    expect(Object.keys(record.state.participants)).toHaveLength(1);
    expect(record.credentials.size).toBe(1);
  });

  it('serializes the final lobby admissions and reports a precise full-room error', async () => {
    const harness = await startHarness();
    const session = await createOwnDeviceSession(harness);
    const admissions = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        harness.request<{ code?: string }>(`/api/join/${session.joinCode}`, {
          method: 'POST',
          origin: harness.origin,
          body: { name: `Pemain penuh ${index + 1}` },
        })
      )
    );

    expect(admissions.filter((result) => result.status === 201)).toHaveLength(
      19
    );
    expect(admissions.filter((result) => result.status === 409)).toEqual([
      expect.objectContaining({
        body: expect.objectContaining({ code: 'ROOM_FULL' }),
      }),
    ]);
  });

  it('rejects late joins after selection has started', async () => {
    const harness = await startHarness();
    const session = await createOwnDeviceSession(harness);
    const joined = await harness.request<{ sessionId: string; route: string }>(
      `/api/join/${session.joinCode}`,
      {
        method: 'POST',
        origin: harness.origin,
        body: { name: 'Bima' },
      }
    );
    expect(joined.status).toBe(201);
    const joinerCredential = cookieFrom(joined);
    const creator = await harness.openWebSocket(
      session.sessionId,
      session.credential.cookie
    );
    const joiner = await harness.openWebSocket(
      session.sessionId,
      joinerCredential.cookie
    );
    await projection(
      joiner,
      (value) =>
        value.phase === 'lobby' &&
        value.participants.every(
          (participant) => participant.presence === 'connected'
        )
    );

    await expect(
      command(creator, {
        id: 'creator-ready',
        type: 'set-ready',
        ready: true,
      })
    ).resolves.toMatchObject({ ok: true });
    await expect(
      command(joiner, {
        id: 'joiner-ready',
        type: 'set-ready',
        ready: true,
      })
    ).resolves.toMatchObject({ ok: true });
    await projection(
      creator,
      (value) => value.phase === 'lobby' && value.canStart
    );
    await expect(
      command(creator, {
        id: 'start-selection',
        type: 'start-selection',
      })
    ).resolves.toMatchObject({ ok: true });
    await projection(creator, (value) => value.phase === 'selection');

    const lateJoin = await harness.request<{ code: string; error: string }>(
      `/api/join/${session.joinCode}`,
      {
        method: 'POST',
        origin: harness.origin,
        body: { name: 'Citra' },
      }
    );
    expect(lateJoin).toMatchObject({
      status: 409,
      body: { code: 'ROOM_STARTED' },
    });
    const latePreview = await harness.request<{ code: string; error: string }>(
      `/api/join/${session.joinCode}`
    );
    expect(latePreview).toMatchObject({
      status: 409,
      body: { code: 'ROOM_STARTED' },
    });
  });

  it('ends a session immediately and revokes its cookie and join code', async () => {
    const harness = await startHarness();
    const session = await createOwnDeviceSession(harness);
    const creator = await harness.openWebSocket(
      session.sessionId,
      session.credential.cookie
    );
    await projection(creator, (value) => value.phase === 'lobby');

    const ended = await harness.request<{ route: string }>(
      `/session/${session.sessionId}/actions/end`,
      {
        method: 'POST',
        origin: harness.origin,
        cookie: session.credential.cookie,
      }
    );
    expect(ended).toMatchObject({ status: 200, body: { route: '/' } });
    expect(harness.sessionServer.repository.get(session.sessionId)).toBeNull();
    const clearedCookie = ended.headers['set-cookie']?.[0];
    expect(clearedCookie).toContain(`Path=/session/${session.sessionId}`);
    expect(clearedCookie).toContain('Max-Age=0');
    await expect(
      creator.take(
        (message) =>
          message.type === 'event' && message.event.type === 'session-ended'
      )
    ).resolves.toMatchObject({
      type: 'event',
      event: { type: 'session-ended' },
    });
    await expect(creator.closed()).resolves.toEqual({
      code: SESSION_SOCKET_CLOSE.ended,
      reason: 'ended',
    });

    const staleConnection = await harness.openWebSocket(
      session.sessionId,
      session.credential.cookie,
      harness.origin
    );
    await expect(staleConnection.closed()).resolves.toEqual({
      code: SESSION_SOCKET_CLOSE.expired,
      reason: 'Session expired',
    });
    await expect(
      harness.request(`/api/join/${session.joinCode}`)
    ).resolves.toMatchObject({
      status: 404,
      body: { code: 'CODE_NOT_FOUND' },
    });
  });

  it('expires a session one day after its final connection closes', async () => {
    let now = 1_000;
    const harness = await startHarness({ now: () => now });
    const created = await harness.request<{ sessionId: string }>(
      '/api/sessions',
      {
        method: 'POST',
        origin: harness.origin,
        body: { mode: 'single-device' },
      }
    );
    const credential = cookieFrom(created);
    const client = await harness.openWebSocket(
      created.body.sessionId,
      credential.cookie
    );
    await projection(client);
    const record = harness.sessionServer.repository.get(created.body.sessionId);
    if (!record) throw new Error('Expected the created session record');

    now = 10_000;
    client.socket.close(1000, 'offline');
    await client.closed();
    await waitUntil(() => record.connectedActorIds.size === 0);
    expect(record.lastConnectionClosedAt).toBe(now);

    now += SESSION_IDLE_TTL_MS - 1;
    expect(harness.sessionServer.runtime.cleanupExpiredSessions()).toEqual([]);
    now += 1;
    expect(harness.sessionServer.runtime.cleanupExpiredSessions()).toEqual([
      created.body.sessionId,
    ]);

    const expired = await harness.openWebSocket(
      created.body.sessionId,
      credential.cookie
    );
    await expect(expired.closed()).resolves.toEqual({
      code: SESSION_SOCKET_CLOSE.expired,
      reason: 'Session expired',
    });
  });
});
