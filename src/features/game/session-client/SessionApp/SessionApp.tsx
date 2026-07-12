'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

import { CardPicker } from '@/features/game/card-selection/CardPicker/CardPicker';
import { PrivateHandoff } from '@/features/game/card-selection/PrivateHandoff/PrivateHandoff';
import type { TeamId } from '@/features/game/domain/game-types';
import type {
  LobbyProjection,
  SelectionProjection,
  ServerEvent,
  TurnProjection,
} from '@/features/game/session-protocol/types';
import { ScoreView } from '@/features/game/score/ScoreScreen/ScoreView';
import { SetupView } from '@/features/game/setup/SetupScreen/SetupView';
import { ActiveTurn } from '@/features/game/turn/ActiveTurn/ActiveTurn';
import { TurnHandoff } from '@/features/game/turn/TurnHandoff/TurnHandoff';
import { useGameSounds } from '@/features/game/turn/useGameSounds';
import { useLeaveGuard } from '@/features/game/turn/useLeaveGuard';
import {
  LobbyScreen,
  type LobbyCodeCopyState,
  type LobbyPlayerView,
} from '@/features/game/own-device/LobbyScreen/LobbyScreen';
import { CreatorActivationScreen } from '@/features/game/own-device/CreatorActivationScreen/CreatorActivationScreen';
import { OwnSelectionScreen } from '@/features/game/own-device/OwnSelectionScreen/OwnSelectionScreen';
import { OwnTurnScreen } from '@/features/game/own-device/OwnTurnScreen/OwnTurnScreen';
import { RecoveryScreen } from '@/features/game/own-device/RecoveryScreen/RecoveryScreen';
import { useStageScroll } from '@/shared/hooks/useStageScroll/useStageScroll';
import { Brand } from '@/shared/ui/Brand/Brand';
import { ConnectionStatus } from '@/shared/ui/ConnectionStatus/ConnectionStatus';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { useServerCountdown } from '../useServerCountdown/useServerCountdown';
import {
  useSessionSocket,
  type SessionCommandInput,
} from '../useSessionSocket/useSessionSocket';
import { useWakeLock } from '../useWakeLock/useWakeLock';
import styles from './SessionApp.module.css';

type ConfirmationAction =
  | { type: 'leave' }
  | { type: 'end' }
  | { type: 'return-lobby' }
  | { type: 'cancel-selection' }
  | { type: 'remove-player'; playerId: string; displayName: string };

const confirmationCopy: Record<
  ConfirmationAction['type'],
  { title: string; description: string; label: string }
> = {
  leave: {
    title: 'Tinggalkan sesi?',
    description:
      'Keanggotaan perangkat ini akan dicabut dan tidak dapat dipakai untuk masuk kembali ke sesi yang sama.',
    label: 'Tinggalkan sesi',
  },
  end: {
    title: 'Akhiri sesi untuk semua?',
    description:
      'Permainan, kode, dan semua keanggotaan akan langsung dihapus. Tindakan ini tidak dapat dibatalkan.',
    label: 'Akhiri sesi',
  },
  'return-lobby': {
    title: 'Kembali ke ruang tunggu?',
    description:
      'Permainan yang sedang berjalan akan dibuang. Kode, pemain, tim, dan urutan tetap dipertahankan.',
    label: 'Kembali ke ruang tunggu',
  },
  'cancel-selection': {
    title: 'Batalkan pemilihan kartu?',
    description:
      'Semua tawaran dan pilihan akan dibuang. Pemilihan berikutnya akan membagikan kartu baru.',
    label: 'Batalkan pemilihan',
  },
  'remove-player': {
    title: 'Keluarkan pemain?',
    description:
      'Akses perangkat pemain ini akan dicabut dan kesiapan ruangan diatur ulang.',
    label: 'Keluarkan pemain',
  },
};

function SessionLoadingScreen({
  containerRef,
  connectionState,
  onRetry,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  connectionState: 'connecting' | 'connected' | 'disconnected';
  onRetry: () => void;
}) {
  return (
    <GameShell variant="handoff" aria-busy="true">
      <ScreenFrame ref={containerRef} className={styles.loadingScreen}>
        <TopBar
          trailing={
            <ConnectionStatus state={connectionState} onRetry={onRetry} />
          }
        >
          <Brand compact />
        </TopBar>
        <main className={styles.loadingMain}>
          <p role="status">Menyiapkan sesi…</p>
        </main>
      </ScreenFrame>
    </GameShell>
  );
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.readOnly = true;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Clipboard unavailable');
}

