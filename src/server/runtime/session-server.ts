import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http';

import { sendError } from './http-utils';
import {
  SessionHttpController,
  type SessionHttpControllerOptions,
} from './session-http';
import type { InMemorySessionRepository } from './session-repository';
import { SessionRuntime, type SessionRuntimeOptions } from './session-runtime';
import {
  SessionWebSocketGateway,
  type SessionWebSocketGatewayOptions,
} from './session-websocket';

export type SessionRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse
) => void | Promise<void>;

export interface CreateSessionServerOptions {
  rateLimitsEnabled?: boolean;
  requestHandler?: SessionRequestHandler;
  repository?: InMemorySessionRepository;
  runtime?: SessionRuntime;
  runtimeOptions?: Omit<SessionRuntimeOptions, 'repository' | 'onMaintenance'>;
  websocketOptions?: Omit<
    SessionWebSocketGatewayOptions,
    'rateLimitsEnabled' | 'runtime'
  >;
  onClose?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
}

export interface SessionServerAddress {
  hostname: string;
  port: number;
  origin: string;
}

export interface SessionServer {
  server: HttpServer;
  repository: InMemorySessionRepository;
  runtime: SessionRuntime;
  http: SessionHttpController;
  websocket: SessionWebSocketGateway;
  listen(port?: number, hostname?: string): Promise<SessionServerAddress>;
  close(): Promise<void>;
}

function listeningAddress(server: HttpServer): SessionServerAddress {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('The HTTP server does not have a TCP address');
  }
  const hostname = address.address;
  const originHostname = hostname.includes(':') ? `[${hostname}]` : hostname;
  return {
    hostname,
    port: address.port,
    origin: `http://${originHostname}:${address.port}`,
  };
}

export function createSessionServer(
  options: CreateSessionServerOptions = {}
): SessionServer {
  if (
    options.runtime &&
    options.repository &&
    options.runtime.repository !== options.repository
  ) {
    throw new Error('Runtime and server must use the same session repository');
  }

  let pruneHttpRateLimits: () => void = () => undefined;
  const runtime =
    options.runtime ??
    new SessionRuntime({
      ...options.runtimeOptions,
      repository: options.repository,
      onMaintenance: () => pruneHttpRateLimits(),
    });
  const repository = runtime.repository;
  const websocket = new SessionWebSocketGateway({
    ...options.websocketOptions,
    rateLimitsEnabled: options.rateLimitsEnabled ?? false,
    runtime,
  });
  const httpController = new SessionHttpController({
    rateLimitsEnabled: options.rateLimitsEnabled ?? false,
    repository,
    now: () => runtime.serverTime,
    onLeave: (record, actorId, now) => runtime.leave(record, actorId, now),
    onStateChanged: (record, details) => runtime.stateChanged(record, details),
    onDeleted: (sessionId, reason) => runtime.sessionDeleted(sessionId, reason),
  } satisfies SessionHttpControllerOptions);
  pruneHttpRateLimits = () => httpController.pruneRateLimits();

  const requestHandler = options.requestHandler;
  const server = createServer((request, response) => {
    void (async () => {
      try {
        if (await httpController.handle(request, response)) return;
        if (requestHandler) {
          await requestHandler(request, response);
          return;
        }
        sendError(response, 404, 'NOT_FOUND', 'Halaman tidak ditemukan.');
      } catch (error) {
        options.onError?.(error);
        if (!response.headersSent) {
          sendError(
            response,
            500,
            'INTERNAL_ERROR',
            'Terjadi kesalahan pada server.'
          );
        } else if (!response.writableEnded) {
          response.end();
        }
      }
    })();
  });
  websocket.attach(server);

  let closePromise: Promise<void> | null = null;
  return {
    server,
    repository,
    runtime,
    http: httpController,
    websocket,
    listen(port = 0, hostname = '127.0.0.1') {
      if (server.listening) return Promise.resolve(listeningAddress(server));
      return new Promise<SessionServerAddress>((resolve, reject) => {
        const onError = (error: Error) => {
          server.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.off('error', onError);
          resolve(listeningAddress(server));
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, hostname);
      });
    },
    close() {
      if (closePromise) return closePromise;
      closePromise = (async () => {
        const httpClosed = server.listening
          ? new Promise<void>((resolve, reject) => {
              server.close((error) => {
                if (error) reject(error);
                else resolve();
              });
              server.closeIdleConnections?.();
            })
          : Promise.resolve();
        await websocket.close();
        await httpClosed;
        runtime.close();
        await options.onClose?.();
      })();
      return closePromise;
    },
  };
}
