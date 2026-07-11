import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

import styles from './Panel.module.css';

export type PanelElement = 'article' | 'div' | 'section';

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: PanelElement;
}

export function Panel({
  as: Component = 'div',
  className,
  ...props
}: PanelProps) {
  return <Component {...props} className={cn(styles.panel, className)} />;
}
