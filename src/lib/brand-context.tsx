'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

const APP_NAME = 'iCar Dealership';

interface BrandState {
  logoUrl:       string;
  displayName:   string;
  displayNameAr: string;
  primaryColor:  string;
  faviconUrl:    string;
}

interface BrandCtx extends BrandState {
  setLogo:           (url: string) => void;
  setDisplayName:    (name: string) => void;
  setDisplayNameAr:  (name: string) => void;
  setPrimaryColor:   (color: string) => void;
  setFavicon:        (url: string) => void;
  saveBrand:         () => void;
}

const STORAGE_KEY = 'dealerms_brand';
const DEFAULTS: BrandState = { logoUrl: '', displayName: '', displayNameAr: '', primaryColor: '#3B82F6', faviconUrl: '' };

const BrandContext = createContext<BrandCtx>({
  ...DEFAULTS,
  setLogo: () => {},
  setDisplayName: () => {},
  setDisplayNameAr: () => {},
  setPrimaryColor: () => {},
  setFavicon: () => {},
  saveBrand: () => {},
});

function applyColor(color: string) {
  document.documentElement.style.setProperty('--primary', color);
  document.documentElement.style.setProperty('--primary-hover', color);
}

function applyFavicon(url: string) {
  if (!url) return;
  // ponytail: update href in place — never remove React-managed <link> tags or reconciler crashes
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

function applyTitle(displayName: string) {
  document.title = displayName ? `${displayName} | ${APP_NAME}` : APP_NAME;
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BrandState>(DEFAULTS);
  const savedRef = useRef<BrandState>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: BrandState = { ...DEFAULTS, ...JSON.parse(raw) };
        setState(parsed);
        savedRef.current = parsed;
        applyColor(parsed.primaryColor);
        applyFavicon(parsed.faviconUrl);
        applyTitle(parsed.displayName);
      }
    } catch {}
  }, []);

  // keep title in sync when displayName changes in the session
  useEffect(() => {
    applyTitle(state.displayName);
  }, [state.displayName]);

  function setLogo(url: string) { setState(p => ({ ...p, logoUrl: url })); }
  function setDisplayName(name: string) { setState(p => ({ ...p, displayName: name })); }
  function setDisplayNameAr(name: string) { setState(p => ({ ...p, displayNameAr: name })); }
  function setPrimaryColor(color: string) {
    setState(p => ({ ...p, primaryColor: color }));
    applyColor(color);
  }
  function setFavicon(url: string) {
    setState(p => ({ ...p, faviconUrl: url }));
    applyFavicon(url);
  }

  function saveBrand() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    savedRef.current = state;
  }

  return (
    <BrandContext.Provider value={{ ...state, setLogo, setDisplayName, setDisplayNameAr, setPrimaryColor, setFavicon, saveBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export const useBrand = () => useContext(BrandContext);
