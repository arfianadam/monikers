'use client';

import type { FormEvent, Ref } from 'react';

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
import { Panel } from '@/shared/ui/Panel/Panel';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import styles from './CreatorActivationScreen.module.css';

export interface CreatorActivationScreenProps {
  displayName: string;
  onDisplayNameChange: (displayName: string) => void;
  onSubmit: () => void;
  onEndSession?: () => void;
  connectionState?: ConnectionStatusState;
  onRetry?: () => void;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  containerRef?: Ref<HTMLDivElement>;
}

export function CreatorActivationScreen({
  displayName,
  onDisplayNameChange,
  onSubmit,
  onEndSession,
  connectionState = 'connected',
  onRetry,
  errorMessage,
  isSubmitting = false,
  containerRef,
}: CreatorActivationScreenProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <GameShell variant="handoff">
      <ScreenFrame ref={containerRef} className={styles.screen} tabIndex={-1}>
        <TopBar
          note="Device masing-masing · Satu room bareng"
          trailing={
            <ConnectionStatus state={connectionState} onRetry={onRetry} />
          }
        >
          <Brand compact />
        </TopBar>

        <main className={styles.main}>
          <div className={styles.intro}>
            <Eyebrow className={styles.introEyebrow} onDark>
              Bikin room baru
            </Eyebrow>
            <h1>
              Kamu jadi <span>player pertama.</span>
            </h1>
            <p>
              Setelah isi nama, kamu bakal dapat room code enam karakter buat
              dibagikan ke player lain.
            </p>
          </div>

          <div className={styles.activation}>
            <Panel
              as="section"
              className={styles.formCard}
              aria-labelledby="creator-activation-title"
            >
              <Eyebrow>Setup room</Eyebrow>
              <h2 id="creator-activation-title">Siapa namamu?</h2>
              <form onSubmit={handleSubmit} noValidate>
                <label htmlFor="creator-display-name">Nama kamu</label>
                <Input
                  id="creator-display-name"
                  name="displayName"
                  value={displayName}
                  onChange={(event) => onDisplayNameChange(event.target.value)}
                  autoComplete="nickname"
                  placeholder="Contoh: Dinda"
                  required
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={
                    errorMessage
                      ? 'creator-name-hint creator-name-error'
                      : 'creator-name-hint'
                  }
                />
                <small id="creator-name-hint">
                  Pakai nama unik, 1–24 karakter.
                </small>

                {errorMessage && (
                  <p
                    id="creator-name-error"
                    className={styles.error}
                    role="alert"
                  >
                    {errorMessage}
                  </p>
                )}

                <GameButton
                  type="submit"
                  disabled={
                    isSubmitting ||
                    connectionState !== 'connected' ||
                    !displayName.trim()
                  }
                >
                  {isSubmitting ? 'Lagi bikin room…' : 'Bikin room code'}
                  <MaterialSymbol name="arrow_forward" />
                </GameButton>
              </form>
            </Panel>

            {onEndSession && (
              <button
                type="button"
                className={styles.endSession}
                onClick={onEndSession}
                disabled={isSubmitting || connectionState !== 'connected'}
              >
                Tutup sesi
              </button>
            )}
          </div>
        </main>
      </ScreenFrame>
    </GameShell>
  );
}
