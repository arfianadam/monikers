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
    eyebrow: 'Kode tidak berlaku',
    title: 'Sesi tidak ditemukan.',
    body: 'Kode sesi tidak ditemukan atau sudah kedaluwarsa. Minta kode terbaru kepada pembuat sesi.',
  },
  full: {
    eyebrow: 'Ruangan penuh',
    title: 'Sesi sudah penuh.',
    body: 'Dua puluh pemain sudah berada di ruangan ini. Minta pembuat sesi mengeluarkan pemain yang tidak ikut.',
  },
  started: {
    eyebrow: 'Permainan sudah dimulai',
    title: 'Kamu terlambat bergabung.',
    body: 'Sesi ini masih berlaku, tetapi pemilihan kartu atau permainan sudah dimulai. Tunggu permainan berikutnya.',
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
        throw new Error(body.error || 'Belum dapat bergabung ke sesi.');
      }

      router.replace(body.route);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Belum dapat bergabung ke sesi.'
      );
      setSubmitting(false);
    }
  };

  return (
    <GameShell variant="handoff">
      <ScreenFrame ref={containerRef} className={styles.screen} tabIndex={-1}>
        <TopBar note="Perangkat masing-masing · Kartu tetap rahasia">
          <Brand compact />
        </TopBar>

        <main className={styles.main}>
          <Panel as="section" className={styles.card} aria-live="polite">
            {status === 'loading' && (
              <>
                <Eyebrow>Memeriksa kode</Eyebrow>
                <h1>Sebentar…</h1>
                <p>
                  Kami sedang mencari sesi dengan kode {code || 'tersebut'}.
                </p>
              </>
            )}

            {status !== 'loading' && status !== 'ready' && (
              <>
                <Eyebrow>{previewErrorCopy[status].eyebrow}</Eyebrow>
                <h1>{previewErrorCopy[status].title}</h1>
                <p>{previewErrorCopy[status].body}</p>
                <Link href="/" className={styles.backLink}>
                  Kembali ke halaman awal
                </Link>
              </>
            )}

            {status === 'ready' && preview && (
              <>
                <Eyebrow>Gabung ke sesi</Eyebrow>
                <h1>Masuk ke ruangan.</h1>
                <dl className={styles.preview}>
                  <div>
                    <dt>Kode</dt>
                    <dd>{preview.code}</dd>
                  </div>
                  <div>
                    <dt>Dibuat oleh</dt>
                    <dd>{preview.controllerName}</dd>
                  </div>
                  <div>
                    <dt>Pemain</dt>
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
                    Gunakan 1–24 karakter dan nama yang berbeda dari pemain
                    lain.
                  </small>
                  <GameButton
                    type="submit"
                    disabled={submitting || !name.trim()}
                  >
                    {submitting ? 'Sedang bergabung…' : 'Gabung ke sesi'}
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
