'use client';

import type { Ref } from 'react';

import type { TeamId } from '@/features/game/domain/game-types';
import { cn } from '@/lib/utils';
import { Brand } from '@/shared/ui/Brand/Brand';
import {
  ConnectionStatus,
  type ConnectionStatusState,
} from '@/shared/ui/ConnectionStatus/ConnectionStatus';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { Input } from '@/shared/ui/Input/Input';
import { MaterialSymbol } from '@/shared/ui/MaterialSymbol/MaterialSymbol';
import { NumberStepper } from '@/shared/ui/NumberStepper/NumberStepper';
import { Panel } from '@/shared/ui/Panel/Panel';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import styles from './LobbyScreen.module.css';

export type LobbyPlayerPresence = 'connected' | 'disconnected';
export type LobbyLinkCopyState = 'idle' | 'copied' | 'failed';
export type LobbyReorderDirection = 'up' | 'down';

export interface LobbyPlayerView {
  id: string;
  displayName: string;
  ready: boolean;
  presence: LobbyPlayerPresence;
  isController: boolean;
  isCurrentPlayer: boolean;
  canRemove?: boolean;
}

export type LobbyTeamsView = Record<TeamId, readonly LobbyPlayerView[]>;

export interface LobbyRenameView {
  value: string;
  onChange: (displayName: string) => void;
  onSubmit: () => void;
  errorMessage?: string | null;
  isSubmitting?: boolean;
}

export interface LobbyPendingActionsView {
  playerIds?: readonly string[];
  ready?: boolean;
  rotateCode?: boolean;
  inactivityTimeout?: boolean;
}

export interface LobbyScreenProps {
  joinCode: string;
  teams: LobbyTeamsView;
  cardsPerPlayer: number;
  inactivityTimeoutEnabled: boolean;
  canStart: boolean;
  isController: boolean;
  onSetReady: (ready: boolean) => void;
  onCopyLink: () => void;
  onStart: () => void;
  onLeave: () => void;
  onCardsPerPlayerChange?: (cardsPerPlayer: number) => void;
  onInactivityTimeoutChange?: (enabled: boolean) => void;
  onRotateCode?: () => void;
  onMovePlayer?: (playerId: string, destination: TeamId) => void;
  onReorderPlayer?: (
    playerId: string,
    direction: LobbyReorderDirection
  ) => void;
  onRemovePlayer?: (playerId: string) => void;
  onEndSession?: () => void;
  connectionState?: ConnectionStatusState;
  onRetry?: () => void;
  controlsDisabled?: boolean;
  pendingActions?: LobbyPendingActionsView;
  linkCopyState?: LobbyLinkCopyState;
  startBlockers?: readonly string[];
  rename?: LobbyRenameView;
  containerRef?: Ref<HTMLDivElement>;
}

const teamNumbers: Record<TeamId, 1 | 2> = {
  team1: 1,
  team2: 2,
};

const otherTeam: Record<TeamId, TeamId> = {
  team1: 'team2',
  team2: 'team1',
};

const copyMessages: Record<LobbyLinkCopyState, string> = {
  idle: '',
  copied: 'Link sudah di-copy!',
  failed: 'Oops, link belum bisa di-copy.',
};

function findCurrentPlayer(teams: LobbyTeamsView) {
  return [...teams.team1, ...teams.team2].find(
    (player) => player.isCurrentPlayer
  );
}

