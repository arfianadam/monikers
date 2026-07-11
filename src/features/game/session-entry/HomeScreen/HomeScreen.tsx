'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { SessionMode } from '@/features/game/session-protocol/types';
import { Brand } from '@/shared/ui/Brand/Brand';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { Input } from '@/shared/ui/Input/Input';
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
            <Eyebrow onDark dot>
              Tiga babak, dua tim, banyak jawaban ngawur
            </Eyebrow>
            <h1 id="home-title">
              Pilih cara <span>mainmu.</span>
            </h1>
            <p>
              Main bergantian di satu layar, atau pakai perangkat masing-masing
              agar kartu dan giliran tetap rahasia.
            </p>

            <ol className={styles.rounds} aria-label="Tiga babak permainan">
              <li>
                <span>01</span> Bebas bicara
              </li>
              <li>
                <span>02</span> Satu kata
              </li>
              <li>
                <span>03</span> Peragakan
              </li>
            </ol>
          </section>

          <Panel as="section" className={styles.actions} aria-label="Cara main">
            <div className={styles.actionHeading}>
              <Eyebrow>Mulai sesi</Eyebrow>
              <h2>Semua siap?</h2>
            </div>

            <GameButton
              type="button"
              onClick={() => createSession('single-device')}
              disabled={pendingMode !== null}
              className={styles.actionButton}
            >
              {pendingMode === 'single-device'
                ? 'Membuat sesi…'
                : 'Main di satu perangkat'}
              <span aria-hidden="true">→</span>
            </GameButton>
            <p className={styles.hint}>
              Bergantian memegang satu ponsel atau laptop.
            </p>

            <GameButton
              type="button"
              variant="secondary"
              onClick={() => createSession('own-device')}
              disabled={pendingMode !== null}
              className={styles.actionButton}
            >
              {pendingMode === 'own-device'
                ? 'Membuat ruangan…'
                : 'Buat sesi perangkat masing-masing'}
              <span aria-hidden="true">＋</span>
            </GameButton>
            <p className={styles.hint}>
              Setiap pemain membuka kartu di perangkat sendiri.
            </p>

            <div className={styles.divider}>
              <span>atau gabung</span>
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
                Masukkan enam karakter dari pembuat sesi.
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
