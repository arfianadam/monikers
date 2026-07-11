import type { RoundNumber } from './game-types';

export const ROUND_DURATION_SECONDS = 60;

export interface RoundDetails {
  name: string;
  shortName: string;
  instruction: string;
  example: string;
}

export const ROUND_DETAILS: Readonly<Record<RoundNumber, RoundDetails>> = {
  1: {
    name: 'Bicara bebas',
    shortName: 'Bebas bicara',
    instruction:
      'Gunakan kata apa pun—asal jangan menyebut nama yang tertulis di kartu.',
    example: 'Cerita, petunjuk, tiruan... semuanya boleh.',
  },
  2: {
    name: 'Satu kata',
    shortName: 'Satu kata saja',
    instruction:
      'Berikan tepat satu kata sebagai petunjuk. Timmu boleh terus menebak.',
    example: 'Pilih satu kata itu dengan sangat hati-hati.',
  },
  3: {
    name: 'Peragaan',
    shortName: 'Peragakan',
    instruction:
      'Tanpa kata atau suara. Gunakan pantomim, gerakan, dan akting terbaikmu.',
    example: 'Totalitaslah. Gengsi tidak wajib.',
  },
};

export function getNextRound(round: RoundNumber): RoundNumber | null {
  if (round === 1) return 2;
  if (round === 2) return 3;
  return null;
}

export function isFinalRound(round: RoundNumber): boolean {
  return round === 3;
}
