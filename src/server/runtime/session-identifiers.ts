import { randomBytes, randomInt } from 'node:crypto';

const JOIN_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const JOIN_CODE_LENGTH = 6;
const displayNameSegmenter = new Intl.Segmenter('id', {
  granularity: 'grapheme',
});

export function createSessionId(): string {
  return randomBytes(18).toString('base64url');
}

export function createCredentialToken(): string {
  return randomBytes(32).toString('base64url');
}

export function normalizeJoinCode(value: string): string {
  return value.toUpperCase().replace(/[\s-]+/g, '');
}

export function isJoinCode(value: string): boolean {
  const normalized = normalizeJoinCode(value);
  return (
    normalized.length === JOIN_CODE_LENGTH &&
    [...normalized].every((character) => JOIN_CODE_ALPHABET.includes(character))
  );
}

export function createJoinCode(isAvailable: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    let code = '';
    for (let index = 0; index < JOIN_CODE_LENGTH; index += 1) {
      code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
    }

    if (isAvailable(code)) return code;
  }

  throw new Error('Unable to allocate a unique join code');
}

export function normalizeDisplayName(value: string): string | null {
  const name = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  const graphemeCount = [...displayNameSegmenter.segment(name)].length;

  if (graphemeCount < 1 || graphemeCount > 24 || /\p{Cc}/u.test(name)) {
    return null;
  }

  return name;
}

export function displayNamesMatch(first: string, second: string): boolean {
  return (
    first.normalize('NFC').toLocaleLowerCase('id-ID') ===
    second.normalize('NFC').toLocaleLowerCase('id-ID')
  );
}
