'use client';

import { useEffect } from 'react';

export function useLeaveGuard() {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    const handlePopState = () => {
      const shouldLeave = window.confirm('Yakin mau keluar dari game?');
      if (shouldLeave) {
        window.removeEventListener('popstate', handlePopState);
        window.history.back();
        return;
      }

      window.history.pushState(null, '', window.location.href);
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
