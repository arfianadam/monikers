'use client';

import { useEffect, useState } from 'react';

export function useServerCountdown(
  turnEndsAt: number | null,
  serverTime: number
) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (turnEndsAt === null) {
      setSeconds(0);
      return;
    }

    const clockOffset = serverTime - Date.now();
    const update = () => {
      const remainingMilliseconds = turnEndsAt - (Date.now() + clockOffset);
      setSeconds(Math.max(0, Math.ceil(remainingMilliseconds / 1_000)));
    };

    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [serverTime, turnEndsAt]);

  return seconds;
}
