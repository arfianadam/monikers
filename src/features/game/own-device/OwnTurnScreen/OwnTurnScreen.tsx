'use client';

import type { CSSProperties, Ref } from 'react';

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
  connectionState?: ConnectionStatusState;
  onRetry?: () => void;
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
}: {
  round: RoundNumber;
  connectionState: ConnectionStatusState;
  onRetry?: () => void;
}) {
  return (
    <TopBar
      meta={<RoundPips round={round} />}
      trailing={<ConnectionStatus state={connectionState} onRetry={onRetry} />}
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
        <dt>Pemberi petunjuk</dt>
        <dd>{clueGiverName ?? 'Menunggu pemain'}</dd>
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
  const clueGiver = props.clueGiverName ?? 'Pemberi petunjuk';

  switch (props.status) {
    case 'waiting-for-start':
      return {
        eyebrow: 'Pemberi petunjuk bersiap',
        title: `Menunggu ${clueGiver}.`,
        body: 'Giliran akan dimulai dari perangkat pemberi petunjuk. Kartu tetap rahasia di perangkat ini sepanjang giliran.',
      };
    case 'active':
      return {
        eyebrow: `Tim ${teamNumbers[props.currentTeam]} sedang bermain`,
        title: `${clueGiver} memberi petunjuk.`,
        body: 'Tebak bersama timmu. Hanya pemberi petunjuk yang dapat melihat dan mengendalikan kartu.',
      };
    case 'waiting-for-clue-giver':
      return {
        eyebrow: 'Koneksi pemain terputus',
        title: `Menunggu ${clueGiver} kembali.`,
        body:
          props.reconnectSecondsRemaining === undefined
            ? 'Giliran akan berpindah jika pemberi petunjuk tidak segera tersambung kembali.'
            : `Giliran akan berpindah dalam ${props.reconnectSecondsRemaining} detik jika perangkatnya belum tersambung.`,
      };
    case 'team-offline':
      return {
        eyebrow: 'Giliran dijeda',
        title: `Tim ${teamNumbers[props.currentTeam]} belum tersambung.`,
        body: 'Permainan akan dilanjutkan ketika setidaknya satu pemain dari tim ini kembali tersambung.',
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
          />

          <main className={styles.handoffMain}>
            <section className={styles.handoffIntro}>
              <Eyebrow onDark>
                Babak {round} · {roundDetails.name}
              </Eyebrow>
              <h1>
                {clueGiverName ?? 'Giliranmu'},<span>beri petunjuk.</span>
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
              <span className={styles.privateLabel}>Khusus perangkatmu</span>
              <h2>Kamu pemberi petunjuk.</h2>
              <p>
                Pastikan teman satu tim siap. Kartu pertama baru dikirim setelah
                giliran dimulai.
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
                Mulai giliran {ROUND_DURATION_SECONDS} detik
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
              Kartu tidak ditampilkan di perangkat penonton.
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
        />

        <div className={styles.activeHud}>
          <div className={styles.activeTeam}>
            <span className={styles.teamDot} aria-hidden="true" />
            <span>
              Tim {teamNumber}
              <small>{clueGiverName ?? 'Pemberi petunjuk'}</small>
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
              <span>Tingkat {props.card.level}</span>
              <span>Babak 0{round}</span>
            </div>
            <div className={styles.cardCopy}>
              <p>Buat timmu menebak</p>
              <h1>{props.card.word}</h1>
              <span>{props.card.description}</span>
            </div>
            <div className={styles.cardFooter}>
              <span>Monikers</span>
              <span>Kartu saat ini</span>
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
              {props.canSkip ? 'Lewati' : 'Lewati terkunci'}
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
            Akhiri giliran lebih awal
          </button>
        </div>
      </ScreenFrame>
    </GameShell>
  );
}
