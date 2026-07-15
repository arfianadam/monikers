'use client';

import type { CSSProperties, ReactNode, Ref } from 'react';

import type {
  Card,
  RoundNumber,
  TeamId,
} from '@/features/game/domain/game-types';
import {
  ROUND_DETAILS,
  ROUND_DURATION_SECONDS,
} from '@/features/game/domain/rounds';
import { cn } from '@/lib/utils';
import { Brand } from '@/shared/ui/Brand/Brand';
import {
  ConnectionStatus,
  type ConnectionStatusState,
} from '@/shared/ui/ConnectionStatus/ConnectionStatus';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { MaterialSymbol } from '@/shared/ui/MaterialSymbol/MaterialSymbol';
import { Panel } from '@/shared/ui/Panel/Panel';
import { RoundPips } from '@/shared/ui/RoundPips/RoundPips';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import styles from './OwnTurnScreen.module.css';

export interface OwnTurnScoresView {
  team1: number;
  team2: number;
}

interface OwnTurnBaseProps {
  round: RoundNumber;
  currentTeam: TeamId;
  clueGiverName: string | null;
  remainingCardCount: number;
  scores: OwnTurnScoresView;
  inactivityTimeoutEnabled: boolean;
  connectionState?: ConnectionStatusState;
  onRetry?: () => void;
  headerActions?: ReactNode;
  actionsDisabled?: boolean;
  containerRef?: Ref<HTMLDivElement>;
}

export interface OwnTurnHandoffProps extends OwnTurnBaseProps {
  view: 'handoff';
  canStart: boolean;
  onStart: () => void;
}

export interface OwnTurnActiveProps extends OwnTurnBaseProps {
  view: 'active';
  /** Only the active clue-giver's current card. Never pass queued cards. */
  card: Card;
  secondsRemaining: number;
  canMarkCorrect: boolean;
  canSkip: boolean;
  canEnd: boolean;
  onMarkCorrect: (cardWord: string) => void;
  onSkip: (cardWord: string) => void;
  onEnd: () => void;
  turnDurationSeconds?: number;
}

export type OwnTurnWatchingStatus =
  'waiting-for-start' | 'active' | 'waiting-for-clue-giver' | 'team-offline';

export interface OwnTurnWatchingProps extends OwnTurnBaseProps {
  view: 'watching';
  status: OwnTurnWatchingStatus;
  secondsRemaining?: number;
  reconnectSecondsRemaining?: number;
}

export type OwnTurnScreenProps =
  OwnTurnHandoffProps | OwnTurnActiveProps | OwnTurnWatchingProps;

const teamNumbers: Record<TeamId, 1 | 2> = {
  team1: 1,
  team2: 2,
};

function TurnTopBar({
  round,
  connectionState,
  onRetry,
  headerActions,
}: {
  round: RoundNumber;
  connectionState: ConnectionStatusState;
  onRetry?: () => void;
  headerActions?: ReactNode;
}) {
  return (
    <TopBar
      meta={<RoundPips round={round} />}
      trailing={
        <>
          {headerActions}
          <ConnectionStatus state={connectionState} onRetry={onRetry} />
        </>
      }
    >
      <Brand compact />
    </TopBar>
  );
}

function PublicHud({
  currentTeam,
  clueGiverName,
  remainingCardCount,
  scores,
}: Pick<
  OwnTurnBaseProps,
  'currentTeam' | 'clueGiverName' | 'remainingCardCount' | 'scores'
>) {
  const teamNumber = teamNumbers[currentTeam];

  return (
    <dl className={styles.publicHud}>
      <div>
        <dt>Giliran</dt>
        <dd>
          <span className={styles.teamDot} aria-hidden="true" />
          Tim {teamNumber}
        </dd>
      </div>
      <div>
        <dt>Pemberi clue</dt>
        <dd>{clueGiverName ?? 'Nunggu player'}</dd>
      </div>
      <div>
        <dt>Kartu tersisa</dt>
        <dd>{remainingCardCount}</dd>
      </div>
      <div>
        <dt>Skor</dt>
        <dd>
          {scores.team1} <span>–</span> {scores.team2}
        </dd>
      </div>
    </dl>
  );
}

