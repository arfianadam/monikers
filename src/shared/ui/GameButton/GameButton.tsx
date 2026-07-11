import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

import styles from './GameButton.module.css';

export type GameButtonVariant = 'primary' | 'secondary' | 'success';

export interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GameButtonVariant;
}

export const GameButton = forwardRef<HTMLButtonElement, GameButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <button
      {...props}
      ref={ref}
      className={cn(styles.button, styles[variant], className)}
    />
  )
);

GameButton.displayName = 'GameButton';
