import type { ReactNode, Ref } from 'react';

import { Brand } from '@/shared/ui/Brand/Brand';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { MaterialSymbol } from '@/shared/ui/MaterialSymbol/MaterialSymbol';
import { Panel } from '@/shared/ui/Panel/Panel';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import styles from './PrivateHandoff.module.css';

export interface PrivateHandoffProps {
  currentPlayer: number;
  players: number;
  cardsPerPlayer: number;
  disabled?: boolean;
  connectionStatus?: ReactNode;
  onReady: () => void;
  containerRef?: Ref<HTMLDivElement>;
}

export function PrivateHandoff({
  currentPlayer,
  players,
  cardsPerPlayer,
  disabled = false,
  connectionStatus,
  onReady,
  containerRef,
}: PrivateHandoffProps) {
  const playerProgress = Math.round((currentPlayer / players) * 100);
  return (
    <GameShell variant="handoff">
      <ScreenFrame ref={containerRef} className={styles.screen} tabIndex={-1}>
        <TopBar
          meta={
            <div
              className={styles.progress}
              aria-label={`Progres pemilihan kartu: pemain ${currentPlayer} dari ${players}`}
            >
              <span>
                Pemain {currentPlayer} dari {players}
              </span>
              <span className={styles.progressTrack}>
                <span style={{ width: `${playerProgress}%` }} />
              </span>
            </div>
          }
          trailing={connectionStatus}
        >
          <Brand compact />
        </TopBar>

        <main className={styles.layout}>
          <Panel as="section" className={styles.card}>
            <Eyebrow>Pemilihan kartu rahasia</Eyebrow>
            <div className={styles.cardNumber} aria-hidden="true">
              {String(currentPlayer).padStart(2, '0')}
            </div>
            <h1>Serahkan perangkatnya</h1>
            <p className={styles.cardLede}>
              Pemain {currentPlayer}, pilihanmu rahasia. Pastikan tidak ada yang
              mengintip sebelum kamu membuka kartunya.
            </p>
            <div className={styles.privacyNote}>
              <MaterialSymbol
                name="shield_lock"
                className={styles.privacyIcon}
                filled
              />
              <span>
                <strong>Hanya untukmu</strong>
                Pilih {cardsPerPlayer} dari {cardsPerPlayer + 2} kartu
              </span>
            </div>
            <GameButton onClick={onReady} disabled={disabled}>
              Buka kartuku
              <MaterialSymbol name="arrow_forward" />
            </GameButton>
          </Panel>

          <aside className={styles.aside} aria-hidden="true">
            <span className={styles.asideLabel}>Giliran berikutnya</span>
            <strong>Pemain {currentPlayer}</strong>
            <span>Pilih dengan bijak. Semua pemain akan memakai deck ini.</span>
            <div className={styles.asideCards}>
              <span />
              <span />
              <span />
            </div>
          </aside>
        </main>
      </ScreenFrame>
    </GameShell>
  );
}
