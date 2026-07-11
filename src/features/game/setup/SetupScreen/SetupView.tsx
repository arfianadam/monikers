import type { Ref } from 'react';

import { cn } from '@/lib/utils';
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
            <Eyebrow onDark dot>
              Calon permainan favorit di acara kumpulmu
            </Eyebrow>
            <h1 id="setup-title" className={styles.displayTitle}>
              Tebak namanya.
              <span>Lupakan jaimnya.</span>
            </h1>
            <p className={styles.lede}>
              Tiga babak. Dua tim. Satu deck nama terkenal yang makin lucu
              setiap kali dimainkan.
            </p>

            <div
              className={styles.roundStack}
              aria-label="Tiga babak permainan"
            >
              <div className={cn(styles.roundCard, styles.roundCardOne)}>
                <span>01</span>
                Bebas bicara
              </div>
              <div className={cn(styles.roundCard, styles.roundCardTwo)}>
                <span>02</span>
                Satu kata saja
              </div>
              <div className={cn(styles.roundCard, styles.roundCardThree)}>
                <span>03</span>
                Peragakan
              </div>
            </div>
          </section>

          <Panel
            as="section"
            className={styles.ticket}
            aria-label="Pengaturan permainan"
          >
            <div className={styles.ticketHeader}>
              <div>
                <Eyebrow className={styles.ticketEyebrow}>
                  Pengaturan permainan
                </Eyebrow>
                <h2>Susun deck-mu</h2>
              </div>
              <span className={styles.ticketNumber}>№ 001</span>
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
