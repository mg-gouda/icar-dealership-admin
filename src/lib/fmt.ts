export function fmtDate(
  d: string | null | undefined,
  isAr: boolean,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return isAr ? 'تاريخ غير صالح' : 'Invalid Date';
  return date.toLocaleDateString(isAr ? 'ar-EG' : 'en-EG', opts);
}

export function fmtDateTime(
  d: string | null | undefined,
  isAr: boolean,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return isAr ? 'تاريخ غير صالح' : 'Invalid Date';
  return date.toLocaleString(isAr ? 'ar-EG' : 'en-EG', opts);
}