function buildLobbyTeams(projection: LobbyProjection) {
  const participants = new Map(
    projection.participants.map((participant) => [participant.id, participant])
  );
  const build = (team: TeamId): LobbyPlayerView[] =>
    projection.teamOrder[team]
      .map((id) => participants.get(id))
      .filter((participant) => participant !== undefined)
      .map((participant) => ({
        id: participant.id,
        displayName: participant.displayName,
        ready: participant.ready,
        presence:
          participant.presence === 'connected'
            ? ('connected' as const)
            : ('disconnected' as const),
        isController: participant.isController,
        isCurrentPlayer: participant.id === projection.recipientId,
        canRemove: participant.id !== projection.recipientId,
      }));

  return { team1: build('team1'), team2: build('team2') };
}

function lobbyBlockers(projection: LobbyProjection) {
  const blockers: string[] = [];
  const team1Size = projection.teamOrder.team1.length;
  const team2Size = projection.teamOrder.team2.length;
  if (projection.participants.length < 2)
    blockers.push('Tunggu satu pemain lagi.');
  if (team1Size === 0 || team2Size === 0) {
    blockers.push('Kedua tim harus memiliki pemain.');
  }
  if (Math.abs(team1Size - team2Size) > 1) {
    blockers.push('Selisih jumlah pemain antartim maksimal satu.');
  }
  if (
    projection.participants.some(
      (participant) => participant.presence !== 'connected'
    )
  ) {
    blockers.push('Semua pemain harus tersambung.');
  }
  if (projection.participants.some((participant) => !participant.ready)) {
    blockers.push('Semua pemain harus menandai siap.');
  }
  return blockers;
}

