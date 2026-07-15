'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useStageScroll } from '@/shared/hooks/useStageScroll/useStageScroll';
import { Brand } from '@/shared/ui/Brand/Brand';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { Input } from '@/shared/ui/Input/Input';
import { MaterialSymbol } from '@/shared/ui/MaterialSymbol/MaterialSymbol';
import { Panel } from '@/shared/ui/Panel/Panel';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import styles from './JoinScreen.module.css';

interface JoinPreview {
  code: string;
  controllerName: string;
  playerCount: number;
}

interface JoinResponse {
  route?: string;
  error?: string;
  code?: string;
}

type PreviewStatus = 'loading' | 'ready' | 'invalid' | 'full' | 'started';

interface PreviewErrorBody {
  code?: string;
  error?: string;
}

const previewErrorCopy: Record<
  Exclude<PreviewStatus, 'loading' | 'ready'>,
  { eyebrow: string; title: string; body: string }
> = {
  invalid: {
    eyebrow: 'Kode nggak valid',
    title: 'Room-nya nggak ketemu.',
    body: 'Room code ini salah atau sudah expired. Coba minta kode baru ke temanmu.',
  },
  full: {
    eyebrow: 'Room penuh',
    title: 'Sudah full, nih.',
    body: 'Sudah ada 20 player di room ini. Minta host mengeluarkan player yang nggak ikut.',
  },
  started: {
    eyebrow: 'Game sudah mulai',
    title: 'Yah, kamu telat join.',
    body: 'Pemilihan kartu atau game-nya sudah jalan. Tunggu game berikutnya, ya.',
  },
};

function normalizeCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[\s-]+/g, '')
    .slice(0, 6);
}

export function JoinScreen({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const code = normalizeCode(initialCode);
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<PreviewStatus>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useStageScroll(status);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/join/${encodeURIComponent(code)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as JoinPreview | PreviewErrorBody;
        if (!response.ok) {
          const code = 'code' in body ? body.code : undefined;
          if (code === 'ROOM_FULL') setStatus('full');
          else if (code === 'ROOM_STARTED') setStatus('started');
          else setStatus('invalid');
          return null;
        }
        return body as JoinPreview;
      })
      .then((body) => {
        if (!body) return;
        setPreview(body);
        setStatus('ready');
      })
      .catch((caughtError: unknown) => {
        if (
          caughtError instanceof DOMException &&
          caughtError.name === 'AbortError'
        ) {
          return;
        }
        setStatus('invalid');
      });

    return () => controller.abort();
  }, [code]);

  const join = async () => {
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/join/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const body = (await response.json()) as JoinResponse;

      if (!response.ok || !body.route) {
        throw new Error(body.error || 'Oops, belum bisa join sesi.');
      }

      router.replace(body.route);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Oops, belum bisa join sesi.'
      );
      setSubmitting(false);
    }
  };

  return (
    <GameShell variant="handoff">
      <ScreenFrame ref={containerRef} className={styles.screen} tabIndex={-1}>
        <TopBar note="Device masing-masing · Kartu tetap rahasia">
          <Brand compact />
        </TopBar>

        <main className={styles.main}>
          <Panel as="section" className={styles.card} aria-live="polite">
            {status === 'loading' && (
              <>
                <Eyebrow>Cek room code</Eyebrow>
                <h1>Bentar, ya…</h1>
                <p>Lagi cari room dengan kode {code || 'itu'}.</p>
              </>
            )}

            {status !== 'loading' && status !== 'ready' && (
              <>
                <Eyebrow>{previewErrorCopy[status].eyebrow}</Eyebrow>
                <h1>{previewErrorCopy[status].title}</h1>
                <p>{previewErrorCopy[status].body}</p>
                <Link href="/" className={styles.backLink}>
                  Balik ke home
                </Link>
              </>
            )}

            {status === 'ready' && preview && (
              <>
                <Eyebrow>Join game</Eyebrow>
                <h1>Masuk ke room.</h1>
                <dl className={styles.preview}>
                  <div>
                    <dt>Kode</dt>
                    <dd>{preview.code}</dd>
                  </div>
                  <div>
                    <dt>Host</dt>
                    <dd>{preview.controllerName}</dd>
                  </div>
                  <div>
                    <dt>Player</dt>
                    <dd>{preview.playerCount} / 20</dd>
                  </div>
                </dl>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void join();
                  }}
                >
                  <label htmlFor="display-name">Namamu</label>
                  <Input
                    id="display-name"
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="nickname"
                    placeholder="Contoh: Dinda"
                    required
                    aria-describedby="display-name-hint"
                  />
                  <small id="display-name-hint">
                    Pakai 1–24 karakter dan nama yang belum dipakai player lain.
                  </small>
                  <GameButton
                    type="submit"
                    disabled={submitting || !name.trim()}
                  >
                    {submitting ? 'Lagi join…' : 'Join game'}
                    <MaterialSymbol name="arrow_forward" />
                  </GameButton>
                </form>

                {error && (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                )}
              </>
            )}
          </Panel>
        </main>
      </ScreenFrame>
    </GameShell>
  );
}
