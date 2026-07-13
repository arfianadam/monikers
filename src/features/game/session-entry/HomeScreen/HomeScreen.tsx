'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { SessionMode } from '@/features/game/session-protocol/types';
import { Brand } from '@/shared/ui/Brand/Brand';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { Input } from '@/shared/ui/Input/Input';
import { MaterialSymbol } from '@/shared/ui/MaterialSymbol/MaterialSymbol';
import { Panel } from '@/shared/ui/Panel/Panel';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import styles from './HomeScreen.module.css';

interface CreateSessionResponse {
  route?: string;
  error?: string;
}

function normalizeCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[\s-]+/g, '')
    .slice(0, 6);
}

export function HomeScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [pendingMode, setPendingMode] = useState<SessionMode | null>(null);
  const [error, setError] = useState('');

  const createSession = async (mode: SessionMode) => {
    setPendingMode(mode);
    setError('');

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const body = (await response.json()) as CreateSessionResponse;

      if (!response.ok || !body.route) {
        throw new Error(body.error || 'Sesi belum dapat dibuat.');
      }

      router.push(body.route);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Sesi belum dapat dibuat.'
      );
      setPendingMode(null);
    }
  };

  return (
    <GameShell variant="setup">
      <ScreenFrame className={styles.screen}>
        <TopBar note="Main bersama · Di ruangan yang sama">
          <Brand />
        </TopBar>

        <main className={styles.layout}>
          <section className={styles.intro} aria-labelledby="home-title">
            <Eyebrow className={styles.introEyebrow} onDark dot>
              Calon permainan favorit di acara kumpulmu
            </Eyebrow>
            <h1 id="home-title" className={styles.displayTitle}>
              Tebak namanya.
              <span>Lupakan jaimnya.</span>
            </h1>
            <p className={styles.introCopy}>
              Tiga babak. Dua tim. Satu deck nama terkenal yang makin lucu
              setiap kali dimainkan.
            </p>

            <ol className={styles.rounds} aria-label="Tiga babak permainan">
              <li>
                <span>01</span> Bebas bicara
              </li>
              <li>
                <span>02</span> Satu kata saja
              </li>
              <li>
                <span>03</span> Peragakan
              </li>
            </ol>
          </section>

          <Panel
            as="section"
            className={styles.actions}
            aria-labelledby="session-options-title"
          >
            <div className={styles.actionHeading}>
              <Eyebrow>Mulai sesi</Eyebrow>
              <h2 id="session-options-title">Semua siap?</h2>
            </div>

            <div className={styles.modeOptions}>
              <GameButton
                type="button"
                onClick={() => createSession('single-device')}
                disabled={pendingMode !== null}
                className={styles.actionButton}
                aria-label={
                  pendingMode === 'single-device'
                    ? 'Membuat sesi…'
                    : 'Main di satu perangkat'
                }
                aria-describedby="single-device-description"
                aria-busy={pendingMode === 'single-device'}
              >
                <span className={styles.modeCopy}>
                  <strong>
                    {pendingMode === 'single-device'
                      ? 'Membuat sesi…'
                      : 'Satu perangkat'}
                  </strong>
                  <small id="single-device-description">
                    Oper ponsel atau laptop setiap giliran.
                  </small>
                </span>
                <MaterialSymbol
                  name="arrow_forward"
                  className={styles.modeIcon}
                />
              </GameButton>

              <GameButton
                type="button"
                variant="secondary"
                onClick={() => createSession('own-device')}
                disabled={pendingMode !== null}
                className={`${styles.actionButton} ${styles.secondaryAction}`}
                aria-label={
                  pendingMode === 'own-device'
                    ? 'Membuat ruangan…'
                    : 'Buat sesi perangkat masing-masing'
                }
                aria-describedby="own-device-description"
                aria-busy={pendingMode === 'own-device'}
              >
                <span className={styles.modeCopy}>
                  <strong>
                    {pendingMode === 'own-device'
                      ? 'Membuat ruangan…'
                      : 'Perangkat masing-masing'}
                  </strong>
                  <small id="own-device-description">
                    Bagikan kode agar kartu tetap rahasia.
                  </small>
                </span>
                <MaterialSymbol name="add" className={styles.modeIcon} />
              </GameButton>
            </div>

            <div className={styles.divider}>
              <span>Sudah punya kode?</span>
            </div>

            <form
              className={styles.joinForm}
              onSubmit={(event) => {
                event.preventDefault();
                if (code.length === 6) router.push(`/join/${code}`);
              }}
            >
              <label htmlFor="join-code">Kode sesi</label>
              <div>
                <Input
                  id="join-code"
                  name="code"
                  value={code}
                  onChange={(event) =>
                    setCode(normalizeCode(event.target.value))
                  }
                  placeholder="ABC234"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  inputMode="text"
                  aria-describedby="join-code-hint"
                />
                <GameButton type="submit" disabled={code.length !== 6}>
                  Gabung
                </GameButton>
              </div>
              <small id="join-code-hint">
                Masukkan 6 karakter dari pembuat sesi.
              </small>
            </form>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </Panel>
        </main>
      </ScreenFrame>
    </GameShell>
  );
}