function SingleTurnView({
  projection,
  disabled,
  connectionStatus,
  sendCommand,
  containerRef,
}: {
  projection: TurnProjection;
  disabled: boolean;
  connectionStatus: React.ReactNode;
  sendCommand: (command: SessionCommandInput) => string | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const seconds = useServerCountdown(
    projection.turnEndsAt,
    projection.serverTime
  );
  const controls = projection.controls;
  const teamNumber = projection.currentTeam === 'team1' ? 1 : 2;
  const initialCardCount = projection.initialCardCount;

  if (!projection.turnActive) {
    return (
      <TurnHandoff
        round={projection.round}
        currentTeamNumber={teamNumber}
        remainingCardCount={projection.remainingCardCount}
        initialCardCount={initialCardCount}
        currentTeamScore={projection.scores[projection.currentTeam].total}
        disabled={disabled}
        connectionStatus={connectionStatus}
        containerRef={containerRef}
        onStart={() =>
          sendCommand({ type: 'start-turn', turnId: projection.turnId })
        }
      />
    );
  }

  if (!projection.card) {
    return (
      <RecoveryScreen
        reason="connecting"
        onRetry={() => window.location.reload()}
        onGoHome={() => window.location.assign('/')}
        detailMessage="Kartu aktif sedang dipulihkan dari server."
      />
    );
  }

  return (
    <ActiveTurn
      round={projection.round}
      currentTeamNumber={teamNumber}
      timer={seconds}
      activeCard={projection.card}
      remainingCardCount={projection.remainingCardCount}
      initialCardCount={initialCardCount}
      guessedCardCount={projection.guessedCardCount}
      canSkip={Boolean(controls?.canSkip)}
      isGuessDisabled={disabled || !controls?.canMarkCorrect}
      actionsDisabled={disabled}
      connectionStatus={connectionStatus}
      containerRef={containerRef}
      onSkip={() =>
        sendCommand({
          type: 'skip',
          turnId: projection.turnId,
          cardWord: projection.card!.word,
        })
      }
      onGuess={() =>
        sendCommand({
          type: 'correct',
          turnId: projection.turnId,
          cardWord: projection.card!.word,
        })
      }
      onEndTurn={() =>
        sendCommand({ type: 'end-turn', turnId: projection.turnId })
      }
    />
  );
}

function OwnTurnView({
  projection,
  disabled,
  connectionState,
  sendCommand,
  containerRef,
  onRetry,
}: {
  projection: TurnProjection;
  disabled: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected';
  sendCommand: (command: SessionCommandInput) => string | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onRetry: () => void;
}) {
  const seconds = useServerCountdown(
    projection.turnEndsAt,
    projection.serverTime
  );
  const graceSeconds = useServerCountdown(
    projection.clueGiverWaitEndsAt,
    projection.serverTime
  );
  const common = {
    round: projection.round,
    currentTeam: projection.currentTeam,
    clueGiverName: projection.clueGiverName,
    remainingCardCount: projection.remainingCardCount,
    scores: {
      team1: projection.scores.team1.total,
      team2: projection.scores.team2.total,
    },
    connectionState,
    actionsDisabled: disabled,
    containerRef,
    onRetry,
  } as const;
  const controls = projection.controls;

  if (!projection.turnActive && controls?.canStart) {
    return (
      <OwnTurnScreen
        {...common}
        view="handoff"
        canStart
        onStart={() =>
          sendCommand({ type: 'start-turn', turnId: projection.turnId })
        }
      />
    );
  }

  if (projection.turnActive && projection.card && controls) {
    return (
      <OwnTurnScreen
        {...common}
        view="active"
        card={projection.card}
        secondsRemaining={seconds}
        canMarkCorrect={controls.canMarkCorrect}
        canSkip={controls.canSkip}
        canEnd={controls.canEnd}
        onMarkCorrect={(cardWord) =>
          sendCommand({
            type: 'correct',
            turnId: projection.turnId,
            cardWord,
          })
        }
        onSkip={(cardWord) =>
          sendCommand({
            type: 'skip',
            turnId: projection.turnId,
            cardWord,
          })
        }
        onEnd={() =>
          sendCommand({ type: 'end-turn', turnId: projection.turnId })
        }
      />
    );
  }

  const watchingStatus = projection.clueGiverWaitEndsAt
    ? 'waiting-for-clue-giver'
    : projection.clueGiverId === null
      ? 'team-offline'
      : projection.turnActive
        ? 'active'
        : 'waiting-for-start';

  return (
    <OwnTurnScreen
      {...common}
      view="watching"
      status={watchingStatus}
      secondsRemaining={seconds}
      reconnectSecondsRemaining={graceSeconds}
    />
  );
}

export function SessionApp({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const viewContainerRef = useRef<HTMLDivElement>(null);
  const [activationName, setActivationName] = useState('');
  const [activationError, setActivationError] = useState('');
  const [activating, setActivating] = useState(false);
  const [copyState, setCopyState] = useState<LobbyCodeCopyState>('idle');
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationAction | null>(
    null
  );
  const [endingSession, setEndingSession] = useState(false);
  const { playBell, playRing } = useGameSounds();
  const handleServerEvent = useCallback(
    (event: ServerEvent) => {
      if (event.type !== 'sound') return;
      if (event.sound === 'bell') playBell();
      else playRing();
    },
    [playBell, playRing]
  );
  const connection = useSessionSocket({
    sessionId,
    onEvent: handleServerEvent,
  });
  const projection = connection.projection;
  const viewKey = connection.recoveryReason
    ? `recovery:${connection.recoveryReason}`
    : projection
      ? `${projection.phase}:${projection.phase === 'selection' ? (projection.currentPlayer ?? projection.confirmed) : ''}:${projection.phase === 'turn' ? `${projection.turnId}:${projection.turnActive}` : ''}`
      : connection.status;

  useLeaveGuard();
  useStageScroll(viewKey);
  useWakeLock(
    projection?.mode === 'own-device' &&
      (projection.phase === 'selection' ||
        projection.phase === 'turn' ||
        projection.phase === 'round-score')
  );

  const controlsDisabled =
    connection.status !== 'connected' || connection.pendingCommandCount > 0;

  const performHttpAction = async (action: 'leave' | 'end') => {
    const response = await fetch(
      `/session/${encodeURIComponent(sessionId)}/actions/${action}`,
      { method: 'POST' }
    );
    const body = (await response.json()) as { route?: string; error?: string };
    if (!response.ok) throw new Error(body.error || 'Tindakan belum berhasil.');
    router.replace(body.route ?? '/');
  };

  const executeConfirmation = () => {
    if (!confirmation || !projection) return;
    const action = confirmation;

    if (action.type === 'end') {
      setEndingSession(true);
      void performHttpAction(action.type).catch(() => {
        setEndingSession(false);
        setConfirmation(null);
        connection.retry();
      });
      return;
    }

    setConfirmation(null);
    if (action.type === 'leave') {
      void performHttpAction(action.type).catch(() => connection.retry());
      return;
    }
    if (action.type === 'return-lobby') {
      connection.sendCommand({ type: 'return-lobby' });
      return;
    }
    if (
      action.type === 'cancel-selection' &&
      projection.phase === 'selection'
    ) {
      connection.sendCommand({
        type: 'cancel-selection',
        selectionId: projection.selectionId,
      });
      return;
    }
    if (action.type === 'remove-player') {
      connection.sendCommand({
        type: 'remove-player',
        playerId: action.playerId,
      });
    }
  };

  if (
    connection.recoveryReason &&
    !(endingSession && connection.recoveryReason === 'ended')
  ) {
    const reason =
      connection.recoveryReason === 'duplicate'
        ? 'duplicate-tab'
        : connection.recoveryReason;
    return (
      <RecoveryScreen
        reason={reason}
        onGoHome={() => router.replace('/')}
        containerRef={viewContainerRef}
      />
    );
  }

  if (!projection) {
    if (connection.status !== 'disconnected') {
      return (
        <SessionLoadingScreen
          connectionState={connection.status}
          onRetry={connection.retry}
          containerRef={viewContainerRef}
        />
      );
    }

    return (
      <RecoveryScreen
        reason="disconnected"
        onRetry={connection.retry}
        onGoHome={() => router.replace('/')}
        detailMessage={connection.lastError || undefined}
        containerRef={viewContainerRef}
      />
    );
  }

  const connectionStatus = (
    <ConnectionStatus state={connection.status} onRetry={connection.retry} />
  );
  let content: React.ReactNode;

  if (projection.phase === 'pending') {
    content = (
      <CreatorActivationScreen
        displayName={activationName}
        onDisplayNameChange={setActivationName}
        connectionState={connection.status}
        onRetry={connection.retry}
        isSubmitting={activating}
        errorMessage={activationError || connection.lastError}
        containerRef={viewContainerRef}
        onEndSession={() => setConfirmation({ type: 'end' })}
        onSubmit={() => {
          setActivating(true);
          setActivationError('');
          void fetch(
            `/session/${encodeURIComponent(sessionId)}/actions/activate`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ name: activationName }),
            }
          )
            .then(async (response) => {
              const body = (await response.json()) as { error?: string };
              if (!response.ok)
                throw new Error(body.error || 'Nama belum diterima.');
            })
            .catch((error: unknown) => {
              setActivationError(
                error instanceof Error ? error.message : 'Nama belum diterima.'
              );
            })
            .finally(() => setActivating(false));
        }}
      />
    );
  } else if (projection.phase === 'setup') {
    content = (
      <SetupView
        players={projection.configuration.players}
        cardsPerPlayer={projection.configuration.cardsPerPlayer}
        disabled={controlsDisabled}
        connectionStatus={connectionStatus}
        containerRef={viewContainerRef}
        onPlayersChange={(players) =>
          connection.sendCommand({ type: 'update-setup', players })
        }
        onCardsPerPlayerChange={(cardsPerPlayer) =>
          connection.sendCommand({ type: 'update-setup', cardsPerPlayer })
        }
        onStart={() => connection.sendCommand({ type: 'start-selection' })}
        onEndSession={() => setConfirmation({ type: 'end' })}
      />
    );
  } else if (projection.phase === 'lobby') {
    const teams = buildLobbyTeams(projection);
    const isController = projection.isController;
    const currentParticipant = projection.participants.find(
      (participant) => participant.id === projection.recipientId
    );
    content = (
      <LobbyScreen
        joinCode={projection.joinCode}
        teams={teams}
        cardsPerPlayer={projection.configuration.cardsPerPlayer}
        canStart={projection.roomReady}
        isController={isController}
        controlsDisabled={controlsDisabled}
        connectionState={connection.status}
        onRetry={connection.retry}
        codeCopyState={copyState}
        startBlockers={lobbyBlockers(projection)}
        rename={
          currentParticipant
            ? {
                value: renameDraft ?? currentParticipant.displayName,
                onChange: setRenameDraft,
                onSubmit: () => {
                  connection.sendCommand({
                    type: 'rename-player',
                    displayName: renameDraft ?? currentParticipant.displayName,
                  });
                  setRenameDraft(null);
                },
                isSubmitting: connection.pendingCommandCount > 0,
              }
            : undefined
        }
        containerRef={viewContainerRef}
        onSetReady={(ready) =>
          connection.sendCommand({ type: 'set-ready', ready })
        }
        onCopyCode={() => {
          void copyText(projection.joinCode)
            .then(() => setCopyState('copied'))
            .catch(() => setCopyState('failed'));
        }}
        onStart={() => connection.sendCommand({ type: 'start-selection' })}
        onLeave={() => setConfirmation({ type: 'leave' })}
        onCardsPerPlayerChange={
          isController
            ? (cardsPerPlayer) =>
                connection.sendCommand({
                  type: 'update-setup',
                  cardsPerPlayer,
                })
            : undefined
        }
        onRotateCode={
          isController
            ? () => connection.sendCommand({ type: 'rotate-code' })
            : undefined
        }
        onMovePlayer={
          isController
            ? (playerId, team) =>
                connection.sendCommand({ type: 'move-player', playerId, team })
            : undefined
        }
        onReorderPlayer={
          isController
            ? (playerId, direction) =>
                connection.sendCommand({
                  type: 'reorder-player',
                  playerId,
                  direction,
                })
            : undefined
        }
        onRemovePlayer={
          isController
            ? (playerId) => {
                const player = projection.participants.find(
                  (participant) => participant.id === playerId
                );
                setConfirmation({
                  type: 'remove-player',
                  playerId,
                  displayName: player?.displayName ?? 'pemain ini',
                });
              }
            : undefined
        }
        onEndSession={
          isController ? () => setConfirmation({ type: 'end' }) : undefined
        }
      />
    );
  } else if (projection.phase === 'selection') {
    content =
      projection.mode === 'single-device' ? (
        projection.canReveal ? (
          <PrivateHandoff
            currentPlayer={projection.currentPlayer ?? 1}
            players={projection.configuration.players}
            cardsPerPlayer={projection.configuration.cardsPerPlayer}
            disabled={controlsDisabled}
            connectionStatus={connectionStatus}
            onReady={() =>
              connection.sendCommand({
                type: 'reveal-single-offer',
                selectionId: projection.selectionId,
              })
            }
            containerRef={viewContainerRef}
          />
        ) : (
          <CardPicker
            currentPlayer={projection.currentPlayer ?? 1}
            players={projection.configuration.players}
            cardsPerPlayer={projection.configuration.cardsPerPlayer}
            availableCards={projection.offer ?? []}
            selectedCards={projection.draft ?? []}
            disabled={controlsDisabled}
            connectionStatus={connectionStatus}
            onToggleCard={(card) =>
              connection.sendCommand({
                type: 'toggle-card',
                selectionId: projection.selectionId,
                cardWord: card.word,
              })
            }
            onNextPlayer={() =>
              connection.sendCommand({
                type: 'confirm-selection',
                selectionId: projection.selectionId,
              })
            }
            containerRef={viewContainerRef}
          />
        )
      ) : (
        <OwnSelectionView
          projection={projection}
          disabled={controlsDisabled}
          connectionState={connection.status}
          sendCommand={connection.sendCommand}
          onCancel={() => setConfirmation({ type: 'cancel-selection' })}
          containerRef={viewContainerRef}
          onRetry={connection.retry}
        />
      );
  } else if (projection.phase === 'turn') {
    content =
      projection.mode === 'single-device' ? (
        <SingleTurnView
          projection={projection}
          disabled={controlsDisabled}
          connectionStatus={connectionStatus}
          sendCommand={connection.sendCommand}
          containerRef={viewContainerRef}
        />
      ) : (
        <OwnTurnView
          projection={projection}
          disabled={controlsDisabled}
          connectionState={connection.status}
          sendCommand={connection.sendCommand}
          containerRef={viewContainerRef}
          onRetry={connection.retry}
        />
      );
  } else if (
    projection.phase === 'round-score' ||
    projection.phase === 'final-score'
  ) {
    content = (
      <ScoreView
        scores={projection.scores}
        isGameOver={projection.phase === 'final-score'}
        canContinue={projection.canContinue}
        disabled={controlsDisabled}
        connectionStatus={connectionStatus}
        containerRef={viewContainerRef}
        onContinue={() =>
          connection.sendCommand({
            type: projection.phase === 'final-score' ? 'replay' : 'next-round',
          })
        }
      />
    );
  } else {
    content = (
      <RecoveryScreen reason="ended" onGoHome={() => router.replace('/')} />
    );
  }

  const showOwnSessionMenu =
    projection.mode === 'own-device' &&
    projection.phase !== 'pending' &&
    projection.phase !== 'lobby' &&
    projection.phase !== 'ended';
  const canReturnToLobby =
    projection.isController &&
    (projection.phase === 'selection' ||
      projection.phase === 'turn' ||
      projection.phase === 'round-score');
  const copy = confirmation ? confirmationCopy[confirmation.type] : null;

  return (
    <>
      {content}
      {showOwnSessionMenu && (
        <div className={styles.sessionMenu} aria-label="Tindakan sesi">
          <button
            type="button"
            onClick={() => setConfirmation({ type: 'leave' })}
            disabled={controlsDisabled}
          >
            Tinggalkan sesi
          </button>
          {canReturnToLobby && (
            <button
              type="button"
              onClick={() => setConfirmation({ type: 'return-lobby' })}
              disabled={controlsDisabled}
            >
              Kembali ke ruang tunggu
            </button>
          )}
          {projection.isController && (
            <button
              type="button"
              onClick={() => setConfirmation({ type: 'end' })}
              disabled={controlsDisabled}
            >
              Akhiri sesi
            </button>
          )}
        </div>
      )}
      {connection.lastError && connection.status !== 'disconnected' && (
        <button
          type="button"
          className={styles.errorNotice}
          onClick={connection.clearError}
          aria-label={`${connection.lastError} Tutup pesan.`}
        >
          {connection.lastError} <span aria-hidden="true">×</span>
        </button>
      )}
      {copy && (
        <ConfirmDialog
          open
          title={
            confirmation?.type === 'remove-player'
              ? `Keluarkan ${confirmation.displayName}?`
              : copy.title
          }
          description={copy.description}
          confirmLabel={
            endingSession && confirmation?.type === 'end'
              ? 'Mengakhiri sesi…'
              : copy.label
          }
          isSubmitting={endingSession && confirmation?.type === 'end'}
          onCancel={() => {
            if (!endingSession) setConfirmation(null);
          }}
          onConfirm={executeConfirmation}
        />
      )}
    </>
  );
}