function getWatchingCopy(props: OwnTurnWatchingProps) {
  const clueGiver = props.clueGiverName ?? 'pemberi clue';

  switch (props.status) {
    case 'waiting-for-start':
      return {
        eyebrow: 'Pemberi clue lagi siap-siap',
        title: `Nunggu ${clueGiver}.`,
        body: 'Giliran dimulai dari device pemberi clue. Kartunya tetap rahasia selama giliran.',
      };
    case 'active':
      return {
        eyebrow: `Tim ${teamNumbers[props.currentTeam]} lagi main`,
        title: `${clueGiver} lagi kasih clue.`,
        body: 'Tebak bareng timmu. Cuma pemberi clue yang bisa lihat dan kontrol kartu.',
      };
    case 'waiting-for-clue-giver':
      return {
        eyebrow: 'Player offline',
        title: `Nunggu ${clueGiver} balik.`,
        body: !props.inactivityTimeoutEnabled
          ? 'Giliran ditahan sampai device-nya online lagi.'
          : props.reconnectSecondsRemaining === undefined
            ? 'Giliran bakal pindah kalau pemberi clue nggak segera online lagi.'
            : `Giliran pindah dalam ${props.reconnectSecondsRemaining} detik kalau device-nya masih offline.`,
      };
    case 'team-offline':
      return {
        eyebrow: 'Giliran di-pause',
        title: `Tim ${teamNumbers[props.currentTeam]} lagi offline.`,
        body: 'Game lanjut saat minimal satu player dari tim ini online lagi.',
      };
  }
}

