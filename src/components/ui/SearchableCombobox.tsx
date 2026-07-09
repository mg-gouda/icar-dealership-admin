'use client';

import { useState, useRef, useEffect, useId } from 'react';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
}

interface Props {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
  clearLabel?: string;
}

export default function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  label,
  disabled = false,
  className = '',
  clearable = false,
  clearLabel = 'All',
}: Props) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const containerRef        = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLInputElement>(null);
  const id                  = useId();

  const selected = options.find((o) => o.value === value);
  const display  = selected?.label ?? '';

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.description?.toLowerCase().includes(search.toLowerCase()) ?? false),
  );

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function openDropdown() {
    if (disabled) return;
    setOpen(true);
    setSearch('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function select(v: string) {
    onChange(v);
    setOpen(false);
    setSearch('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); setSearch(''); }
    if (e.key === 'Enter' && filtered.length === 1) select(filtered[0].value);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="input-label">{label}</label>
      )}

      {/* Trigger */}
      <button
        id={id}
        type="button"
        onClick={openDropdown}
        disabled={disabled}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          background: 'var(--surface)',
          border: `1px solid ${open ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: '0.4rem',
          padding: '0.5rem 0.75rem',
          fontSize: '0.8125rem',
          color: display ? 'var(--text-1)' : 'var(--text-3)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          outline: 'none',
          boxShadow: open ? '0 0 0 3px oklch(from var(--primary) l c h / 0.12)' : 'none',
          transition: 'border-color 150ms, box-shadow 150ms',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {display || placeholder}
        </span>
        <svg
          style={{
            width: '0.875rem', height: '0.875rem',
            color: 'var(--text-3)', flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms',
          }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          zIndex: 50,
          marginTop: '0.25rem',
          width: '100%',
          minWidth: '11rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.625rem',
          boxShadow: '0 8px 24px oklch(0 0 0 / 0.12)',
          overflow: 'hidden',
        }}>
          {/* Search */}
          <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'var(--surface-2)',
              borderRadius: '0.4rem',
              padding: '0.35rem 0.625rem',
            }}>
              <svg style={{ width: '0.875rem', height: '0.875rem', color: 'var(--text-3)', flexShrink: 0 }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search…"
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.8125rem',
                  color: 'var(--text-1)',
                  width: '100%',
                }}
              />
            </div>
          </div>

          {/* Options */}
          <div style={{ maxHeight: '13rem', overflowY: 'auto', padding: '0.25rem 0' }}>
            {clearable && (
              <button
                type="button"
                onClick={() => select('')}
                style={{
                  width: '100%', textAlign: 'start',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8125rem',
                  background: value === '' ? 'var(--info-bg)' : 'transparent',
                  color: value === '' ? 'var(--primary)' : 'var(--text-2)',
                  border: 'none', cursor: 'pointer',
                  transition: 'background 100ms',
                }}
                onMouseEnter={(e) => { if (value !== '') (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={(e) => { if (value !== '') (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                — {clearLabel} —
              </button>
            )}
            {filtered.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => select(o.value)}
                  style={{
                    width: '100%', textAlign: 'start',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8125rem',
                    background: active ? 'var(--info-bg)' : 'transparent',
                    color: active ? 'var(--primary)' : 'var(--text-1)',
                    border: 'none', cursor: 'pointer',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <span style={{ display: 'block' }}>{o.label}</span>
                  {o.description && (
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.125rem' }}>
                      {o.description}
                    </span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p style={{ padding: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-3)', textAlign: 'center' }}>
                No results for &ldquo;{search}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
