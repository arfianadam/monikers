import type { Ref } from 'react';

import { Brand } from '@/shared/ui/Brand/Brand';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { Panel } from '@/shared/ui/Panel/Panel';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import styles from './PrivateHandoff.module.css';

export interface PrivateHandoffProps {
  currentPlayer: number;
  players: number;
  cardsPerPlayer: number;
  onReady: () => void;
  containerRef?: Ref<HTMLDivElement>;
}

export function PrivateHandoff({
  currentPlayer,
  players,
  cardsPerPlayer,
  onReady,
  containerRef,
}: PrivateHandoffProps) {
  const playerProgress = Math.round((currentPlayer / players) * 100);
  return (
    <GameShell variant="handoff">
      <ScreenFrame ref={containerRef} className={styles.screen} tabIndex={-1}>
        <TopBar>
          <Brand compact />
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
              <span className={styles.privacyIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3.25 19 6v5.16c0 4.45-2.75 7.8-7 9.59-4.25-1.79-7-5.14-7-9.59V6l7-2.75Z"
                    className={styles.privacyShield}
                  />
                  <circle cx="12" cy="11" r="1.65" />
                  <path d="M12 12.55v2.7" />
                </svg>
              </span>
              <span>
                <strong>Hanya untukmu</strong>
                Pilih {cardsPerPlayer} dari {cardsPerPlayer + 2} kartu
              </span>
            </div>
            <GameButton onClick={onReady}>
              Buka kartuku
              <span aria-hidden="true">→</span>
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
