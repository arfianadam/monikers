'use client';

import { useCallback, useEffect, useRef } from 'react';

interface GameSounds {
  bell: HTMLAudioElement;
  ring: HTMLAudioElement;
}

export function useGameSounds() {
  const sounds = useRef<GameSounds | null>(null);

  useEffect(() => {
    sounds.current = {
      bell: new Audio('/sounds/bell.wav'),
      ring: new Audio('/sounds/ring.wav'),
    };
  }, []);

  const playBell = useCallback(() => {
    if (!sounds.current?.bell) return;

    sounds.current.bell.pause();
    sounds.current.bell.currentTime = 0;
    sounds.current.bell.play();
  }, []);

  const playRing = useCallback(() => {
    sounds.current?.ring.play();
  }, []);

  const stopRing = useCallback(() => {
    if (!sounds.current?.ring) return;

    sounds.current.ring.pause();
    sounds.current.ring.currentTime = 0;
  }, []);

  return { playBell, playRing, stopRing };
}
