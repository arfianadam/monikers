'use client';

import { NumberStepper } from '@/shared/ui/NumberStepper/NumberStepper';

import styles from './NumberControl.module.css';

interface NumberControlProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export function NumberControl({
  id,
  label,
  hint,
  value,
  min,
  max,
  disabled = false,
  onChange,
}: NumberControlProps) {
  return (
    <div className={styles.numberControl}>
      <div className={styles.copy}>
        <label htmlFor={id}>{label}</label>
        <span id={`${id}-hint`}>{hint}</span>
      </div>
      <NumberStepper
        id={id}
        label={label}
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        required
        aria-describedby={`${id}-hint`}
        onChange={onChange}
      />
    </div>
  );
}
