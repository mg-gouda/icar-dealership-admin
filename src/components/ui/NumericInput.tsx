'use client';

import { useState } from 'react';

interface NumericInputProps {
  value: string | number;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  readOnly?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  id?: string;
  name?: string;
}

function toFormatted(val: string | number): string {
  const s = String(val).replace(/,/g, '');
  if (s === '' || s === '-') return s;
  const n = parseFloat(s);
  if (isNaN(n)) return s;
  // Preserve trailing decimal point / zeros while typing — only format on blur
  const parts = s.split('.');
  const intPart = parseInt(parts[0], 10);
  const formatted = isNaN(intPart) ? parts[0] : intPart.toLocaleString('en-US');
  return parts.length > 1 ? `${formatted}.${parts[1]}` : formatted;
}

function toRaw(val: string): string {
  return val.replace(/,/g, '');
}

export default function NumericInput({
  value, onChange, className, placeholder, min, max, step,
  readOnly, disabled, style, id, name,
}: NumericInputProps) {
  const [focused, setFocused] = useState(false);

  const rawVal = toRaw(String(value ?? ''));
  const displayVal = focused ? rawVal : (rawVal ? toFormatted(rawVal) : '');

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      className={className}
      style={style}
      readOnly={readOnly}
      disabled={disabled}
      placeholder={placeholder}
      value={displayVal}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        // Allow digits, one decimal point, leading minus
        const cleaned = e.target.value.replace(/[^0-9.\-]/g, '');
        onChange(cleaned);
      }}
      min={min}
      max={max}
      step={step}
    />
  );
}
