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
  /** Allow clearing the selection (shows "— All —" or placeholder as first option) */
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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? '';

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.description?.toLowerCase().includes(search.toLowerCase()) ?? false),
  );

  // Close on outside click
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
        <label htmlFor={id} className="block text-xs text-gray-500 mb-1">{label}</label>
      )}

      {/* Trigger */}
      <button
        id={id}
        type="button"
        onClick={openDropdown}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2
          bg-gray-800 border text-white text-xs rounded-lg px-3 py-1.5
          focus:outline-none focus:ring-1 focus:ring-blue-500 transition
          ${disabled ? 'opacity-50 cursor-not-allowed border-white/5' : 'border-white/10 hover:border-white/20 cursor-pointer'}
          ${open ? 'border-blue-500/50 ring-1 ring-blue-500/40' : ''}
        `}
      >
        <span className={display ? 'text-white' : 'text-gray-500'}>
          {display || placeholder}
        </span>
        <svg className={`w-3.5 h-3.5 text-gray-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[180px] rounded-xl border border-white/10 bg-gray-850 bg-gray-900 shadow-xl shadow-black/40 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-white/5">
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-2.5 py-1.5">
              <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search…"
                className="bg-transparent text-white text-xs placeholder-gray-600 focus:outline-none w-full"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto py-1">
            {clearable && (
              <button
                type="button"
                onClick={() => select('')}
                className={`w-full text-left px-3 py-2 text-xs transition ${
                  value === '' ? 'bg-blue-600/20 text-blue-300' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                — {clearLabel} —
              </button>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => select(o.value)}
                className={`w-full text-left px-3 py-2 text-xs transition ${
                  o.value === value
                    ? 'bg-blue-600/20 text-blue-300'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="block">{o.label}</span>
                {o.description && (
                  <span className="block text-gray-500 mt-0.5">{o.description}</span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-xs text-gray-600 text-center">No results for "{search}"</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
