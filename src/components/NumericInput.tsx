import React, { useEffect, useRef, useState } from 'react';

const numericPattern = /^-?\d*(\.\d*)?$/;

export interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onValueCommit: (value: number) => void;
  precision?: number;
}

const formatValue = (value: number, precision?: number) => {
  if (!Number.isFinite(value)) return '';
  if (precision === undefined) {
    return `${value}`;
  }
  return Number(value.toFixed(precision)).toString();
};

const getPrecisionFromStep = (step?: number | string): number | undefined => {
  if (typeof step === 'number') {
    const decimal = step.toString().split('.')[1];
    return decimal ? decimal.length : undefined;
  }
  if (typeof step === 'string') {
    const decimal = step.split('.')[1];
    return decimal ? decimal.length : undefined;
  }
  return undefined;
};

const NumericInput: React.FC<NumericInputProps> = ({ value, onValueCommit, precision, step, onBlur, onFocus, onKeyDown, ...rest }) => {
  const derivedPrecision = precision ?? getPrecisionFromStep(typeof step === 'string' ? Number(step) : step);
  const [draft, setDraft] = useState<string>(formatValue(value, derivedPrecision));
  const [isEditing, setIsEditing] = useState(false);
  const previousValue = useRef<number>(value);

  useEffect(() => {
    if (!isEditing || value !== previousValue.current) {
      setDraft(formatValue(value, derivedPrecision));
      previousValue.current = value;
    }
  }, [value, derivedPrecision, isEditing]);

  const commit = (raw: string = draft) => {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === '-.') {
      setDraft(formatValue(value, derivedPrecision));
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed)) {
      onValueCommit(parsed);
      setDraft(formatValue(parsed, derivedPrecision));
      previousValue.current = parsed;
    } else {
      setDraft(formatValue(value, derivedPrecision));
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    if (!numericPattern.test(next)) {
      return;
    }
    setDraft(next);
    if (next !== '' && next !== '-' && next !== '.' && next !== '-.' && !next.endsWith('.')) {
      const parsed = Number(next);
      if (!Number.isNaN(parsed)) {
        onValueCommit(parsed);
        previousValue.current = parsed;
      }
    }
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    setIsEditing(true);
    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    setIsEditing(false);
    commit(event.currentTarget.value);
    onBlur?.(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commit(event.currentTarget.value);
      event.currentTarget.blur();
    }
    onKeyDown?.(event);
  };

  return (
    <input
      type="number"
      {...rest}
      step={step}
      value={draft}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
};

export default NumericInput;

