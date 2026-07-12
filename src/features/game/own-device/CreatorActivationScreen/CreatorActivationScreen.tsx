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
import { Panel } from '@/shared/ui/Panel/Panel';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import styles from './CreatorActivationScreen.module.css';

export interface CreatorActivationScreenProps {
  displayName: string;
  onDisplayNameChange: (displayName: string) => void;
  onSubmit: () => void;
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
          note="Perangkat masing-masing · Satu ruangan bersama"
          trailing={
            <ConnectionStatus state={connectionState} onRetry={onRetry} />
          }
        >
          <Brand compact />
        </TopBar>

        <main className={styles.main}>
          <div className={styles.intro}>
            <Eyebrow className={styles.introEyebrow} onDark>
              Buat sesi baru
            </Eyebrow>
            <h1>
              Mulai sebagai <span>pemain pertama.</span>
            </h1>
            <p>
              Setelah namamu diterima, kamu akan mendapat kode enam karakter
              untuk dibagikan kepada pemain lain.
            </p>
          </div>

          <Panel
            as="section"
            className={styles.formCard}
            aria-labelledby="creator-activation-title"
          >
            <Eyebrow>Aktifkan ruangan</Eyebrow>
            <h2 id="creator-activation-title">Siapa namamu?</h2>
            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="creator-display-name">Nama pemain</label>
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
                Gunakan nama unik sepanjang 1–24 karakter.
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
                {isSubmitting ? 'Membuat ruangan…' : 'Buat kode sesi'}
                <span aria-hidden="true">→</span>
              </GameButton>
            </form>
          </Panel>
        </main>
      </ScreenFrame>
    </GameShell>
  );
}
