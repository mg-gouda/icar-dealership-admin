'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from './useApi';

interface Location { id: string; name: string; }

interface LocationCtxType {
  locationId: string;
  setLocationId: (id: string) => void;
  locations: Location[];
}

const LocationCtx = createContext<LocationCtxType>({
  locationId: '',
  setLocationId: () => {},
  locations: [],
});

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [locationId, setLocationId] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    // ponytail: fire-and-forget; auth token read by apiFetch internally
    apiFetch<Location[] | { data: Location[] }>('/locations')
      .then(res => setLocations(Array.isArray(res) ? res : res.data))
      .catch(() => {});
  }, []);

  return (
    <LocationCtx.Provider value={{ locationId, setLocationId, locations }}>
      {children}
    </LocationCtx.Provider>
  );
}

export const useLocation = () => useContext(LocationCtx);

export const useLocationParam = () => {
  const { locationId } = useContext(LocationCtx);
  return locationId ? `&locationId=${locationId}` : '';
};

export function useApiUrl() {
  const { locationId } = useContext(LocationCtx);
  return (path: string, extraParams = '') => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1';
    const sep = path.includes('?') ? '&' : '?';
    const loc = locationId ? `${sep}locationId=${locationId}` : '';
    return `${base}${path}${loc}${extraParams}`;
  };
}
