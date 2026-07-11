'use client';

import { useEffect } from 'react';

export function useStageScroll(transitionKey: string) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [transitionKey]);
}
