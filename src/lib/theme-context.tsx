'use client';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeCtx {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: 'light', toggleTheme: () => {} });

const DARK: Record<string, string> = {
  '--bg':           '#1a1a1a',   /* page bg — slightly darker than surface */
  '--surface':      '#252525',   /* dominant — cards, panels, topbar */
  '--surface-2':    '#2e2e2e',   /* hover / subtle contrast */
  '--border':       '#3a3a3a',
  '--border-strong':'#4a4a4a',
  '--topbar-bg':    '#252525',
  '--topbar-border':'#3a3a3a',
  '--sidebar-bg':        '#191a1b',
  '--sidebar-border':    '#2e2e2e',
  '--sidebar-active-bg': 'rgba(255,255,255,0.08)',
  '--sidebar-active-dot':'#a0a0a0',
  '--tab-active':        '#a0a0a0',
  '--text-1':       '#f0f0f0',
  '--text-2':       '#a0a0a0',
  '--text-3':       '#666666',
  '--success-bg':   'oklch(0.22 0.06 145)',
  '--success-fg':   'oklch(0.72 0.17 145)',
  '--warning-bg':   'oklch(0.23 0.055 72)',
  '--warning-fg':   'oklch(0.84 0.16 72)',
  '--danger-bg':    'oklch(0.22 0.065 25)',
  '--danger-fg':    'oklch(0.74 0.18 25)',
  '--info-bg':      'oklch(0.21 0.065 265)',
  '--info-fg':      'oklch(0.74 0.2 265)',
  '--purple-bg':    'oklch(0.22 0.055 295)',
  '--purple-fg':    'oklch(0.74 0.18 295)',
  '--orange-bg':    'oklch(0.23 0.06 52)',
  '--orange-fg':    'oklch(0.80 0.19 52)',
};

function applyTheme(t: Theme) {
  const s = document.documentElement.style;
  if (t === 'dark') {
    Object.entries(DARK).forEach(([k, v]) => s.setProperty(k, v));
  } else {
    Object.keys(DARK).forEach(k => s.removeProperty(k));
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = localStorage.getItem('dealerms_theme') as Theme | null;
    const initial: Theme = saved === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function toggleTheme() {
    setTheme(prev => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('dealerms_theme', next);
      applyTheme(next);
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
