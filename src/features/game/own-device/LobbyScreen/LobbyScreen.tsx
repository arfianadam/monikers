'use client';

import type { Ref } from 'react';

import type { TeamId } from '@/features/game/domain/game-types';
import { cn } from '@/lib/utils';
import { Brand } from '@/shared/ui/Brand/Brand';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { Input } from '@/shared/ui/Input/Input';
import { Panel } from '@/shared/ui/Panel/Panel';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import {
  ConnectionStatus,
  type OwnDeviceConnectionState,
} from '../ConnectionStatus/ConnectionStatus';
import styles from './LobbyScreen.module.css';

export type LobbyPlayerPresence = 'connected' | 'disconnected';
export type LobbyCodeCopyState = 'idle' | 'copied' | 'failed';
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

export interface LobbyScreenProps {
  joinCode: string;
  teams: LobbyTeamsView;
  cardsPerPlayer: number;
  canStart: boolean;
  isController: boolean;
  onSetReady: (ready: boolean) => void;
  onCopyCode: () => void;
  onStart: () => void;
  onLeave: () => void;
  onCardsPerPlayerChange?: (cardsPerPlayer: number) => void;
  onRotateCode?: () => void;
  onMovePlayer?: (playerId: string, destination: TeamId) => void;
  onReorderPlayer?: (
    playerId: string,
    direction: LobbyReorderDirection
  ) => void;
  onRemovePlayer?: (playerId: string) => void;
  onEndSession?: () => void;
  connectionState?: OwnDeviceConnectionState;
  onRetry?: () => void;
  controlsDisabled?: boolean;
  codeCopyState?: LobbyCodeCopyState;
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

const copyMessages: Record<LobbyCodeCopyState, string> = {
  idle: '',
  copied: 'Kode disalin.',
  failed: 'Kode belum dapat disalin.',
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
  canStart,
  isController,
  onSetReady,
  onCopyCode,
  onStart,
  onLeave,
  onCardsPerPlayerChange,
  onRotateCode,
  onMovePlayer,
  onReorderPlayer,
  onRemovePlayer,
  onEndSession,
  connectionState = 'connected',
  onRetry,
  controlsDisabled = false,
  codeCopyState = 'idle',
  startBlockers = [],
  rename,
  containerRef,
}: LobbyScreenProps) {
  const currentPlayer = findCurrentPlayer(teams);
  const playerCount = teams.team1.length + teams.team2.length;
  const mutationsDisabled = controlsDisabled || connectionState !== 'connected';

  return (
    <GameShell variant="setup">
      <ScreenFrame ref={containerRef} className={styles.screen} tabIndex={-1}>
        <TopBar className={styles.topBar}>
          <Brand compact />
          <ConnectionStatus state={connectionState} onRetry={onRetry} />
        </TopBar>

        <main className={styles.main}>
          <section className={styles.heading}>
            <div>
              <Eyebrow onDark>
                Ruang tunggu · {playerCount} dari 20 pemain
              </Eyebrow>
              <h1>Susun kedua tim.</h1>
              <p>
                Bagikan kode, atur urutan pemain, lalu tandai siap saat semua
                orang sudah memegang perangkatnya.
              </p>
            </div>

            <Panel
              as="section"
              className={styles.codeCard}
              aria-label="Kode sesi"
            >
              <span>Kode sesi</span>
              <output aria-label={`Kode sesi ${joinCode}`}>{joinCode}</output>
              <div className={styles.codeActions}>
                <button type="button" onClick={onCopyCode}>
                  <span aria-hidden="true">⧉</span>
                  Salin kode
                </button>
                {isController && onRotateCode && (
                  <button
                    type="button"
                    onClick={onRotateCode}
                    disabled={mutationsDisabled}
                  >
                    <span aria-hidden="true">↻</span>
                    Ganti kode
                  </button>
                )}
              </div>
              <p className={styles.copyStatus} role="status" aria-live="polite">
                {copyMessages[codeCopyState]}
              </p>
            </Panel>
          </section>

          <section
            className={styles.configuration}
            aria-labelledby="game-settings"
          >
            <div>
              <h2 id="game-settings">Pengaturan permainan</h2>
              <p>Jumlah pemain mengikuti orang yang sudah bergabung.</p>
            </div>
            <dl className={styles.configStats}>
              <div>
                <dt>Pemain</dt>
                <dd>{playerCount}</dd>
              </div>
              <div>
                <dt>Kartu per pemain</dt>
                <dd>
                  {isController && onCardsPerPlayerChange ? (
                    <span className={styles.stepper}>
                      <button
                        type="button"
                        onClick={() =>
                          onCardsPerPlayerChange(
                            Math.max(1, cardsPerPlayer - 1)
                          )
                        }
                        disabled={mutationsDisabled || cardsPerPlayer <= 1}
                        aria-label="Kurangi kartu per pemain"
                      >
                        −
                      </button>
                      <output aria-live="polite">{cardsPerPlayer}</output>
                      <button
                        type="button"
                        onClick={() =>
                          onCardsPerPlayerChange(
                            Math.min(10, cardsPerPlayer + 1)
                          )
                        }
                        disabled={mutationsDisabled || cardsPerPlayer >= 10}
                        aria-label="Tambah kartu per pemain"
                      >
                        +
                      </button>
                    </span>
                  ) : (
                    cardsPerPlayer
                  )}
                </dd>
              </div>
            </dl>

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
                  {rename.isSubmitting ? 'Menyimpan…' : 'Simpan nama'}
                </button>
                {rename.errorMessage && (
                  <span id="lobby-name-error" role="alert">
                    {rename.errorMessage}
                  </span>
                )}
              </form>
            )}
          </section>

          <section className={styles.teams} aria-label="Susunan tim">
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
                        <p>{teamPlayers.length} pemain · urutan giliran</p>
                      </div>
                    </div>
                    <span className={styles.readyTotal}>
                      {teamPlayers.filter((player) => player.ready).length}/
                      {teamPlayers.length} siap
                    </span>
                  </header>

                  {teamPlayers.length === 0 ? (
                    <p className={styles.emptyTeam}>
                      Tim ini belum memiliki pemain.
                    </p>
                  ) : (
                    <ol className={styles.playerList}>
                      {teamPlayers.map((player, playerIndex) => {
                        const destination = otherTeam[teamId];
                        const canManage = isController && !mutationsDisabled;

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
                                  ? 'Tersambung'
                                  : 'Terputus'}
                                {player.isController && ' · Pengendali'}
                              </span>
                            </span>
                            <span
                              className={cn(
                                styles.readyBadge,
                                player.ready && styles.ready
                              )}
                            >
                              {player.ready ? 'Siap' : 'Belum siap'}
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
                                  title="Naikkan urutan"
                                >
                                  ↑
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
                                  title="Turunkan urutan"
                                >
                                  ↓
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
                                  →{teamNumbers[destination]}
                                </button>
                                {player.canRemove && (
                                  <button
                                    type="button"
                                    className={styles.removePlayer}
                                    onClick={() => onRemovePlayer?.(player.id)}
                                    disabled={!canManage || !onRemovePlayer}
                                    aria-label={`Keluarkan ${player.displayName} dari sesi`}
                                    title="Keluarkan pemain"
                                  >
                                    ×
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

          <Panel as="section" className={styles.readyPanel}>
            <div className={styles.readyCopy}>
              <Eyebrow>Status ruangan</Eyebrow>
              <h2>
                {canStart ? 'Semua siap bermain.' : 'Masih menunggu pemain.'}
              </h2>
              {!canStart && (
                <ul>
                  {(startBlockers.length > 0
                    ? startBlockers
                    : ['Kedua tim, koneksi, dan kesiapan harus lengkap.']
                  ).map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.readyActions}>
              {currentPlayer && (
                <GameButton
                  type="button"
                  variant={currentPlayer.ready ? 'secondary' : 'success'}
                  onClick={() => onSetReady(!currentPlayer.ready)}
                  disabled={mutationsDisabled}
                >
                  {currentPlayer.ready ? 'Batalkan siap' : 'Saya siap'}
                  <span aria-hidden="true">
                    {currentPlayer.ready ? '↶' : '✓'}
                  </span>
                </GameButton>
              )}

              {isController ? (
                <GameButton
                  type="button"
                  onClick={onStart}
                  disabled={!canStart || mutationsDisabled}
                >
                  Mulai pilih kartu
                  <span aria-hidden="true">→</span>
                </GameButton>
              ) : (
                <p>Pengendali akan memulai setelah semua pemain siap.</p>
              )}
            </div>
          </Panel>

          <footer className={styles.sessionActions}>
            <button
              type="button"
              onClick={onLeave}
              disabled={mutationsDisabled}
            >
              Tinggalkan sesi
            </button>
            {isController && onEndSession && (
              <button
                type="button"
                className={styles.endSession}
                onClick={onEndSession}
                disabled={mutationsDisabled}
              >
                Akhiri sesi untuk semua
              </button>
            )}
          </footer>
        </main>
      </ScreenFrame>
    </GameShell>
  );
}
