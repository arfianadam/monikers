'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { Input } from '@/shared/ui/Input/Input';
import { MaterialSymbol } from '@/shared/ui/MaterialSymbol/MaterialSymbol';
import styles from './NumberStepper.module.css';

export interface NumberStepperProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-describedby'?: string;
  onChange: (value: number) => void;
}

export function NumberStepper({
  id,
  label,
  value,
  min,
  max,
  className,
  disabled = false,
  required = false,
  'aria-describedby': ariaDescribedBy,
  onChange,
}: NumberStepperProps) {
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

  const parsedDraftValue = Number(draftValue);
  const displayedValue =
    draftValue !== '' && Number.isFinite(parsedDraftValue)
      ? parsedDraftValue
      : value;

  return (
    <div className={cn(styles.stepper, className)}>
      <button
        type="button"
        className={styles.button}
        onClick={() => updateValue(displayedValue - 1)}
        disabled={disabled || displayedValue <= min}
        aria-label={`Kurangi ${label.toLowerCase()}`}
      >
        <MaterialSymbol name="remove" />
      </button>
      <Input
        id={id}
        type="number"
        className={styles.input}
        inputMode="numeric"
        value={draftValue}
        min={min}
        max={max}
        step={1}
        required={required}
        disabled={disabled}
        aria-label={label}
        aria-describedby={ariaDescribedBy}
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
        className={styles.button}
        onClick={() => updateValue(displayedValue + 1)}
        disabled={disabled || displayedValue >= max}
        aria-label={`Tambah ${label.toLowerCase()}`}
      >
        <MaterialSymbol name="add" />
      </button>
    </div>
  );
}
