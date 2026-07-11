'use client';

import { type RefObject, useEffect, useRef } from 'react';

export function useStageFocus(
  containerRef: RefObject<HTMLElement | null>,
  transitionKey: string
) {
  const isInitialView = useRef(true);

  useEffect(() => {
    window.scrollTo(0, 0);

    if (isInitialView.current) {
      isInitialView.current = false;
      return;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        containerRef.current?.contains(activeElement) &&
        activeElement.matches('button, input, select, textarea, [tabindex]')
      ) {
        return;
      }

      const heading = containerRef.current?.querySelector('h1');
      const focusTarget = heading ?? containerRef.current;

      if (focusTarget instanceof HTMLElement) {
        focusTarget.tabIndex = -1;
        focusTarget.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [containerRef, transitionKey]);
}