export function LobbyScreen({
  joinCode,
  teams,
  cardsPerPlayer,
  inactivityTimeoutEnabled,
  canStart,
  isController,
  onSetReady,
  onCopyLink,
  onStart,
  onLeave,
  onCardsPerPlayerChange,
  onInactivityTimeoutChange,
  onRotateCode,
  onMovePlayer,
  onReorderPlayer,
  onRemovePlayer,
  onEndSession,
  connectionState = 'connected',
  onRetry,
  controlsDisabled = false,
  pendingActions = {},
  linkCopyState = 'idle',
  startBlockers = [],
  rename,
  containerRef,
}: LobbyScreenProps) {
  const currentPlayer = findCurrentPlayer(teams);
  const playerCount = teams.team1.length + teams.team2.length;
  const mutationsDisabled = controlsDisabled || connectionState !== 'connected';
  const pendingPlayerIds = new Set(pendingActions.playerIds);
  const visibleStartBlockers =
    startBlockers.length > 0
      ? startBlockers
      : ['Pastikan kedua tim lengkap, online, dan siap.'];

  return (
    <GameShell variant="setup">
      <ScreenFrame ref={containerRef} className={styles.screen} tabIndex={-1}>
        <TopBar
          className={styles.topBar}
          trailing={
            <ConnectionStatus state={connectionState} onRetry={onRetry} />
          }
        >
          <Brand compact />
        </TopBar>

        <main className={styles.main}>
          <section className={styles.heading}>
            <div>
              <Eyebrow onDark>Lobby · {playerCount} dari 20 player</Eyebrow>
              <h1>Lobby</h1>
              <p>
                Share kode, atur urutan player, lalu klik siap kalau semua sudah
                pegang device masing-masing.
              </p>
            </div>

            <Panel
              as="section"
              className={styles.codeCard}
              aria-label="Room code"
            >
              <span>Room code</span>
              <output aria-label={`Room code ${joinCode}`}>{joinCode}</output>
              <div className={styles.codeActions}>
                <button type="button" onClick={onCopyLink}>
                  <MaterialSymbol name="content_copy" />
                  Copy link
                </button>
                {isController && onRotateCode && (
                  <button
                    type="button"
                    onClick={onRotateCode}
                    disabled={mutationsDisabled || pendingActions.rotateCode}
                  >
                    <MaterialSymbol name="refresh" />
                    Ganti kode
                  </button>
                )}
              </div>
              <p className={styles.copyStatus} role="status" aria-live="polite">
                {copyMessages[linkCopyState]}
              </p>
            </Panel>
          </section>

          <section
            className={styles.configuration}
            aria-labelledby="game-settings"
          >
            <div>
              <h2 id="game-settings">Game setup</h2>
              <p>Jumlah player mengikuti yang sudah join.</p>
            </div>
            <dl className={styles.configStats}>
              <div>
                <dt>Player</dt>
                <dd>{playerCount}</dd>
              </div>
              <div>
                <dt>Kartu per player</dt>
                <dd>
                  {isController && onCardsPerPlayerChange ? (
                    <NumberStepper
                      id="lobby-cards-per-player"
                      label="Kartu per player"
                      value={cardsPerPlayer}
                      min={1}
                      max={10}
                      disabled={mutationsDisabled}
                      onChange={onCardsPerPlayerChange}
                    />
                  ) : (
                    cardsPerPlayer
                  )}
                </dd>
              </div>
            </dl>

            <label className={styles.inactivityTimeoutOption}>
              <input
                type="checkbox"
                checked={inactivityTimeoutEnabled}
                onChange={(event) =>
                  onInactivityTimeoutChange?.(event.target.checked)
                }
                disabled={
                  !isController ||
                  !onInactivityTimeoutChange ||
                  mutationsDisabled ||
                  pendingActions.inactivityTimeout
                }
              />
              <span>
                <strong>Pakai timeout kalau player offline</strong>
                <small>
                  {isController
                    ? 'Kalau offline 30 detik, kontrol sesi atau giliran pindah ke player yang aktif.'
                    : 'Cuma host yang bisa mengubah setting ini.'}
                </small>
              </span>
            </label>

            {rename && (
              <form
                className={styles.renameForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  rename.onSubmit();
                }}
              >
                <label htmlFor="lobby-display-name">Namamu</label>
                <Input
                  id="lobby-display-name"
                  value={rename.value}
                  onChange={(event) => rename.onChange(event.target.value)}
                  autoComplete="nickname"
                  required
                  aria-invalid={Boolean(rename.errorMessage)}
                  aria-describedby={
                    rename.errorMessage ? 'lobby-name-error' : undefined
                  }
                />
                <button
                  type="submit"
                  disabled={
                    mutationsDisabled ||
                    rename.isSubmitting ||
                    !rename.value.trim()
                  }
                >
                  {rename.isSubmitting ? 'Lagi simpan…' : 'Simpan nama'}
                </button>
                {rename.errorMessage && (
                  <span id="lobby-name-error" role="alert">
                    {rename.errorMessage}
                  </span>
                )}
              </form>
            )}
          </section>

          <section className={styles.teams} aria-label="Lineup tim">
            {(['team1', 'team2'] as const).map((teamId) => {
              const teamPlayers = teams[teamId];
              const teamNumber = teamNumbers[teamId];

              return (
                <Panel
                  as="section"
                  className={styles.team}
                  data-team={teamNumber}
                  key={teamId}
                  aria-labelledby={`${teamId}-heading`}
                >
                  <header className={styles.teamHeader}>
                    <div>
                      <span className={styles.teamNumber} aria-hidden="true">
                        {teamNumber}
                      </span>
                      <div>
                        <h2 id={`${teamId}-heading`}>Tim {teamNumber}</h2>
                        <p>{teamPlayers.length} player · urutan main</p>
                      </div>
                    </div>
                    <span className={styles.readyTotal}>
                      {teamPlayers.filter((player) => player.ready).length}/
                      {teamPlayers.length} siap
                    </span>
                  </header>

                  {teamPlayers.length === 0 ? (
                    <p className={styles.emptyTeam}>
                      Belum ada player di tim ini.
                    </p>
                  ) : (
                    <ol className={styles.playerList}>
                      {teamPlayers.map((player, playerIndex) => {
                        const destination = otherTeam[teamId];
                        const canManage =
                          isController &&
                          !mutationsDisabled &&
                          !pendingPlayerIds.has(player.id);

                        return (
                          <li
                            className={cn(
                              styles.player,
                              player.isCurrentPlayer && styles.currentPlayer,
                              player.presence === 'disconnected' &&
                                styles.disconnectedPlayer
                            )}
                            key={player.id}
                          >
                            <span className={styles.order}>
                              {playerIndex + 1}
                            </span>
                            <span className={styles.playerIdentity}>
                              <strong>
                                {player.displayName}
                                {player.isCurrentPlayer && (
                                  <span className={styles.you}>kamu</span>
                                )}
                              </strong>
                              <span>
                                <span
                                  className={styles.presenceDot}
                                  aria-hidden="true"
                                />
                                {player.presence === 'connected'
                                  ? 'Online'
                                  : 'Offline'}
                                {player.isController && ' · Host'}
                              </span>
                            </span>
                            <span
                              className={cn(
                                styles.readyBadge,
                                player.ready && styles.ready
                              )}
                            >
                              {player.ready ? 'Ready' : 'Belum ready'}
                            </span>

                            {isController && (
                              <span className={styles.playerActions}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onReorderPlayer?.(player.id, 'up')
                                  }
                                  disabled={
                                    !canManage ||
                                    !onReorderPlayer ||
                                    playerIndex === 0
                                  }
                                  aria-label={`Naikkan ${player.displayName} dalam urutan Tim ${teamNumber}`}
                                  title="Geser ke atas"
                                >
                                  <MaterialSymbol name="arrow_upward" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onReorderPlayer?.(player.id, 'down')
                                  }
                                  disabled={
                                    !canManage ||
                                    !onReorderPlayer ||
                                    playerIndex === teamPlayers.length - 1
                                  }
                                  aria-label={`Turunkan ${player.displayName} dalam urutan Tim ${teamNumber}`}
                                  title="Geser ke bawah"
                                >
                                  <MaterialSymbol name="arrow_downward" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onMovePlayer?.(player.id, destination)
                                  }
                                  disabled={!canManage || !onMovePlayer}
                                  aria-label={`Pindahkan ${player.displayName} ke Tim ${teamNumbers[destination]}`}
                                  title={`Pindahkan ke Tim ${teamNumbers[destination]}`}
                                >
                                  <MaterialSymbol name="arrow_forward" />
                                  {teamNumbers[destination]}
                                </button>
                                {player.canRemove && (
                                  <button
                                    type="button"
                                    className={styles.removePlayer}
                                    onClick={() => onRemovePlayer?.(player.id)}
                                    disabled={!canManage || !onRemovePlayer}
                                    aria-label={`Keluarkan ${player.displayName} dari sesi`}
                                    title="Keluarkan player"
                                  >
                                    <MaterialSymbol name="person_remove" />
                                  </button>
                                )}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </Panel>
              );
            })}
          </section>

          <Panel
            as="section"
            className={styles.readyPanel}
            data-ready={canStart}
          >
            <div className={styles.readySummary}>
              <div className={styles.readyStatus} aria-live="polite">
                <span className={styles.readyStatusIcon}>
                  <MaterialSymbol
                    name={canStart ? 'check' : 'sync'}
                    filled={canStart}
                  />
                </span>
                <div className={styles.readyCopy}>
                  <Eyebrow>Room status</Eyebrow>
                  <h2>{canStart ? 'Semua ready!' : 'Nunggu semua ready.'}</h2>
                  <p>
                    {canStart
                      ? 'Game bisa langsung dimulai.'
                      : `Masih ada ${visibleStartBlockers.length} hal sebelum mulai.`}
                  </p>
                </div>
              </div>

              <div className={styles.readyActions}>
                {currentPlayer && (
                  <GameButton
                    type="button"
                    variant={currentPlayer.ready ? 'secondary' : 'success'}
                    onClick={() => onSetReady(!currentPlayer.ready)}
                    disabled={mutationsDisabled || pendingActions.ready}
                  >
                    {currentPlayer.ready ? 'Belum ready' : 'Aku ready'}
                    <MaterialSymbol
                      name={currentPlayer.ready ? 'undo' : 'check'}
                      filled={!currentPlayer.ready}
                    />
                  </GameButton>
                )}

                {isController ? (
                  <GameButton
                    type="button"
                    onClick={onStart}
                    disabled={!canStart || mutationsDisabled}
                  >
                    Mulai pilih kartu
                    <MaterialSymbol name="arrow_forward" />
                  </GameButton>
                ) : (
                  <p>Host akan mulai setelah semua player ready.</p>
                )}
              </div>
            </div>

            {!canStart && (
              <ul
                className={styles.readyBlockers}
                aria-label="Yang masih kurang"
              >
                {visibleStartBlockers.map((blocker, blockerIndex) => (
                  <li key={blocker}>
                    <span aria-hidden="true">{blockerIndex + 1}</span>
                    {blocker}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <footer className={styles.sessionActions}>
            <button
              type="button"
              onClick={onLeave}
              disabled={mutationsDisabled}
            >
              Keluar dari sesi
            </button>
            {isController && onEndSession && (
              <button
                type="button"
                className={styles.endSession}
                onClick={onEndSession}
                disabled={mutationsDisabled}
              >
                Tutup sesi buat semua
              </button>
            )}
          </footer>
        </main>
      </ScreenFrame>
    </GameShell>
  );
}
