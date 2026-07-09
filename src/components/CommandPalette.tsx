'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/lang-context';

const COMMANDS = [
  { label: 'Dashboard',         href: '/',                    hint: 'g h', icon: '⬛' },
  { label: 'Inventory',         href: '/vehicles',            hint: 'g i', icon: '🚗' },
  { label: 'Import Shipments',  href: '/import',              hint: '',    icon: '🚢' },
  { label: 'Leads & CRM',       href: '/crm',                 hint: 'g c', icon: '👥' },
  { label: 'WhatsApp Hub',      href: '/whatsapp',            hint: '',    icon: '💬' },
  { label: 'Deals',             href: '/deals',               hint: 'g d', icon: '📄' },
  { label: 'Appointments',      href: '/appointments',        hint: 'g a', icon: '📅' },
  { label: 'Service Center',    href: '/service',             hint: '',    icon: '🔧' },
  { label: 'Parts',             href: '/parts',               hint: '',    icon: '📦' },
  { label: 'Transfers',         href: '/transfers',           hint: '',    icon: '↔️' },
  { label: 'Floor Plan',        href: '/floor-plan',          hint: '',    icon: '🏦' },
  { label: 'Petty Cash',        href: '/petty-cash',          hint: '',    icon: '💵' },
  { label: 'Finance',           href: '/finance',             hint: 'g f', icon: '💰' },
  { label: 'Reports',           href: '/reports',             hint: 'g r', icon: '📊' },
  { label: 'Sales Targets',     href: '/reports/targets',     hint: '',    icon: '🎯' },
  { label: 'Sales Funnel',      href: '/reports/funnel',      hint: '',    icon: '📉' },
  { label: 'My Commissions',    href: '/reports/my-commissions', hint: '', icon: '⭐' },
  { label: 'Executive View',    href: '/executive',           hint: '',    icon: '👁️' },
  { label: 'Users & Locations', href: '/settings/users',      hint: 'g u', icon: '👤' },
  { label: 'Settings',          href: '/settings',            hint: 'g s', icon: '⚙️' },
];

const CMD_LABELS_AR: Record<string, string> = {
  'Dashboard':         'لوحة التحكم',
  'Inventory':         'المخزن',
  'Import Shipments':  'شحنات الاستيراد',
  'Leads & CRM':       'العملاء المحتملون',
  'WhatsApp Hub':      'واتساب',
  'Deals':             'الصفقات',
  'Appointments':      'المواعيد',
  'Service Center':    'مركز الخدمة',
  'Parts':             'قطع الغيار',
  'Transfers':         'التحويلات',
  'Floor Plan':        'تمويل المعرض',
  'Petty Cash':        'النثريات',
  'Finance':           'المالية',
  'Reports':           'التقارير',
  'Sales Targets':     'أهداف المبيعات',
  'Sales Funnel':      'مسار المبيعات',
  'My Commissions':    'عمولاتي',
  'Executive View':    'عرض تنفيذي',
  'Users & Locations': 'المستخدمون والفروع',
  'Settings':          'الإعدادات',
};

export default function CommandPalette() {
  const { isAr } = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filtered = COMMANDS.filter(c => {
    const q = query.toLowerCase();
    const en = c.label.toLowerCase();
    const ar = isAr ? (CMD_LABELS_AR[c.label] ?? '').toLowerCase() : '';
    return en.includes(q) || ar.includes(q);
  });

  const close = useCallback(() => setOpen(false), []);

  // Toggle on ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus input when opened; reset state
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      // defer to next tick so the element is rendered
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Keep activeIdx in bounds when filter changes
  useEffect(() => {
    setActiveIdx(i => Math.min(i, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  function navigate(href: string) {
    router.push(href);
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[activeIdx]) navigate(filtered[activeIdx].href);
        break;
    }
  }

  if (!open) return null;

  return (
    // Overlay — click outside closes
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) close(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
      }}
    >
      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          maxWidth: '560px',
          margin: '0 1rem',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: '0.75rem',
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Search input row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border)',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            placeholder={isAr ? 'بحث في الأوامر…' : 'Search commands…'}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '0.9375rem',
              color: 'var(--text-1)',
              fontFamily: 'inherit',
            }}
          />
          <kbd style={{
            fontSize: '0.6875rem',
            padding: '0.125rem 0.375rem',
            borderRadius: '0.25rem',
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text-3)',
            fontFamily: 'inherit',
          }}>
            esc
          </kbd>
        </div>

        {/* Results list */}
        <div style={{ padding: '0.375rem', maxHeight: '320px', overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <p style={{ padding: '1.25rem', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-3)' }}>
              {isAr ? `لا نتائج لـ "${query}"` : `No results for "${query}"`}
            </p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.href}
                onClick={() => navigate(cmd.href)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  background: i === activeIdx ? 'var(--primary)' : 'transparent',
                  color: i === activeIdx ? 'var(--primary-fg)' : 'var(--text-1)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0, opacity: i === activeIdx ? 1 : 0.7 }}>
                  {cmd.icon}
                </span>
                <span style={{ flex: 1, fontWeight: 500 }}>{isAr ? (CMD_LABELS_AR[cmd.label] ?? cmd.label) : cmd.label}</span>
                <kbd style={{
                  fontSize: '0.6875rem',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem',
                  border: `1px solid ${i === activeIdx ? 'rgba(255,255,255,0.3)' : 'var(--border)'}`,
                  background: i === activeIdx ? 'rgba(255,255,255,0.15)' : 'var(--surface-2)',
                  color: i === activeIdx ? 'rgba(255,255,255,0.85)' : 'var(--text-3)',
                  fontFamily: 'inherit',
                  letterSpacing: '0.05em',
                }}>
                  {cmd.hint}
                </kbd>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          display: 'flex',
          gap: '1.25rem',
          padding: '0.5rem 1rem',
          borderTop: '1px solid var(--border)',
          fontSize: '0.6875rem',
          color: 'var(--text-3)',
        }}>
          <span><kbd style={{ fontFamily: 'inherit' }}>↑↓</kbd> {isAr ? 'تنقل' : 'navigate'}</span>
          <span><kbd style={{ fontFamily: 'inherit' }}>↵</kbd> {isAr ? 'فتح' : 'open'}</span>
          <span><kbd style={{ fontFamily: 'inherit' }}>esc</kbd> {isAr ? 'إغلاق' : 'close'}</span>
        </div>
      </div>
    </div>
  );
}
