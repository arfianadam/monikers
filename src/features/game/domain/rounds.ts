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
    name: 'Ngomong bebas',
    shortName: 'Bebas ngomong',
    instruction: 'Ngomong apa saja—yang penting jangan sebut nama di kartunya.',
    example: 'Cerita, clue, tiruan... bebas!',
  },
  2: {
    name: 'Satu kata',
    shortName: 'Cuma satu kata',
    instruction:
      'Kasih satu kata saja sebagai clue. Timmu boleh nebak berkali-kali.',
    example: 'Satu kata. Pilih yang ngena.',
  },
  3: {
    name: 'Pakai gaya',
    shortName: 'Pakai gaya',
    instruction:
      'Nggak boleh ngomong atau bikin suara. Andalkan gerakan dan aktingmu.',
    example: 'Totalitas. Gengsi belakangan.',
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
