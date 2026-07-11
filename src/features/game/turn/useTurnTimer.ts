'use client';

import { useEffect } from 'react';

interface UseTurnTimerOptions {
  isActive: boolean;
  timer: number;
  tickTimer: () => void;
  expireTurn: () => void;
  onExpire: () => void;
}

export function useTurnTimer({
  isActive,
  timer,
  tickTimer,
  expireTurn,
  onExpire,
}: UseTurnTimerOptions) {
  useEffect(() => {
    if (isActive && timer > 0) {
      const interval = window.setInterval(tickTimer, 1_000);
      return () => window.clearInterval(interval);
    }

    if (isActive && timer === 0) {
      onExpire();
      expireTurn();
    }
  }, [expireTurn, isActive, onExpire, tickTimer, timer]);
}
