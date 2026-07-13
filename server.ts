import { pathToFileURL } from 'node:url';

import next from 'next';

import {
  createSessionServer,
  type SessionServer,
} from './src/server/runtime/session-server';

export interface StartMonikersServerOptions {
  dev?: boolean;
  hostname?: string;
  port?: number;
}

type NextRequestHandler = ReturnType<
  ReturnType<typeof next>['getRequestHandler']
>;

export function createSeededRandom(seed: string): () => number {
  let state = 2_166_136_261;
  for (const character of seed) {
    state ^= character.codePointAt(0) ?? 0;
    state = Math.imul(state, 16_777_619);
  }

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export async function startMonikersServer(
  options: StartMonikersServerOptions = {}
): Promise<SessionServer> {
  const dev = options.dev ?? process.env.NODE_ENV !== 'production';
  const hostname = options.hostname ?? process.env.HOST ?? '0.0.0.0';
  const port = options.port ?? Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error('PORT must be an integer between 0 and 65535');
  }

  let nextHandler: NextRequestHandler | null = null;
  let nextServer: ReturnType<typeof next> | null = null;
  const testSeed = process.env.MONIKERS_TEST_SEED;
  const rateLimitsEnabled =
    process.env.NODE_ENV === 'production' && !dev && !testSeed;
  const sessionServer = createSessionServer({
    rateLimitsEnabled,
    requestHandler: (request, response) => {
      if (!nextHandler) {
        response.writeHead(503, {
          'content-type': 'text/plain; charset=utf-8',
        });
        response.end('Server sedang dimulai.');
        return;
      }
      return nextHandler(request, response);
    },
    onClose: () => nextServer?.close(),
    onError: (error) => {
      process.stderr.write(`${String(error)}\n`);
    },
    runtimeOptions: testSeed
      ? { randomFactory: () => createSeededRandom(testSeed) }
      : undefined,
  });
  nextServer = next({
    dev,
    hostname,
    port,
    httpServer: sessionServer.server,
    turbo: dev,
  });
  try {
    await nextServer.prepare();
    nextHandler = nextServer.getRequestHandler();
    await sessionServer.listen(port, hostname);
  } catch (error) {
    await sessionServer.close();
    throw error;
  }
  return sessionServer;
}

async function main() {
  const server = await startMonikersServer();
  const address = server.server.address();
  if (address && typeof address !== 'string') {
    const displayHostname = address.address.includes(':')
      ? `[${address.address}]`
      : address.address;
    process.stdout.write(
      `Monikers siap di http://${displayHostname}:${address.port}\n`
    );
  }

  let shutdown: Promise<void> | null = null;
  const close = () => {
    shutdown ??= server.close();
    void shutdown.catch((error) => {
      process.exitCode = 1;
      process.stderr.write(`${String(error)}\n`);
    });
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

const entryPath = process.argv[1];
if (entryPath && pathToFileURL(entryPath).href === import.meta.url) {
  void main().catch((error) => {
    process.exitCode = 1;
    process.stderr.write(`${String(error)}\n`);
  });
}
