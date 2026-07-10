'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { Brand, GameShell, RoundPips } from './ui/GameChrome';

export interface Card {
  level: number;
  word: string;
  description: string;
}

export type ScoresByRound = Record<string, Record<number, Card[]>>;

interface Props {
  initialCards: Card[];
  onGameEnd: (scores: ScoresByRound) => void;
  onRoundEnd: (scores: ScoresByRound) => void;
  round: number;
  scores: ScoresByRound;
}

const ROUND_DURATION = 60;

const ROUND_DETAILS: Record<
  number,
  { name: string; shortName: string; instruction: string; example: string }
> = {
  1: {
    name: 'Bicara bebas',
    shortName: 'Bebas bicara',
    instruction:
      'Gunakan kata apa pun—asal jangan menyebut nama yang tertulis di kartu.',
    example: 'Cerita, petunjuk, tiruan... semuanya boleh.',
  },
  2: {
    name: 'Satu kata',
    shortName: 'Satu kata saja',
    instruction:
      'Berikan tepat satu kata sebagai petunjuk. Timmu boleh terus menebak.',
    example: 'Pilih satu kata itu dengan sangat hati-hati.',
  },
  3: {
    name: 'Peragaan',
    shortName: 'Peragakan',
    instruction:
      'Tanpa kata atau suara. Gunakan pantomim, gerakan, dan akting terbaikmu.',
    example: 'Totalitaslah. Gengsi tidak wajib.',
  },
};

function getTeamTotal(scores: ScoresByRound, team: string) {
  return Object.values(scores[team] ?? {})
    .flat()
    .reduce((total, card) => total + card.level, 0);
}

