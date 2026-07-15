import type { ReactNode, Ref } from 'react';

import { Brand } from '@/shared/ui/Brand/Brand';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { MaterialSymbol } from '@/shared/ui/MaterialSymbol/MaterialSymbol';
import { Panel } from '@/shared/ui/Panel/Panel';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import { NumberControl } from '../NumberControl/NumberControl';
import styles from './SetupScreen.module.css';

export interface SetupViewProps {
  players: number;
  cardsPerPlayer: number;
  disabled?: boolean;
  connectionStatus?: ReactNode;
  containerRef?: Ref<HTMLDivElement>;
  onPlayersChange: (players: number) => void;
  onCardsPerPlayerChange: (cardsPerPlayer: number) => void;
  onStart: () => void;
  onEndSession?: () => void;
}

export function SetupView({
  players,
  cardsPerPlayer,
  disabled = false,
  connectionStatus,
  containerRef,
  onPlayersChange,
  onCardsPerPlayerChange,
  onStart,
  onEndSession,
}: SetupViewProps) {
  const totalCards = players * cardsPerPlayer;

  return (
    <GameShell variant="setup">
      <ScreenFrame ref={containerRef} className={styles.screen} tabIndex={-1}>
        <TopBar
          note="Oper satu device · Nggak perlu login"
          trailing={connectionStatus}
        >
          <Brand />
        </TopBar>

        <main className={styles.layout}>
          <section className={styles.intro} aria-labelledby="setup-title">
            <Eyebrow className={styles.introEyebrow} onDark>
              Satu device
            </Eyebrow>
            <h1 id="setup-title">
              Setup dulu, <span>lalu oper-operan.</span>
            </h1>
            <p>
              Tentukan jumlah player dan kartu. Setelah mulai, oper device ke
              tiap player biar mereka bisa pilih kartu diam-diam.
            </p>
          </section>

          <div className={styles.settings}>
            <Panel
              as="section"
              className={styles.settingsCard}
              aria-label="Setup permainan"
            >
              <div className={styles.settingsHeading}>
                <Eyebrow>Game setup</Eyebrow>
                <h2>Atur deck-mu</h2>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  onStart();
                }}
              >
                <NumberControl
                  id="players"
                  label="Player"
                  hint="2–20 orang, dibagi jadi dua tim"
                  value={players}
                  min={2}
                  max={20}
                  disabled={disabled}
                  onChange={onPlayersChange}
                />
                <NumberControl
                  id="cards"
                  label="Kartu per player"
                  hint="1–10 kartu, dipilih diam-diam oleh tiap player"
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
                    <strong>{totalCards} kartu di deck</strong>
                    {players} player · 3 ronde · sekitar 30 menit
                  </span>
                </div>

                <GameButton
                  variant="primary"
                  className={styles.submitButton}
                  type="submit"
                  disabled={disabled}
                >
                  Mulai game
                  <MaterialSymbol name="arrow_forward" />
                </GameButton>
              </form>
            </Panel>

            {onEndSession && (
              <button
                type="button"
                className={styles.endSession}
                onClick={onEndSession}
                disabled={disabled}
              >
                Tutup sesi
              </button>
            )}
          </div>
        </main>

        <footer className={styles.footer}>
          <span>Dibuat buat rame-rame dan clue yang absurd.</span>
          <span>© arfianadam</span>
        </footer>
      </ScreenFrame>
    </GameShell>
  );
}
