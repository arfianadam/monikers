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
              aria-label={`Card selection progress: player ${currentPlayer} of ${players}`}
            >
              <span>
                Player {currentPlayer} of {players}
              </span>
              <span className="handoff-progress__track">
                <span style={{ width: `${playerProgress}%` }} />
              </span>
            </div>
          </header>

          <main className="handoff-layout">
            <section className="handoff-card paper-panel">
              <p className="eyebrow">Private card pick</p>
              <div className="handoff-card__number" aria-hidden="true">
                {String(currentPlayer).padStart(2, '0')}
              </div>
              <h1>Pass the device</h1>
              <p className="handoff-card__lede">
                Player {currentPlayer}, your choices are secret. Make sure no
                one else is peeking before you reveal the cards.
              </p>
              <div className="privacy-note">
                <span className="privacy-note__icon" aria-hidden="true">
                  ◉
                </span>
                <span>
                  <strong>For your eyes only</strong>
                  You&apos;ll pick {cardsPerPlayer} from {cardsPerPlayer + 2}{' '}
                  cards
                </span>
              </div>
              <button
                className="game-button game-button--primary"
                onClick={() => setIsReady(true)}
              >
                Reveal my cards
                <span aria-hidden="true">→</span>
              </button>
            </section>

            <aside className="handoff-aside" aria-hidden="true">
              <span className="handoff-aside__label">Next up</span>
              <strong>Player {currentPlayer}</strong>
              <span>Choose wisely. Everyone plays with this deck.</span>
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
              Player {currentPlayer} of {players}
            </span>
            <span className="selection-status__count">
              <strong>{selectedCards.length}</strong> / {cardsPerPlayer}{' '}
              selected
            </span>
          </div>
        </header>

        <main className="selection-main">
          <div className="selection-heading">
            <div>
              <p className="eyebrow eyebrow--on-dark">Build the shared deck</p>
              <h1>Pick your favorites</h1>
            </div>
            <p>
              Choose the names you know—or the ones that will be funniest to
              describe later.
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
                    <span className="level-badge">Level {card.level}</span>
                    <span className="selection-card__check" aria-hidden="true">
                      ✓
                    </span>
                  </span>
                  <strong>{card.word}</strong>
                  <span className="selection-card__description">
                    {card.description}
                  </span>
                  <span className="selection-card__action" aria-hidden="true">
                    {isSelected ? 'In your deck' : 'Tap to choose'}
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
            <span aria-label={`${selectedCards.length} cards selected`}>
              {selectedCards.length}
            </span>
            <p>
              <strong>
                {cardsLeftToPick === 0
                  ? 'All picked'
                  : `${cardsLeftToPick} ${cardsLeftToPick === 1 ? 'card' : 'cards'} left`}
              </strong>
              <span>
                {selectedCards.length} of {cardsPerPlayer} selected
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
              ? 'Pass to next player'
              : 'Finish the deck'}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </GameShell>
  );
}