function OwnSelectionView({
  projection,
  disabled,
  connectionState,
  sendCommand,
  onCancel,
  containerRef,
  onRetry,
}: {
  projection: SelectionProjection;
  disabled: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected';
  sendCommand: (command: SessionCommandInput) => string | null;
  onCancel: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onRetry: () => void;
}) {
  const playerName =
    projection.statuses.find(
      (status) => status.participantId === projection.recipientId
    )?.displayName ?? 'Pemain';
  const statuses = projection.statuses.map((status) => ({
    id: status.participantId,
    displayName: status.displayName,
    state: status.status,
    isCurrentPlayer: status.participantId === projection.recipientId,
  }));
  const common = {
    playerName,
    cardsPerPlayer: projection.configuration.cardsPerPlayer,
    statuses,
    connectionState,
    actionsDisabled: disabled,
    cancellation:
      projection.canCancel && projection.blockedParticipantIds.length > 0
        ? {
            onCancel,
            blockedPlayerNames: projection.blockedParticipantIds.map(
              (participantId) =>
                projection.statuses.find(
                  (status) => status.participantId === participantId
                )?.displayName ?? 'Pemain'
            ),
          }
        : undefined,
    containerRef,
    onRetry,
  } as const;

  if (projection.confirmed || !projection.canEdit) {
    return <OwnSelectionScreen {...common} view="waiting" />;
  }

  return (
    <OwnSelectionScreen
      {...common}
      view="editing"
      offer={projection.offer ?? []}
      draft={projection.draft ?? []}
      onToggleCard={(cardWord) =>
        sendCommand({
          type: 'toggle-card',
          selectionId: projection.selectionId,
          cardWord,
        })
      }
      onConfirm={() =>
        sendCommand({
          type: 'confirm-selection',
          selectionId: projection.selectionId,
        })
      }
    />
  );
}
