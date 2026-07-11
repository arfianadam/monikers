'use client';

import { useEffect } from 'react';

export function useLeaveGuard() {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    const handlePopState = (event: PopStateEvent) => {
      window.history.pushState(null, '', window.location.href);
      const shouldLeave = window.confirm('Yakin ingin meninggalkan permainan?');
      if (!shouldLeave) event.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);
}
