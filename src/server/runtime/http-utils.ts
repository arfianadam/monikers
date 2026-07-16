import type { IncomingMessage, ServerResponse } from 'node:http';

export const SESSION_COOKIE_NAME = 'monikers_session';

export interface JsonErrorBody {
  code: string;
  error: string;
}

export function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown,
  headers: Record<string, string | string[]> = {}
) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(body);
}

export function sendError(
  response: ServerResponse,
  status: number,
  code: string,
  error: string,
  headers?: Record<string, string | string[]>
) {
  sendJson(response, status, { code, error } satisfies JsonErrorBody, headers);
}

export async function readJsonBody(
  request: IncomingMessage,
  maximumBytes = 8_192
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maximumBytes) throw new Error('request-too-large');
    chunks.push(buffer);
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

export function parseCookies(request: IncomingMessage): Map<string, string> {
  const cookies = new Map<string, string>();
  const header = request.headers.cookie;
  if (!header) return cookies;

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    try {
      cookies.set(name, decodeURIComponent(value));
    } catch {
      // Ignore malformed cookie values instead of rejecting the whole request.
    }
  }

  return cookies;
}

export function getSessionCredential(request: IncomingMessage): string | null {
  return parseCookies(request).get(SESSION_COOKIE_NAME) ?? null;
}

export function sessionCookie(
  sessionId: string,
  token: string,
  secure: boolean
): string {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=/session/${sessionId}`,
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export function clearedSessionCookie(
  sessionId: string,
  secure: boolean
): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    `Path=/session/${sessionId}`,
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export function requestIsSecure(request: IncomingMessage): boolean {
  const forwardedProtocol = request.headers['x-forwarded-proto'];

  if (typeof forwardedProtocol === 'string') {
    const protocol = forwardedProtocol.split(',')[0].trim();
    return protocol === 'https' || protocol === 'wss';
  }

  return Boolean(
    (request.socket as IncomingMessage['socket'] & { encrypted?: boolean })
      .encrypted
  );
}

export function getClientAddress(request: IncomingMessage): string {
  return request.socket.remoteAddress ?? 'unknown';
}

export function isSameOriginRequest(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) return false;

  try {
    const parsedOrigin = new URL(origin);
    const expectedProtocol = requestIsSecure(request) ? 'https:' : 'http:';
    return (
      parsedOrigin.host === host && parsedOrigin.protocol === expectedProtocol
    );
  } catch {
    return false;
  }
}
