'use client';

import { useRef } from 'react';

import { CardSelectionScreen } from '@/features/game/card-selection/CardSelectionScreen/CardSelectionScreen';
import { ScoreScreen } from '@/features/game/score/ScoreScreen/ScoreScreen';
import { SetupScreen } from '@/features/game/setup/SetupScreen/SetupScreen';
import { useGameStore } from '@/features/game/store/GameStoreProvider';
import { TurnScreen } from '@/features/game/turn/TurnScreen/TurnScreen';
import { useStageFocus } from '@/shared/hooks/useStageFocus/useStageFocus';

export function GameSession() {
  const stage = useGameStore((state) => state.stage);
  const stageContainerRef = useRef<HTMLDivElement>(null);

  useStageFocus(stageContainerRef, stage);

  return (
    <div ref={stageContainerRef}>
      {stage === 'setup' && <SetupScreen />}
      {stage === 'card-selection' && <CardSelectionScreen />}
      {stage === 'turn' && <TurnScreen />}
      {(stage === 'round-score' || stage === 'final-score') && <ScoreScreen />}
    </div>
  );
}