export default function GameScreen({
  initialCards,
  onGameEnd,
  onRoundEnd,
  round,
  scores: initialScores,
}: Props) {
  const [cards, setCards] = useState<Card[]>([]);
  const [guessedCards, setGuessedCards] = useState<Card[]>([]);
  const cardsRef = useRef<Card[]>([]);
  const guessedCardsRef = useRef<Card[]>([]);
  const [scores, setScores] = useState<ScoresByRound>(initialScores);
  const [currentTeam, setCurrentTeam] = useState('team1');
  const [timer, setTimer] = useState(ROUND_DURATION);
  const [isRoundActive, setIsRoundActive] = useState(false);
  const [canSkip, setCanSkip] = useState(true);
  const [isGuessButtonDisabled, setIsGuessButtonDisabled] = useState(false);
  const viewContainerRef = useRef<HTMLDivElement>(null);
  const isInitialView = useRef(true);
  const sounds = useRef<{
    bell: HTMLAudioElement;
    ring: HTMLAudioElement;
  } | null>(null);

  const roundDetails = ROUND_DETAILS[round] ?? ROUND_DETAILS[3];
  const currentTeamNumber = currentTeam === 'team1' ? 1 : 2;
  const currentTeamScore = getTeamTotal(scores, currentTeam);

  useEffect(() => {
    window.scrollTo(0, 0);

    if (isInitialView.current) {
      isInitialView.current = false;
      return;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      const heading = viewContainerRef.current?.querySelector('h1');
      const focusTarget = heading ?? viewContainerRef.current;
      if (focusTarget instanceof HTMLElement) {
        focusTarget.tabIndex = -1;
        focusTarget.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [currentTeam, isRoundActive]);

  useEffect(() => {
    sounds.current = {
      bell: new Audio('/sounds/bell.wav'),
      ring: new Audio('/sounds/ring.wav'),
    };
  }, []);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    guessedCardsRef.current = guessedCards;
  }, [guessedCards]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    const handlePopState = (event: PopStateEvent) => {
      window.history.pushState(null, '', window.location.href);
      const shouldLeave = window.confirm('Yakin ingin meninggalkan permainan?');
      if (!shouldLeave) {
        event.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    setCards([...initialCards].sort(() => 0.5 - Math.random()));
  }, [initialCards]);

  const endRound = useCallback(
    ({
      remainingCards = [],
      updatedGuessedCards = [],
    }: {
      remainingCards?: Card[];
      updatedGuessedCards?: Card[];
    }) => {
      setIsRoundActive(false);
      sounds.current?.ring.play();
      const newScores: ScoresByRound = {
        ...scores,
        [currentTeam]: {
          ...scores[currentTeam],
          [round]: [
            ...(scores[currentTeam][round] || []),
            ...updatedGuessedCards,
          ],
        },
      };
      setScores(newScores);
      setGuessedCards([]);
      if (remainingCards.length === 0) {
        if (round < 3) {
          onRoundEnd(newScores);
        } else {
          onGameEnd(newScores);
        }
      } else {
        setCurrentTeam(currentTeam === 'team1' ? 'team2' : 'team1');
      }
    },
    [currentTeam, onGameEnd, scores, round, onRoundEnd]
  );

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRoundActive && timer > 0) {
      interval = setInterval(() => {
        setTimer((previousTimer) => previousTimer - 1);
      }, 1000);
    } else if (isRoundActive && timer === 0) {
      const currentCards = cardsRef.current;
      const currentGuessedCards = guessedCardsRef.current;
      const [currentCard, ...remainingCards] = currentCards;
      const nextRoundCards = [...remainingCards, currentCard];
      setCards(nextRoundCards);
      endRound({
        remainingCards: nextRoundCards,
        updatedGuessedCards: currentGuessedCards,
      });
    }
    return () => clearInterval(interval);
  }, [isRoundActive, timer, endRound]);

  const startRound = () => {
    if (sounds.current?.ring) {
      sounds.current.ring.pause();
      sounds.current.ring.currentTime = 0;
    }
    setIsRoundActive(true);
    setTimer(ROUND_DURATION);
    setCanSkip(true);
  };

  const handleGuess = () => {
    if (!isRoundActive || cards.length === 0 || isGuessButtonDisabled) return;

    setIsGuessButtonDisabled(true);
    if (sounds.current?.bell) {
      sounds.current.bell.pause();
      sounds.current.bell.currentTime = 0;
      sounds.current.bell.play();
    }

    const [currentCard, ...remainingCards] = cards;
    const updatedGuessedCards = [...guessedCards, currentCard];

    setGuessedCards(updatedGuessedCards);
    setCards(remainingCards);
    setCanSkip(true);

    setTimeout(() => {
      setIsGuessButtonDisabled(false);
    }, 1000);

    if (remainingCards.length === 0) {
      endRound({
        remainingCards,
        updatedGuessedCards,
      });
    }
  };

  const handleSkip = () => {
    if (!isRoundActive || !canSkip || cards.length <= 1) return;
    setCanSkip(false);
    const [currentCard, ...remainingCards] = cards;
    setCards([...remainingCards, currentCard]);
  };

  const handleEndRound = () => {
    if (!isRoundActive) return;
    endRound({
      remainingCards: cards,
      updatedGuessedCards: guessedCards,
    });
  };

  const activeCard = cards[0];
  const timerStyle = {
    '--timer-progress': `${(timer / ROUND_DURATION) * 360}deg`,
  } as CSSProperties;

  if (!isRoundActive) {
    return (
      <GameShell
        className={cn(
          'game-shell--turn',
          `game-shell--team-${currentTeamNumber}`
        )}
      >
        <div
          className="screen-frame turn-screen"
          ref={viewContainerRef}
          tabIndex={-1}
        >
          <header className="topbar">
            <Brand compact />
            <RoundPips round={round} />
          </header>

          <main className="turn-layout">
            <section className="turn-intro">
              <p className="eyebrow eyebrow--on-dark">
                Babak {round} · {roundDetails.name}
              </p>
              <h1>
                Tim {currentTeamNumber},<span>giliranmu.</span>
              </h1>
              <p className="turn-intro__lede">{roundDetails.instruction}</p>

              <div className="turn-rule">
                <span className="turn-rule__number">0{round}</span>
                <span>
                  <strong>{roundDetails.shortName}</strong>
                  {roundDetails.example}
                </span>
              </div>
            </section>

            <section className="paper-panel turn-ticket">
              <div className="turn-ticket__team">
                <span>Tim</span>
                <strong>{currentTeamNumber}</strong>
              </div>
              <div className="turn-ticket__stats">
                <span>
                  <strong>{cards.length || initialCards.length}</strong>
                  kartu tersisa
                </span>
                <span>
                  <strong>{currentTeamScore}</strong>
                  total poin
                </span>
                <span>
                  <strong>60</strong>
                  detik
                </span>
              </div>
              <div className="turn-ticket__divider" />
              <p>
                Serahkan perangkat kepada pemberi petunjuk, lalu mulai
                penghitung waktunya.
              </p>
              <button
                onClick={startRound}
                className="game-button game-button--primary"
              >
                Mulai giliran 60 detik
                <span aria-hidden="true">→</span>
              </button>
            </section>
          </main>
        </div>
      </GameShell>
    );
  }

  return (
    <GameShell
      className={cn(
        'game-shell--play',
        `game-shell--team-${currentTeamNumber}`
      )}
    >
      <div
        className="screen-frame play-screen"
        ref={viewContainerRef}
        tabIndex={-1}
      >
        <header className="topbar play-topbar">
          <Brand compact />
          <RoundPips round={round} />
        </header>

        <div className="play-hud">
          <div className="team-chip">
            <span className="team-chip__dot" />
            Tim {currentTeamNumber}
          </div>
          <div className="timer-block">
            <div
              className={cn('timer-dial', timer <= 10 && 'timer-dial--urgent')}
              style={timerStyle}
              aria-label={`${timer} detik tersisa`}
            >
              <span>{timer}</span>
            </div>
            <span className="timer-block__label">detik</span>
          </div>
          <div className="deck-chip">
            <strong>{cards.length}</strong>
            <span>kartu tersisa</span>
          </div>
        </div>

        <main className="play-stage">
          {activeCard && (
            <article
              key={activeCard.word}
              className="active-card paper-panel"
              data-level={activeCard.level}
              aria-live="polite"
            >
              <div className="active-card__topline">
                <span className="level-badge">Tingkat {activeCard.level}</span>
                <span className="active-card__serial">
                  {String(cards.length).padStart(2, '0')} /{' '}
                  {String(initialCards.length).padStart(2, '0')}
                </span>
              </div>
              <div className="active-card__copy">
                <p>Buat timmu menebak</p>
                <h1>{activeCard.word}</h1>
                <span>{activeCard.description}</span>
              </div>
              <div className="active-card__footer">
                <span>Monikers</span>
                <span>Babak 0{round}</span>
              </div>
            </article>
          )}
        </main>

        <div className="play-actions">
          <div className="play-actions__row">
            <button
              onClick={handleSkip}
              disabled={!canSkip || cards.length <= 1}
              className="game-button game-button--secondary skip-button"
            >
              <span aria-hidden="true">↻</span>
              {canSkip ? 'Lewati' : 'Sudah digunakan'}
            </button>
            <button
              onClick={handleGuess}
              disabled={isGuessButtonDisabled}
              className="game-button game-button--success guess-button"
            >
              Benar!
              <span aria-hidden="true">✓</span>
            </button>
          </div>
          <div className="play-actions__meta">
            <span>
              {guessedCards.length} kartu berhasil ditebak pada giliran ini
              {!canSkip && ' · Tebak dengan benar agar bisa melewati lagi'}
            </span>
            <button onClick={handleEndRound} className="end-turn-button">
              Akhiri giliran lebih awal
            </button>
          </div>
        </div>
      </div>
    </GameShell>
  );
}
