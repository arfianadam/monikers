'use client';

import { useEffect, useRef, useState } from 'react';

import cards1 from '@/data/cards-level1.json';
import cards2 from '@/data/cards-level2.json';
import cards3 from '@/data/cards-level3.json';
import cards4 from '@/data/cards-level4.json';
import { cn } from '@/lib/utils';

import { Card } from './GameScreen';
import { Brand, GameShell } from './ui/GameChrome';

interface Props {
  players: number;
  cardsPerPlayer: number;
  onSelectionEnd: (cards: Card[]) => void;
}

const cards: Card[] = Array.from(
  new Map(
    [...cards1, ...cards2, ...cards3, ...cards4].map((card) => [
      card.word,
      card,
    ])
  ).values()
);

export default function CardSelectionScreen({
  players,
  cardsPerPlayer,
  onSelectionEnd,
}: Props) {
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [allSelectedCards, setAllSelectedCards] = useState<Card[]>([]);
  const [availableCards, setAvailableCards] = useState<Card[]>([]);
  const [isReady, setIsReady] = useState(false);
  const viewContainerRef = useRef<HTMLDivElement>(null);
  const isInitialView = useRef(true);

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
  }, [currentPlayer, isReady]);

  useEffect(() => {
    const cardsToShuffle =
      allSelectedCards.length > 0
        ? cards.filter(
            (card) =>
              !allSelectedCards.some((selected) => selected.word === card.word)
          )
        : cards;
    const shuffled = [...cardsToShuffle].sort(() => 0.5 - Math.random());
    setAvailableCards(shuffled.slice(0, cardsPerPlayer + 2));
  }, [currentPlayer, cardsPerPlayer, allSelectedCards]);

  const handleCardSelect = (card: Card) => {
    setSelectedCards((currentCards) => {
      const isSelected = currentCards.some(
        (selected) => selected.word === card.word
      );

      if (isSelected) {
        return currentCards.filter((selected) => selected.word !== card.word);
      }

      if (currentCards.length < cardsPerPlayer) {
        return [...currentCards, card];
      }

      return currentCards;
    });
  };

  const handleNextPlayer = () => {
    if (selectedCards.length !== cardsPerPlayer) return;

    const newAllSelectedCards = allSelectedCards.concat(selectedCards);
    setAllSelectedCards(newAllSelectedCards);

    if (currentPlayer < players) {
      setCurrentPlayer((player) => player + 1);
      setSelectedCards([]);
      setIsReady(false);
    } else {
      onSelectionEnd(newAllSelectedCards);
    }
  };

  const playerProgress = Math.round((currentPlayer / players) * 100);
  const selectionProgress = Math.round(
    (selectedCards.length / cardsPerPlayer) * 100
  );
  const cardsLeftToPick = Math.max(0, cardsPerPlayer - selectedCards.length);

  if (!isReady) {
    return (
      <GameShell className="game-shell--handoff">
        <div
          className="screen-frame handoff-screen"
          ref={viewContainerRef}
          tabIndex={-1}
        >
          <header className="topbar">
            <Brand compact />
            <div
              className="handoff-progress"
              aria-label={`Progres pemilihan kartu: pemain ${currentPlayer} dari ${players}`}
            >
              <span>
                Pemain {currentPlayer} dari {players}
              </span>
              <span className="handoff-progress__track">
                <span style={{ width: `${playerProgress}%` }} />
              </span>
            </div>
          </header>

          <main className="handoff-layout">
            <section className="handoff-card paper-panel">
              <p className="eyebrow">Pemilihan kartu rahasia</p>
              <div className="handoff-card__number" aria-hidden="true">
                {String(currentPlayer).padStart(2, '0')}
              </div>
              <h1>Serahkan perangkatnya</h1>
              <p className="handoff-card__lede">
                Pemain {currentPlayer}, pilihanmu rahasia. Pastikan tidak ada
                yang mengintip sebelum kamu membuka kartunya.
              </p>
              <div className="privacy-note">
                <span className="privacy-note__icon" aria-hidden="true">
                  ◉
                </span>
                <span>
                  <strong>Hanya untukmu</strong>
                  Pilih {cardsPerPlayer} dari {cardsPerPlayer + 2} kartu
                </span>
              </div>
              <button
                className="game-button game-button--primary"
                onClick={() => setIsReady(true)}
              >
                Buka kartuku
                <span aria-hidden="true">→</span>
              </button>
            </section>

            <aside className="handoff-aside" aria-hidden="true">
              <span className="handoff-aside__label">Giliran berikutnya</span>
              <strong>Pemain {currentPlayer}</strong>
              <span>
                Pilih dengan bijak. Semua pemain akan memakai deck ini.
              </span>
              <div className="handoff-aside__cards">
                <span />
                <span />
                <span />
              </div>
            </aside>
          </main>
        </div>
      </GameShell>
    );
  }

  return (
    <GameShell className="game-shell--selection">
      <div
        className="screen-frame selection-screen"
        ref={viewContainerRef}
        tabIndex={-1}
      >
        <header className="topbar selection-topbar">
          <Brand compact />
          <div className="selection-status">
            <span className="selection-status__player">
              Pemain {currentPlayer} dari {players}
            </span>
            <span className="selection-status__count">
              <strong>{selectedCards.length}</strong> / {cardsPerPlayer} dipilih
            </span>
          </div>
        </header>

        <main className="selection-main">
          <div className="selection-heading">
            <div>
              <p className="eyebrow eyebrow--on-dark">Susun deck bersama</p>
              <h1>Pilih favoritmu</h1>
            </div>
            <p>
              Pilih nama yang kamu kenal—atau yang paling lucu untuk dijelaskan
              nanti.
            </p>
          </div>

          <div className="selection-meter" aria-hidden="true">
            <span style={{ width: `${selectionProgress}%` }} />
          </div>

          <div className="selection-grid">
            {availableCards.map((card) => {
              const isSelected = selectedCards.some(
                (selected) => selected.word === card.word
              );

              return (
                <button
                  type="button"
                  key={card.word}
                  className={cn(
                    'selection-card',
                    isSelected && 'selection-card--selected'
                  )}
                  data-level={card.level}
                  aria-pressed={isSelected}
                  onClick={() => handleCardSelect(card)}
                >
                  <span className="selection-card__topline">
                    <span className="level-badge">Tingkat {card.level}</span>
                    <span className="selection-card__check" aria-hidden="true">
                      ✓
                    </span>
                  </span>
                  <strong>{card.word}</strong>
                  <span className="selection-card__description">
                    {card.description}
                  </span>
                  <span className="selection-card__action" aria-hidden="true">
                    {isSelected ? 'Sudah dipilih' : 'Ketuk untuk memilih'}
                    <span>{isSelected ? '✓' : '+'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </main>
      </div>

      <div className="selection-dock">
        <div className="selection-dock__inner">
          <div className="selection-dock__count" aria-live="polite">
            <span aria-label={`${selectedCards.length} kartu dipilih`}>
              {selectedCards.length}
            </span>
            <p>
              <strong>
                {cardsLeftToPick === 0
                  ? 'Semua sudah dipilih'
                  : `${cardsLeftToPick} kartu lagi`}
              </strong>
              <span>
                {selectedCards.length} dari {cardsPerPlayer} dipilih
              </span>
            </p>
          </div>
          <button
            type="button"
            className="game-button game-button--primary"
            onClick={handleNextPlayer}
            disabled={selectedCards.length !== cardsPerPlayer}
          >
            {currentPlayer < players
              ? 'Serahkan ke pemain berikutnya'
              : 'Selesai'}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </GameShell>
  );
}
