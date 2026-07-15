import { cn } from '@/lib/utils';

import styles from './ScoreDuel.module.css';

export interface ScoreDuelProps {
  team1Total: number;
  team2Total: number;
  leader: 1 | 2 | null;
  isGameOver: boolean;
}

export function ScoreDuel({
  team1Total,
  team2Total,
  leader,
  isGameOver,
}: ScoreDuelProps) {
  const isTie = leader === null;

  return (
    <section className={styles.duel} aria-label="Skor tim">
      {([1, 2] as const).map((team) => {
        const total = team === 1 ? team1Total : team2Total;
        const isLeader = leader === team;

        return (
          <article
            key={team}
            className={cn(
              styles.teamCard,
              team === 2 && styles.teamTwo,
              isLeader && styles.leader
            )}
          >
            <div className={styles.topline}>
              <span>Tim {team}</span>
              {isLeader && (
                <span className={styles.leaderSticker}>
                  {isGameOver ? 'Winner' : 'Unggul'}
                </span>
              )}
              {isTie && <span className={styles.leaderSticker}>Seri</span>}
            </div>
            <strong className={styles.score}>{total}</strong>
            <span className={styles.label}>total poin</span>
          </article>
        );
      })}
      <span className={styles.versus} aria-hidden="true">
        vs
      </span>
    </section>
  );
}
