'use client';

import { CardSelectionScreen } from '@/features/game/card-selection/CardSelectionScreen/CardSelectionScreen';
import { ScoreScreen } from '@/features/game/score/ScoreScreen/ScoreScreen';
import { SetupScreen } from '@/features/game/setup/SetupScreen/SetupScreen';
import { useGameStore } from '@/features/game/store/GameStoreProvider';
import { TurnScreen } from '@/features/game/turn/TurnScreen/TurnScreen';
import { useStageScroll } from '@/shared/hooks/useStageScroll/useStageScroll';

export function GameSession() {
  const stage = useGameStore((state) => state.stage);

  useStageScroll(stage);

  return (
    <div>
      {stage === 'setup' && <SetupScreen />}
      {stage === 'card-selection' && <CardSelectionScreen />}
      {stage === 'turn' && <TurnScreen />}
      {(stage === 'round-score' || stage === 'final-score') && <ScoreScreen />}
    </div>
  );
}
