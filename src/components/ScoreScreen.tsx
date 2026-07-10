'use client';

import { cn } from '@/lib/utils';

import type { Card, ScoresByRound } from './GameScreen';
import { Brand, GameShell, RoundPips } from './ui/GameChrome';

interface Props {
  scores: ScoresByRound;
  onPlayAgain: () => void;
  onNextRound: () => void;
  isGameOver: boolean;
}

function getCardPoints(cards: Card[]) {
  return cards.reduce((total, card) => total + card.level, 0);
}

function getTeamTotal(scores: ScoresByRound, team: string) {
  return Object.values(scores[team] ?? {})
    .flat()
    .reduce((total, card) => total + card.level, 0);
}

export default function ScoreScreen({
  scores,
  onPlayAgain,
  onNextRound,
  isGameOver,
}: Props) {
  const team1Total = getTeamTotal(scores, 'team1');
  const team2Total = getTeamTotal(scores, 'team2');
  const isTie = team1Total === team2Total;
  const leader = isTie ? null : team1Total > team2Total ? 1 : 2;
  const rounds = Array.from(
    new Set([
      ...Object.keys(scores.team1 ?? {}),
      ...Object.keys(scores.team2 ?? {}),
    ])
  )
    .map(Number)
    .sort((first, second) => first - second);
  const latestRound = rounds.at(-1) ?? 1;

  const title = isGameOver
    ? isTie
      ? 'A legendary tie.'
      : `Team ${leader} takes the crown.`
    : `Round ${latestRound} is in the books.`;

  return (
    <GameShell
      className={cn('game-shell--score', isGameOver && 'game-shell--final')}
    >
      <div className="screen-frame score-screen">
        <header className="topbar">
          <Brand compact />
          <RoundPips round={latestRound} />
        </header>

        <main className="score-main">
          <div className="score-heading">
            <p className="eyebrow eyebrow--on-dark">
              {isGameOver ? 'Final score' : 'Score check'}
            </p>
            <h1>{title}</h1>
            <p>
              {isGameOver
                ? 'The clues were bold, the guesses were questionable, and the points are official.'
                : 'Take a breath, review the damage, and get ready for a trickier round.'}
            </p>
          </div>

          <section className="score-duel" aria-label="Team scores">
            {[1, 2].map((team) => {
              const total = team === 1 ? team1Total : team2Total;
              const isLeader = leader === team;

              return (
                <article
                  key={team}
                  className={cn(
                    'team-score-card',
                    `team-score-card--team-${team}`,
                    isLeader && 'team-score-card--leader'
                  )}
                >
                  <div className="team-score-card__topline">
                    <span>Team {team}</span>
                    {isLeader && (
                      <span className="leader-sticker">
                        {isGameOver ? 'Winner' : 'Leading'}
                      </span>
                    )}
                    {isTie && <span className="leader-sticker">Tied</span>}
                  </div>
                  <strong className="team-score-card__score">{total}</strong>
                  <span className="team-score-card__label">total points</span>
                </article>
              );
            })}
            <span className="score-duel__versus" aria-hidden="true">
              vs
            </span>
          </section>

          <section className="paper-panel score-recap">
            <div className="score-recap__header">
              <div>
                <p className="eyebrow">Round by round</p>
                <h2>How the points landed</h2>
              </div>
              <span>{rounds.length} / 3 complete</span>
            </div>

            <div className="score-recap__rounds">
              {rounds.map((round) => (
                <article className="round-recap" key={round}>
                  <div className="round-recap__label">
                    <span>0{round}</span>
                    <strong>Round {round}</strong>
                  </div>
                  <div className="round-recap__teams">
                    {[1, 2].map((team) => {
                      const cards = scores[`team${team}`]?.[round] ?? [];
                      const points = getCardPoints(cards);

                      return (
                        <details className="round-team-result" key={team}>
                          <summary>
                            <span className={`team-dot team-dot--${team}`} />
                            <span>
                              <strong>Team {team}</strong>
                              {cards.length}{' '}
                              {cards.length === 1 ? 'card' : 'cards'}
                            </span>
                            <strong>{points} pts</strong>
                            <span
                              className="round-team-result__toggle"
                              aria-hidden="true"
                            >
                              +
                            </span>
                          </summary>
                          <div className="card-chip-list">
                            {cards.length > 0 ? (
                              cards.map((card) => (
                                <span key={card.word}>
                                  {card.word}
                                  <small>+{card.level}</small>
                                </span>
                              ))
                            ) : (
                              <span className="card-chip-list__empty">
                                No cards this round
                              </span>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="score-action">
            <p>
              {isGameOver
                ? 'Same crew, fresh deck?'
                : `Next up: Round ${latestRound + 1}`}
            </p>
            <button
              onClick={isGameOver ? onPlayAgain : onNextRound}
              className="game-button game-button--primary"
            >
              {isGameOver ? 'Play again' : 'Start next round'}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </main>
      </div>
    </GameShell>
  );
}
