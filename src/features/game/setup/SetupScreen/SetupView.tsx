import type { Ref } from 'react';

import { Brand } from '@/shared/ui/Brand/Brand';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { Panel } from '@/shared/ui/Panel/Panel';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import { NumberControl } from '../NumberControl/NumberControl';
import styles from './SetupScreen.module.css';

export interface SetupViewProps {
  players: number;
  cardsPerPlayer: number;
  disabled?: boolean;
  containerRef?: Ref<HTMLDivElement>;
  onPlayersChange: (players: number) => void;
  onCardsPerPlayerChange: (cardsPerPlayer: number) => void;
  onStart: () => void;
}

export function SetupView({
  players,
  cardsPerPlayer,
  disabled = false,
  containerRef,
  onPlayersChange,
  onCardsPerPlayerChange,
  onStart,
}: SetupViewProps) {
  const totalCards = players * cardsPerPlayer;

  return (
    <GameShell variant="setup">
      <ScreenFrame ref={containerRef} className={styles.screen} tabIndex={-1}>
        <TopBar note="Bergantian di satu perangkat · Tanpa perlu masuk">
          <Brand />
        </TopBar>

        <main className={styles.layout}>
          <section className={styles.intro} aria-labelledby="setup-title">
            <Eyebrow className={styles.introEyebrow} onDark>
              Satu perangkat
            </Eyebrow>
            <h1 id="setup-title">
              Atur, lalu <span>main bergantian.</span>
            </h1>
            <p>
              Tentukan jumlah pemain dan kartu. Setelah mulai, oper perangkat
              kepada tiap pemain supaya mereka dapat memilih kartu secara
              rahasia.
            </p>
          </section>

          <Panel
            as="section"
            className={styles.settingsCard}
            aria-label="Pengaturan permainan"
          >
            <div className={styles.settingsHeading}>
              <Eyebrow>Pengaturan permainan</Eyebrow>
              <h2>Susun deck-mu</h2>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                onStart();
              }}
            >
              <NumberControl
                id="players"
                label="Pemain"
                hint="2–20 orang, dibagi menjadi dua tim"
                value={players}
                min={2}
                max={20}
                disabled={disabled}
                onChange={onPlayersChange}
              />
              <NumberControl
                id="cards"
                label="Kartu per pemain"
                hint="1–10 kartu, dipilih diam-diam oleh tiap pemain"
                value={cardsPerPlayer}
                min={1}
                max={10}
                disabled={disabled}
                onChange={onCardsPerPlayerChange}
              />

              <div className={styles.deckSummary} aria-live="polite">
                <span className={styles.deckIcon} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span>
                  <strong>{totalCards} kartu dalam deck</strong>
                  {players} pemain · 3 babak · sekitar 30 menit
                </span>
              </div>

              <GameButton
                variant="primary"
                className={styles.submitButton}
                type="submit"
                disabled={disabled}
              >
                Mulai bermain
                <span aria-hidden="true">→</span>
              </GameButton>
            </form>
          </Panel>
        </main>

        <footer className={styles.footer}>
          <span>Dibuat untuk suasana ramai dan petunjuk yang absurd.</span>
          <span>© arfianadam</span>
        </footer>
      </ScreenFrame>
    </GameShell>
  );
}
