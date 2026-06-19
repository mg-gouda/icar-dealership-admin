'use client';

const KEY = 'fieldPermissions';

export interface FieldPermission {
  entity: string;
  field: string;
  canView: boolean;
  canWrite: boolean;
}

export function cacheFieldPermissions(perms: FieldPermission[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(perms));
}

export function getFieldPermissions(): FieldPermission[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); }
  catch { return []; }
}

export function canViewField(entity: string, field: string): boolean {
  const perms = getFieldPermissions();
  if (!perms.length) return true; // not loaded yet — show by default
  const p = perms.find((x) => x.entity === entity && x.field === field);
  return p ? p.canView : true;
}

export function canWriteField(entity: string, field: string): boolean {
  const perms = getFieldPermissions();
  if (!perms.length) return true;
  const p = perms.find((x) => x.entity === entity && x.field === field);
  return p ? p.canWrite : true;
}
