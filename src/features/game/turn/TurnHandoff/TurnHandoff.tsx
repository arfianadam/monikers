import type { Ref } from 'react';

import type { RoundNumber } from '@/features/game/domain/game-types';
import {
  ROUND_DETAILS,
  ROUND_DURATION_SECONDS,
} from '@/features/game/domain/rounds';
import { Brand } from '@/shared/ui/Brand/Brand';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { Panel } from '@/shared/ui/Panel/Panel';
import { RoundPips } from '@/shared/ui/RoundPips/RoundPips';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import styles from './TurnHandoff.module.css';

export interface TurnHandoffProps {
  round: RoundNumber;
  currentTeamNumber: 1 | 2;
  remainingCardCount: number;
  initialCardCount: number;
  currentTeamScore: number;
  onStart: () => void;
  containerRef?: Ref<HTMLDivElement>;
}

export function TurnHandoff({
  round,
  currentTeamNumber,
  remainingCardCount,
  initialCardCount,
  currentTeamScore,
  onStart,
  containerRef,
}: TurnHandoffProps) {
  const roundDetails = ROUND_DETAILS[round];
  return (
    <GameShell variant="turn" team={currentTeamNumber}>
      <ScreenFrame ref={containerRef} className={styles.screen} tabIndex={-1}>
        <TopBar>
          <Brand compact />
          <RoundPips round={round} />
        </TopBar>

        <main className={styles.layout}>
          <section className={styles.intro}>
            <Eyebrow onDark>
              Babak {round} · {roundDetails.name}
            </Eyebrow>
            <h1>
              Tim {currentTeamNumber},<span>giliranmu.</span>
            </h1>
            <p className={styles.lede}>{roundDetails.instruction}</p>

            <div className={styles.rule}>
              <span className={styles.ruleNumber}>0{round}</span>
              <span>
                <strong>{roundDetails.shortName}</strong>
                {roundDetails.example}
              </span>
            </div>
          </section>

          <Panel as="section" className={styles.ticket}>
            <div className={styles.ticketTeam}>
              <span>Tim</span>
              <strong>{currentTeamNumber}</strong>
            </div>
            <div className={styles.ticketStats}>
              <span>
                <strong>{remainingCardCount || initialCardCount}</strong>
                kartu tersisa
              </span>
              <span>
                <strong>{currentTeamScore}</strong>
                total poin
              </span>
              <span>
                <strong>{ROUND_DURATION_SECONDS}</strong>
                detik
              </span>
            </div>
            <div className={styles.ticketDivider} />
            <p>
              Serahkan perangkat kepada pemberi petunjuk, lalu mulai penghitung
              waktunya.
            </p>
            <GameButton className={styles.startButton} onClick={onStart}>
              Mulai giliran {ROUND_DURATION_SECONDS} detik
              <span aria-hidden="true">→</span>
            </GameButton>
          </Panel>
        </main>
      </ScreenFrame>
    </GameShell>
  );
}
