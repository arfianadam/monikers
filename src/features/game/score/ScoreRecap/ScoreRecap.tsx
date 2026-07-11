import type {
  RoundNumber,
  ScoresByRound,
  TeamId,
} from '@/features/game/domain/game-types';
import { getCardPoints } from '@/features/game/domain/scoring';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { Panel } from '@/shared/ui/Panel/Panel';

import styles from './ScoreRecap.module.css';

export interface ScoreRecapProps {
  scores: ScoresByRound;
  rounds: readonly RoundNumber[];
}

export function ScoreRecap({ scores, rounds }: ScoreRecapProps) {
  return (
    <Panel as="section" className={styles.recap}>
      <div className={styles.header}>
        <div>
          <Eyebrow className={styles.headerEyebrow}>Babak demi babak</Eyebrow>
          <h2>Perolehan poin</h2>
        </div>
        <span>{rounds.length} / 3 selesai</span>
      </div>

      <div className={styles.rounds}>
        {rounds.map((round) => (
          <article className={styles.round} key={round}>
            <div className={styles.roundLabel}>
              <span>0{round}</span>
              <strong>Babak {round}</strong>
            </div>
            <div className={styles.teams}>
              {([1, 2] as const).map((team) => {
                const teamId: TeamId = team === 1 ? 'team1' : 'team2';
                const cards = scores[teamId][round] ?? [];
                const points = getCardPoints(cards);

                return (
                  <details className={styles.teamResult} key={team}>
                    <summary>
                      <span
                        className={
                          team === 1 ? styles.teamOneDot : styles.teamTwoDot
                        }
                      />
                      <span>
                        <strong>Tim {team}</strong>
                        {cards.length} kartu
                      </span>
                      <strong>{points} poin</strong>
                      <span className={styles.toggle} aria-hidden="true">
                        +
                      </span>
                    </summary>
                    <div className={styles.cardChipList}>
                      {cards.length > 0 ? (
                        cards.map((card) => (
                          <span key={card.word}>
                            {card.word}
                            <small>+{card.level}</small>
                          </span>
                        ))
                      ) : (
                        <span className={styles.empty}>
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
    </Panel>
  );
}
