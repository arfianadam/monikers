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
      ? 'Hasil seri yang legendaris.'
      : `Tim ${leader} merebut mahkota.`
    : `Babak ${latestRound} telah usai.`;

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
              {isGameOver ? 'Skor akhir' : 'Cek skor'}
            </p>
            <h1>{title}</h1>
            <p>
              {isGameOver
                ? 'Petunjuknya berani, tebakannya meragukan, dan perolehan poinnya sudah sah.'
                : 'Tarik napas, lihat hasilnya, lalu bersiap untuk babak yang lebih menantang.'}
            </p>
          </div>

          <section className="score-duel" aria-label="Skor tim">
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
                    <span>Tim {team}</span>
                    {isLeader && (
                      <span className="leader-sticker">
                        {isGameOver ? 'Pemenang' : 'Unggul'}
                      </span>
                    )}
                    {isTie && <span className="leader-sticker">Seri</span>}
                  </div>
                  <strong className="team-score-card__score">{total}</strong>
                  <span className="team-score-card__label">total poin</span>
                </article>
              );
            })}
            <span className="score-duel__versus" aria-hidden="true">
              lawan
            </span>
          </section>

          <section className="paper-panel score-recap">
            <div className="score-recap__header">
              <div>
                <p className="eyebrow">Babak demi babak</p>
                <h2>Perolehan poin</h2>
              </div>
              <span>{rounds.length} / 3 selesai</span>
            </div>

            <div className="score-recap__rounds">
              {rounds.map((round) => (
                <article className="round-recap" key={round}>
                  <div className="round-recap__label">
                    <span>0{round}</span>
                    <strong>Babak {round}</strong>
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
                              <strong>Tim {team}</strong>
                              {cards.length} kartu
                            </span>
                            <strong>{points} poin</strong>
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
                                Tidak ada kartu di babak ini
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
                ? 'Pemain yang sama, deck baru?'
                : `Berikutnya: Babak ${latestRound + 1}`}
            </p>
            <button
              onClick={isGameOver ? onPlayAgain : onNextRound}
              className="game-button game-button--primary"
            >
              {isGameOver ? 'Main lagi' : 'Mulai babak berikutnya'}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </main>
      </div>
    </GameShell>
  );
}
