'use client';

import { useEffect, useState } from 'react';

import { Input } from '@/shared/ui/Input/Input';
import { MaterialSymbol } from '@/shared/ui/MaterialSymbol/MaterialSymbol';

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

  return (
    <div className={styles.numberControl}>
      <div className={styles.copy}>
        <label htmlFor={id}>{label}</label>
        <span id={`${id}-hint`}>{hint}</span>
      </div>
      <div className={styles.stepper}>
        <button
          type="button"
          onClick={() => updateValue(value - 1)}
          disabled={disabled || value <= min}
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
          required
          disabled={disabled}
          aria-describedby={`${id}-hint`}
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
          onClick={() => updateValue(value + 1)}
          disabled={disabled || value >= max}
          aria-label={`Tambah ${label.toLowerCase()}`}
        >
          <MaterialSymbol name="add" />
        </button>
      </div>
    </div>
  );
}
