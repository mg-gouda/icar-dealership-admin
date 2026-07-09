function arOpts(isAr: boolean, opts?: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions | undefined {
  if (!isAr || !opts?.month) return opts;
  // Arabic has no useful abbreviations — always show full month name
  if (opts.month === 'short' || opts.month === 'narrow') return { ...opts, month: 'long' };
  return opts;
}

export function fmtDate(
  d: string | null | undefined,
  isAr: boolean,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return isAr ? 'تاريخ غير صالح' : 'Invalid Date';
  return date.toLocaleDateString(isAr ? 'ar-EG' : 'en-EG', arOpts(isAr, opts));
}

export function fmtDateTime(
  d: string | null | undefined,
  isAr: boolean,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return isAr ? 'تاريخ غير صالح' : 'Invalid Date';
  return date.toLocaleString(isAr ? 'ar-EG' : 'en-EG', arOpts(isAr, opts));
}
