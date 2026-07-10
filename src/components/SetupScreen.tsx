'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';

import { Brand, GameShell } from './ui/GameChrome';
import { Input } from './ui/input';

interface Props {
  onStartGame: (players: number, cards: number) => void;
}

interface NumberControlProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: Dispatch<SetStateAction<number>>;
}

function NumberControl({
  id,
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: NumberControlProps) {
  const [draftValue, setDraftValue] = useState(String(value));

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  const updateValue = (nextValue: number) => {
    const normalizedValue = Math.round(nextValue);
    const clampedValue = Math.min(max, Math.max(min, normalizedValue));
    onChange(clampedValue);
    setDraftValue(String(clampedValue));
  };

  const commitDraftValue = () => {
    const nextValue = Number(draftValue);
    updateValue(Number.isFinite(nextValue) ? nextValue : value);
  };

  return (
    <div className="number-control">
      <div className="number-control__copy">
        <label htmlFor={id}>{label}</label>
        <span id={`${id}-hint`}>{hint}</span>
      </div>
      <div className="number-control__stepper">
        <button
          type="button"
          onClick={() => updateValue(value - 1)}
          disabled={value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          −
        </button>
        <Input
          id={id}
          type="number"
          className="number-control__input"
          inputMode="numeric"
          value={draftValue}
          min={min}
          max={max}
          step={1}
          required
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            const nextDraftValue = event.target.value;
            const nextValue = Number(nextDraftValue);
            setDraftValue(nextDraftValue);
            if (
              nextDraftValue !== '' &&
              Number.isInteger(nextValue) &&
              nextValue >= min &&
              nextValue <= max
            ) {
              onChange(nextValue);
            }
          }}
          onBlur={commitDraftValue}
        />
        <button
          type="button"
          onClick={() => updateValue(value + 1)}
          disabled={value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function SetupScreen({ onStartGame }: Props) {
  const [players, setPlayers] = useState(4);
  const [cards, setCards] = useState(5);
  const totalCards = players * cards;

  return (
    <GameShell className="game-shell--setup">
      <div className="screen-frame setup-screen">
        <header className="topbar">
          <Brand />
          <p className="topbar__note">Pass-and-play · No login required</p>
        </header>

        <main className="setup-layout">
          <section className="setup-intro" aria-labelledby="setup-title">
            <p className="eyebrow eyebrow--on-dark">
              <span className="eyebrow__dot" />
              Your next game-night obsession
            </p>
            <h1 id="setup-title" className="display-title">
              Guess the name.
              <span>Lose your cool.</span>
            </h1>
            <p className="setup-intro__lede">
              Three rounds. Two teams. One deck of famous names that gets
              funnier every time around.
            </p>

            <div className="round-stack" aria-label="The three game rounds">
              <div className="round-stack__card round-stack__card--one">
                <span>01</span>
                Say anything
              </div>
              <div className="round-stack__card round-stack__card--two">
                <span>02</span>
                One word only
              </div>
              <div className="round-stack__card round-stack__card--three">
                <span>03</span>
                Act it out
              </div>
            </div>
          </section>

          <section className="paper-panel setup-ticket" aria-label="Game setup">
            <div className="setup-ticket__header">
              <div>
                <p className="eyebrow">Game setup</p>
                <h2>Build your deck</h2>
              </div>
              <span className="setup-ticket__number">№ 001</span>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                onStartGame(players, cards);
              }}
            >
              <NumberControl
                id="players"
                label="Players"
                hint="2–20 people, split into two teams"
                value={players}
                min={2}
                max={20}
                onChange={setPlayers}
              />
              <NumberControl
                id="cards"
                label="Cards each"
                hint="1–10, picked privately by every player"
                value={cards}
                min={1}
                max={10}
                onChange={setCards}
              />

              <div className="deck-summary" aria-live="polite">
                <span className="deck-summary__icon" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span>
                  <strong>{totalCards} card deck</strong>
                  {players} players · 3 rounds · about 30 minutes
                </span>
              </div>

              <button
                className="game-button game-button--primary"
                type="submit"
              >
                Start the game
                <span aria-hidden="true">→</span>
              </button>
            </form>
          </section>
        </main>

        <footer className="setup-footer">
          <span>Made for loud rooms and questionable clues.</span>
          <span>© arfianadam</span>
        </footer>
      </div>
    </GameShell>
  );
}
