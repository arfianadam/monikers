import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface GameShellProps {
  children: ReactNode;
  className?: string;
}

export function GameShell({ children, className }: GameShellProps) {
  return (
    <div className={cn('game-shell', className)}>
      <div
        className="game-shell__shape game-shell__shape--coral"
        aria-hidden="true"
      />
      <div
        className="game-shell__shape game-shell__shape--cyan"
        aria-hidden="true"
      />
      {children}
    </div>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('brand-lockup', compact && 'brand-lockup--compact')}>
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-mark__card brand-mark__card--back" />
        <span className="brand-mark__card brand-mark__card--front">M</span>
      </span>
      <span className="brand-lockup__copy">
        <span className="brand-lockup__name">Monikers</span>
        {!compact && (
          <span className="brand-lockup__tagline">Permainan tebak nama</span>
        )}
      </span>
    </div>
  );
}

interface RoundPipsProps {
  round: number;
  label?: boolean;
}

export function RoundPips({ round, label = true }: RoundPipsProps) {
  return (
    <div className="round-pips" aria-label={`Babak ${round} dari 3`}>
      {label && <span className="round-pips__label">Babak</span>}
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={cn(
            'round-pips__pip',
            step === round && 'round-pips__pip--active',
            step < round && 'round-pips__pip--complete'
          )}
        >
          {step}
        </span>
      ))}
    </div>
  );
}
