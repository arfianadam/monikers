'use client';

import { useEffect } from 'react';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  released: boolean;
}

interface WakeLockNavigator {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
}

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const navigatorWithWakeLock = navigator as unknown as WakeLockNavigator;
    let sentinel: WakeLockSentinelLike | null = null;
    let acquisition: Promise<void> | null = null;
    let disposed = false;

    const acquire = () => {
      if (
        disposed ||
        document.visibilityState !== 'visible' ||
        !navigatorWithWakeLock.wakeLock ||
        (sentinel && !sentinel.released) ||
        acquisition
      ) {
        return;
      }

      acquisition = navigatorWithWakeLock.wakeLock
        .request('screen')
        .then(async (nextSentinel) => {
          if (disposed) {
            await nextSentinel.release();
            return;
          }
          sentinel = nextSentinel;
        })
        .catch(() => {
          // Wake Lock is best-effort and may be denied by the browser or OS.
        })
        .finally(() => {
          acquisition = null;
        });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (sentinel && !sentinel.released) {
        void sentinel.release().catch(() => undefined);
      }
    };
  }, [active]);
}