export function OwnTurnScreen(props: OwnTurnScreenProps) {
  const {
    round,
    currentTeam,
    clueGiverName,
    remainingCardCount,
    scores,
    connectionState = 'connected',
    onRetry,
    headerActions,
    actionsDisabled = false,
    containerRef,
  } = props;
  const teamNumber = teamNumbers[currentTeam];
  const mutationsDisabled = actionsDisabled || connectionState !== 'connected';

  if (props.view === 'handoff') {
    const roundDetails = ROUND_DETAILS[round];

    return (
      <GameShell variant="turn" team={teamNumber}>
        <ScreenFrame
          ref={containerRef}
          className={styles.handoffScreen}
          tabIndex={-1}
        >
          <TurnTopBar
            round={round}
            connectionState={connectionState}
            onRetry={onRetry}
            headerActions={headerActions}
          />

          <main className={styles.handoffMain}>
            <section className={styles.handoffIntro}>
              <Eyebrow onDark>
                Ronde {round} · {roundDetails.name}
              </Eyebrow>
              <h1>
                {clueGiverName ?? 'Giliranmu'},<span>kasih clue.</span>
              </h1>
              <p>{roundDetails.instruction}</p>
              <div className={styles.ruleNote}>
                <span>0{round}</span>
                <p>
                  <strong>{roundDetails.shortName}</strong>
                  {roundDetails.example}
                </p>
              </div>
            </section>

            <Panel as="section" className={styles.handoffTicket}>
              <span className={styles.privateLabel}>Cuma di device-mu</span>
              <h2>Kamu pemberi clue.</h2>
              <p>
                Pastikan timmu ready. Kartu pertama muncul setelah giliran
                mulai.
              </p>
              <dl>
                <div>
                  <dt>Tim</dt>
                  <dd>{teamNumber}</dd>
                </div>
                <div>
                  <dt>Kartu</dt>
                  <dd>{remainingCardCount}</dd>
                </div>
                <div>
                  <dt>Waktu</dt>
                  <dd>{ROUND_DURATION_SECONDS}</dd>
                </div>
              </dl>
              <GameButton
                type="button"
                onClick={props.onStart}
                disabled={!props.canStart || mutationsDisabled}
              >
                Gas {ROUND_DURATION_SECONDS} detik
                <MaterialSymbol name="arrow_forward" />
              </GameButton>
            </Panel>
          </main>
        </ScreenFrame>
      </GameShell>
    );
  }

  if (props.view === 'watching') {
    const copy = getWatchingCopy(props);
    const showTimer =
      props.status === 'active' && props.secondsRemaining !== undefined;

    return (
      <GameShell variant="turn" team={teamNumber}>
        <ScreenFrame
          ref={containerRef}
          className={styles.watchingScreen}
          tabIndex={-1}
        >
          <TurnTopBar
            round={round}
            connectionState={connectionState}
            onRetry={onRetry}
            headerActions={headerActions}
          />

          <main className={styles.watchingMain}>
            <PublicHud
              currentTeam={currentTeam}
              clueGiverName={clueGiverName}
              remainingCardCount={remainingCardCount}
              scores={scores}
            />

            <section className={styles.watchingCopy} aria-live="polite">
              {showTimer ? (
                <div
                  className={cn(
                    styles.publicTimer,
                    props.secondsRemaining !== undefined &&
                      props.secondsRemaining <= 10 &&
                      styles.urgentTimer
                  )}
                  aria-label={`${props.secondsRemaining} detik tersisa`}
                >
                  <strong>{props.secondsRemaining}</strong>
                  <span>detik</span>
                </div>
              ) : (
                <MaterialSymbol
                  name={
                    props.status === 'team-offline' ? 'pause' : 'more_horiz'
                  }
                  className={styles.waitingIcon}
                  filled={props.status === 'team-offline'}
                />
              )}
              <Eyebrow onDark>{copy.eyebrow}</Eyebrow>
              <h1>{copy.title}</h1>
              <p>{copy.body}</p>
            </section>

            <p className={styles.privacyNote}>
              <MaterialSymbol name="visibility_off" />
              Kartu disembunyikan di device penonton.
            </p>
          </main>
        </ScreenFrame>
      </GameShell>
    );
  }

  const duration = props.turnDurationSeconds ?? ROUND_DURATION_SECONDS;
  const timerProgress = Math.max(
    0,
    Math.min(360, (props.secondsRemaining / duration) * 360)
  );
  const timerStyle = {
    '--timer-progress': `${timerProgress}deg`,
  } as CSSProperties;

  return (
    <GameShell variant="play" team={teamNumber}>
      <ScreenFrame
        ref={containerRef}
        className={styles.activeScreen}
        tabIndex={-1}
      >
        <TurnTopBar
          round={round}
          connectionState={connectionState}
          onRetry={onRetry}
          headerActions={headerActions}
        />

        <div className={styles.activeHud}>
          <div className={styles.activeTeam}>
            <span className={styles.teamDot} aria-hidden="true" />
            <span>
              Tim {teamNumber}
              <small>{clueGiverName ?? 'Pemberi clue'}</small>
            </span>
          </div>

          <div
            className={cn(
              styles.timerDial,
              props.secondsRemaining <= 10 && styles.urgentTimer
            )}
            style={timerStyle}
            aria-label={`${props.secondsRemaining} detik tersisa`}
            role="timer"
          >
            <strong>{props.secondsRemaining}</strong>
            <span>detik</span>
          </div>

          <div className={styles.cardsLeft}>
            <strong>{remainingCardCount}</strong>
            <span>kartu tersisa</span>
          </div>
        </div>

        <main className={styles.cardStage}>
          <Panel
            as="article"
            className={styles.activeCard}
            data-level={props.card.level}
            aria-live="polite"
          >
            <div className={styles.cardTopline}>
              <span>Level {props.card.level}</span>
              <span>Ronde 0{round}</span>
            </div>
            <div className={styles.cardCopy}>
              <p>Bikin timmu nebak</p>
              <h1>{props.card.word}</h1>
              <span>{props.card.description}</span>
            </div>
            <div className={styles.cardFooter}>
              <span>Monikers</span>
              <span>Kartu sekarang</span>
            </div>
          </Panel>
        </main>

        <div className={styles.activeActions}>
          <div>
            <GameButton
              type="button"
              variant="secondary"
              onClick={() => props.onSkip(props.card.word)}
              disabled={!props.canSkip || mutationsDisabled}
            >
              <MaterialSymbol name="skip_next" />
              {props.canSkip ? 'Skip' : 'Skip terkunci'}
            </GameButton>
            <GameButton
              type="button"
              variant="success"
              onClick={() => props.onMarkCorrect(props.card.word)}
              disabled={!props.canMarkCorrect || mutationsDisabled}
            >
              Benar!
              <MaterialSymbol name="check" filled />
            </GameButton>
          </div>
          <button
            type="button"
            className={styles.endTurn}
            onClick={props.onEnd}
            disabled={!props.canEnd || mutationsDisabled}
          >
            Stop giliran
          </button>
        </div>
      </ScreenFrame>
    </GameShell>
  );
}
