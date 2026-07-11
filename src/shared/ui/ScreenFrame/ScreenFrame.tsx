import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

import styles from './ScreenFrame.module.css';

export type ScreenFrameProps = HTMLAttributes<HTMLDivElement>;

export const ScreenFrame = forwardRef<HTMLDivElement, ScreenFrameProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} {...props} className={cn(styles.frame, className)} />
  )
);

ScreenFrame.displayName = 'ScreenFrame';
