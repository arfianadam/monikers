import type { ReactNode, Ref } from 'react';

import type { ScoresByRound } from '@/features/game/domain/game-types';
import { getScoredRounds, getTeamTotal } from '@/features/game/domain/scoring';
import { cn } from '@/lib/utils';
import { Brand } from '@/shared/ui/Brand/Brand';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { MaterialSymbol } from '@/shared/ui/MaterialSymbol/MaterialSymbol';
import { RoundPips } from '@/shared/ui/RoundPips/RoundPips';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import { ScoreDuel } from '../ScoreDuel/ScoreDuel';
import { ScoreRecap } from '../ScoreRecap/ScoreRecap';
import styles from './ScoreScreen.module.css';

export interface ScoreViewProps {
  scores: ScoresByRound;
  isGameOver: boolean;
  canContinue?: boolean;
  disabled?: boolean;
  waitingMessage?: string;
  headerActions?: ReactNode;
  connectionStatus?: ReactNode;
  containerRef?: Ref<HTMLDivElement>;
  onContinue: () => void;
}

export function ScoreView({
  scores,
  isGameOver,
  canContinue = true,
  disabled = false,
  waitingMessage = 'Nunggu host lanjutkan game…',
  headerActions,
  connectionStatus,
  containerRef,
  onContinue,
}: ScoreViewProps) {
  const team1Total = getTeamTotal(scores, 'team1');
  const team2Total = getTeamTotal(scores, 'team2');
  const isTie = team1Total === team2Total;
  const leader: 1 | 2 | null = isTie ? null : team1Total > team2Total ? 1 : 2;
  const rounds = getScoredRounds(scores);
  const latestRound = rounds.at(-1) ?? 1;

  const title = isGameOver
    ? isTie
      ? 'Seri. Sama-sama jago!'
      : `Tim ${leader} juaranya!`
    : `Ronde ${latestRound} kelar!`;
  return (
    <GameShell variant="score" final={isGameOver}>
      <ScreenFrame ref={containerRef} tabIndex={-1}>
        <TopBar
          meta={<RoundPips round={latestRound} final={isGameOver} />}
          trailing={
            headerActions !== undefined || connectionStatus !== undefined ? (
              <>
                {headerActions}
                {connectionStatus}
              </>
            ) : undefined
          }
        >
          <Brand compact />
        </TopBar>

        <main className={styles.main}>
          <div
            className={cn(styles.heading, isGameOver && styles.finalHeading)}
          >
            <Eyebrow className={styles.headingEyebrow} onDark>
              {isGameOver ? 'Final score' : 'Score check'}
            </Eyebrow>
            <h1>{title}</h1>
            <p>
              {isGameOver
                ? 'Clue berani, tebakan meragukan, skor sudah final.'
                : 'Tarik napas, cek skor, lalu siap-siap buat ronde berikutnya.'}
            </p>
          </div>

          <ScoreDuel
            team1Total={team1Total}
            team2Total={team2Total}
            leader={leader}
            isGameOver={isGameOver}
          />

          <ScoreRecap scores={scores} rounds={rounds} />

          <div className={styles.action}>
            <p>
              {canContinue
                ? isGameOver
                  ? 'Player sama, deck baru?'
                  : `Next: Ronde ${latestRound + 1}`
                : waitingMessage}
            </p>
            {canContinue && (
              <GameButton
                className={styles.actionButton}
                onClick={onContinue}
                disabled={disabled}
              >
                {isGameOver ? 'Rematch' : 'Lanjut ronde berikutnya'}
                <MaterialSymbol name="arrow_forward" />
              </GameButton>
            )}
          </div>
        </main>
      </ScreenFrame>
    </GameShell>
  );
}
