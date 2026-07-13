import type { Card } from '@/features/game/domain/game-types';
import { cn } from '@/lib/utils';
import { MaterialSymbol } from '@/shared/ui/MaterialSymbol/MaterialSymbol';

import styles from './SelectionCard.module.css';

interface SelectionCardProps {
  card: Card;
  selected: boolean;
  pending?: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export function SelectionCard({
  card,
  selected,
  pending = false,
  disabled = false,
  onToggle,
}: SelectionCardProps) {
  return (
    <button
      type="button"
      className={cn(
        styles.selectionCard,
        selected && styles.selectedCard,
        pending && styles.pendingCard
      )}
      data-level={card.level}
      aria-pressed={selected}
      disabled={disabled || pending}
      onClick={onToggle}
    >
      <span className={styles.cardTopline}>
        <span className={styles.levelBadge}>Tingkat {card.level}</span>
        <MaterialSymbol name="check" className={styles.cardCheck} filled />
      </span>
      <strong>{card.word}</strong>
      <span className={styles.cardDescription}>{card.description}</span>
      <span className={styles.cardAction} aria-hidden="true">
        {selected ? 'Sudah dipilih' : 'Ketuk untuk memilih'}
        <MaterialSymbol name={selected ? 'check' : 'add'} filled={selected} />
      </span>
    </button>
  );
}
