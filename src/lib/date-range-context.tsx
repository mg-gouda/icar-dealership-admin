'use client';

import { createContext, useContext, useState } from 'react';

export interface DateRange { from: string; to: string; }

interface DateRangeCtxType {
  dateRange: DateRange;
  setDateRange: (r: DateRange) => void;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const DateRangeCtx = createContext<DateRangeCtxType>({
  dateRange: { from: currentMonth(), to: currentMonth() },
  setDateRange: () => {},
});

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const cm = currentMonth();
  const [dateRange, setDateRange] = useState<DateRange>({ from: cm, to: cm });
  return (
    <DateRangeCtx.Provider value={{ dateRange, setDateRange }}>
      {children}
    </DateRangeCtx.Provider>
  );
}

export const useDateRange = () => useContext(DateRangeCtx);
