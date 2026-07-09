'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useLang, type Lang } from '@/lib/lang-context';
import { useTheme } from '@/lib/theme-context';
import { apiFetch } from '@/lib/useApi';
import { API_BASE } from '@/lib/config';

interface Me { name: string; email: string; role: string; twoFactorEnabled?: boolean; }

/* ── small helpers ────────────────────────────────────────────────────────── */
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
        <p className="section-label" style={{ marginBottom: 0 }}>{title}</p>
      </div>
      <div style={{ padding: '1.25rem' }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <label className="input-label">{label}</label>
      {children}
    </div>
  );
}

function SaveBar({ saving, saved, error, label }: { saving: boolean; saved: boolean; error: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', gap: '0.75rem' }}>
      <span style={{ fontSize: '0.75rem', color: error ? 'var(--danger-fg)' : saved ? 'var(--success-fg)' : 'transparent', transition: 'color 200ms' }}>
        {error || (saved ? '✓ Saved' : '.')}
      </span>
      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
        {saving ? '…' : label}
      </button>
    </div>
  );
}

/* ── Password section ─────────────────────────────────────────────────────── */
function PasswordSection({ isAr }: { isAr: boolean }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function set(k: keyof typeof form, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.next !== form.confirm) {
      setError(isAr ? 'كلمتا المرور لا تتطابقان.' : 'Passwords do not match.');
      return;
    }
    if (form.next.length < 8) {
      setError(isAr ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' : 'Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      setForm({ current: '', next: '', confirm: '' });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isAr ? 'فشل تغيير كلمة المرور.' : 'Failed to change password.'));
    } finally { setSaving(false); }
  }

  return (
    <SectionCard title={isAr ? 'كلمة المرور' : 'Password'}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Field label={isAr ? 'كلمة المرور الحالية' : 'Current Password'}>
          <input type="password" className="input" value={form.current}
            onChange={e => set('current', e.target.value)}
            placeholder="••••••••" autoComplete="current-password" required />
        </Field>
        <Field label={isAr ? 'كلمة المرور الجديدة' : 'New Password'}>
          <input type="password" className="input" value={form.next}
            onChange={e => set('next', e.target.value)}
            placeholder="••••••••" autoComplete="new-password" required />
        </Field>
        <Field label={isAr ? 'تأكيد كلمة المرور' : 'Confirm New Password'}>
          <input type="password" className="input" value={form.confirm}
            onChange={e => set('confirm', e.target.value)}
            placeholder="••••••••" autoComplete="new-password" required />
        </Field>
        <SaveBar saving={saving} saved={saved} error={error}
          label={isAr ? 'تغيير كلمة المرور' : 'Change Password'} />
      </form>
    </SectionCard>
  );
}

/* ── Appearance section ───────────────────────────────────────────────────── */
function AppearanceSection({ isAr }: { isAr: boolean }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <SectionCard title={isAr ? 'المظهر' : 'Appearance'}>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', marginBottom: '1rem' }}>
        {isAr ? 'اختر مظهر الواجهة المناسب لك.' : 'Choose your preferred interface theme.'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        {/* Light */}
        <button type="button" onClick={() => theme === 'dark' && toggleTheme()}
          style={{
            padding: '0.875rem',
            borderRadius: '0.625rem',
            border: `2px solid ${theme === 'light' ? 'var(--tab-active)' : 'var(--border)'}`,
            background: theme === 'light' ? 'var(--surface-2)' : 'var(--surface)',
            cursor: theme === 'light' ? 'default' : 'pointer',
            transition: 'border-color 150ms, background 150ms',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
          }}>
          {/* Light mode preview */}
          <div style={{ width: 56, height: 40, borderRadius: 6, background: '#f4f4f5', border: '1px solid #e4e4e7', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: 14, height: '100%', background: '#1e2030' }} />
            <div style={{ flex: 1, padding: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ height: 4, borderRadius: 2, background: '#d4d4d8', width: '80%' }} />
              <div style={{ height: 4, borderRadius: 2, background: '#d4d4d8', width: '55%' }} />
              <div style={{ height: 4, borderRadius: 2, background: '#d4d4d8', width: '70%' }} />
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: theme === 'light' ? 600 : 400, color: theme === 'light' ? 'var(--text-1)' : 'var(--text-2)' }}>
            {isAr ? 'فاتح' : 'Light'}
          </span>
          {theme === 'light' && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--tab-active)', fontWeight: 500 }}>
              {isAr ? 'نشط' : 'Active'}
            </span>
          )}
        </button>

        {/* Dark */}
        <button type="button" onClick={() => theme === 'light' && toggleTheme()}
          style={{
            padding: '0.875rem',
            borderRadius: '0.625rem',
            border: `2px solid ${theme === 'dark' ? 'var(--tab-active)' : 'var(--border)'}`,
            background: theme === 'dark' ? 'var(--surface-2)' : 'var(--surface)',
            cursor: theme === 'dark' ? 'default' : 'pointer',
            transition: 'border-color 150ms, background 150ms',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
          }}>
          {/* Dark mode preview */}
          <div style={{ width: 56, height: 40, borderRadius: 6, background: '#1a1a1a', border: '1px solid #3a3a3a', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: 14, height: '100%', background: '#111213' }} />
            <div style={{ flex: 1, padding: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ height: 4, borderRadius: 2, background: '#3a3a3a', width: '80%' }} />
              <div style={{ height: 4, borderRadius: 2, background: '#3a3a3a', width: '55%' }} />
              <div style={{ height: 4, borderRadius: 2, background: '#3a3a3a', width: '70%' }} />
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: theme === 'dark' ? 600 : 400, color: theme === 'dark' ? 'var(--text-1)' : 'var(--text-2)' }}>
            {isAr ? 'داكن' : 'Dark'}
          </span>
          {theme === 'dark' && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--tab-active)', fontWeight: 500 }}>
              {isAr ? 'نشط' : 'Active'}
            </span>
          )}
        </button>
      </div>
    </SectionCard>
  );
}

/* ── Language section ─────────────────────────────────────────────────────── */
function LanguageSection({ isAr }: { isAr: boolean }) {
  const { lang, setLang } = useLang();

  const options: { value: Lang; labelAr: string; labelEn: string; flag: string }[] = [
    { value: 'ar', labelAr: 'العربية', labelEn: 'Arabic', flag: '🇪🇬' },
    { value: 'en', labelAr: 'الإنجليزية', labelEn: 'English', flag: '🇬🇧' },
  ];

  return (
    <SectionCard title={isAr ? 'لغة النظام' : 'System Language'}>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', marginBottom: '1rem' }}>
        {isAr ? 'اختر لغة الواجهة المفضلة.' : 'Choose your preferred interface language.'}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {options.map(opt => {
          const active = lang === opt.value;
          return (
            <button key={opt.value} type="button" onClick={() => setLang(opt.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                border: `1.5px solid ${active ? 'var(--tab-active)' : 'var(--border)'}`,
                background: active ? 'var(--surface-2)' : 'transparent',
                cursor: active ? 'default' : 'pointer',
                transition: 'border-color 150ms, background 150ms',
                textAlign: 'start',
              }}>
              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{opt.flag}</span>
              <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: active ? 600 : 400, color: 'var(--text-1)' }}>
                {isAr ? opt.labelAr : opt.labelEn}
              </span>
              {active && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--tab-active)', flexShrink: 0 }}>
                  <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

const PRIVILEGED_ROLES = ['FINANCE', 'ADMIN', 'SUPER_ADMIN'];

/* ── 2FA section ──────────────────────────────────────────────────────────── */
function TwoFASection({ me, isAr }: { me: Me | null; isAr: boolean }) {
  const canDisable = !PRIVILEGED_ROLES.includes(me?.role ?? '');
  const [enabled, setEnabled] = useState(me?.twoFactorEnabled ?? false);
  const [secret, setSecret] = useState('');
  const [uri, setUri] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [token, setToken] = useState('');
  const [phase, setPhase] = useState<'idle' | 'setup' | 'disabling'>('idle');
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (me) setEnabled(me.twoFactorEnabled ?? false); }, [me]);

  async function startEnable() {
    setSaving(true); setError('');
    try {
      const res = await apiFetch('/auth/2fa/setup', { method: 'POST' }) as { secret: string; uri: string };
      setSecret(res.secret ?? '');
      setUri(res.uri ?? '');
      const dataUrl = await QRCode.toDataURL(res.uri ?? '', { width: 200, margin: 2 });
      setQrDataUrl(dataUrl);
      setPhase('setup');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally { setSaving(false); }
  }

  async function confirmEnable() {
    setSaving(true); setError('');
    try {
      await apiFetch('/auth/2fa/confirm', { method: 'POST', body: JSON.stringify({ token }) });
      setEnabled(true); setPhase('idle'); setToken(''); setSecret(''); setUri(''); setQrDataUrl('');
    } catch {
      setError(isAr ? 'رمز غير صحيح.' : 'Invalid code.');
    } finally { setSaving(false); }
  }

  async function confirmAndDisable() {
    setSaving(true); setError('');
    try {
      await apiFetch('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ token }) });
      setEnabled(false);
      setPhase('idle');
      setToken('');
      setConfirmDisable(false);
    } catch {
      setConfirmDisable(false);
      setError(isAr ? 'رمز غير صحيح، أعد المحاولة.' : 'Invalid code. Please try again.');
    } finally { setSaving(false); }
  }

  return (
    <SectionCard title={isAr ? 'المصادقة الثنائية (2FA)' : 'Two-Factor Authentication'}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: phase !== 'idle' ? '1rem' : 0 }}>
        <div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-1)', fontWeight: 500, marginBottom: '0.2rem' }}>
            {enabled ? (isAr ? 'المصادقة الثنائية مفعّلة' : '2FA is enabled') : (isAr ? 'المصادقة الثنائية معطّلة' : '2FA is disabled')}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
            {isAr
              ? 'أضف طبقة حماية إضافية عبر تطبيق مصادقة.'
              : 'Protect your account with an authenticator app.'}
          </p>
        </div>
        {/* Status dot */}
        <span style={{
          flexShrink: 0, marginTop: 2,
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          fontSize: '0.6875rem', fontWeight: 600,
          color: enabled ? 'var(--success-fg)' : 'var(--text-3)',
          background: enabled ? 'var(--success-bg)' : 'var(--surface-2)',
          padding: '0.2rem 0.55rem', borderRadius: 9999,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: enabled ? 'var(--success)' : 'var(--border-strong)' }} />
          {enabled ? (isAr ? 'مفعّل' : 'ON') : (isAr ? 'معطّل' : 'OFF')}
        </span>
      </div>

      {/* Setup flow */}
      {phase === 'setup' && secret && (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>
            {isAr
              ? 'امسح رمز QR باستخدام Google Authenticator أو Authy، ثم أدخل الرمز للتأكيد.'
              : 'Scan the QR code with Google Authenticator or Authy, then enter the code to confirm.'}
          </p>
          {/* QR code image */}
          {qrDataUrl && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ background: '#fff', padding: '0.75rem', borderRadius: 10, display: 'inline-block', border: '1px solid var(--border)' }}>
                {/* ponytail: white bg required — QR modules are black, transparent bg breaks dark mode scanners */}
                <img src={qrDataUrl} alt="2FA QR code" width={200} height={200} style={{ display: 'block' }} />
              </div>
            </div>
          )}
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.875rem 1rem' }}>
            <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '0.35rem' }}>
              {isAr ? 'المفتاح السري (إدخال يدوي)' : 'Secret key (manual entry)'}
            </p>
            <code style={{ fontSize: '0.875rem', color: 'var(--text-1)', letterSpacing: '0.1em', fontFamily: 'monospace', wordBreak: 'break-all' }}>{secret}</code>
          </div>
          {uri && (
            <a href={uri} style={{ fontSize: '0.8125rem', color: 'var(--primary)', textDecoration: 'none' }}>
              {isAr ? '← فتح في تطبيق المصادقة' : 'Open in authenticator app →'}
            </a>
          )}
          <Field label={isAr ? 'أدخل الرمز من التطبيق للتأكيد' : 'Enter the 6-digit code from the app'}>
            <input className="input" value={token} onChange={e => setToken(e.target.value)}
              placeholder="000000" maxLength={6} style={{ letterSpacing: '0.2em', textAlign: 'center', fontFamily: 'monospace' }} />
          </Field>
          {error && <p style={{ fontSize: '0.75rem', color: 'var(--danger-fg)' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { setPhase('idle'); setToken(''); setSecret(''); setUri(''); setQrDataUrl(''); }}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={token.length < 6 || saving} onClick={confirmEnable}>
              {saving ? '…' : (isAr ? 'تفعيل' : 'Enable')}
            </button>
          </div>
        </div>
      )}

      {/* Disable flow */}
      {phase === 'disabling' && (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {!confirmDisable ? (
            <>
              <Field label={isAr ? 'أدخل رمز المصادقة لتعطيل الميزة' : 'Enter your authenticator code to disable 2FA'}>
                <input className="input" value={token} onChange={e => { setToken(e.target.value); setError(''); }}
                  placeholder="000000" maxLength={6} style={{ letterSpacing: '0.2em', textAlign: 'center', fontFamily: 'monospace' }} />
              </Field>
              {error && <p style={{ fontSize: '0.75rem', color: 'var(--danger-fg)' }}>{error}</p>}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }}
                  onClick={() => { setPhase('idle'); setToken(''); setError(''); }}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="button" className="btn btn-danger btn-sm" style={{ flex: 1 }}
                  disabled={token.length < 6}
                  onClick={() => setConfirmDisable(true)}>
                  {isAr ? 'تعطيل 2FA' : 'Disable 2FA'}
                </button>
              </div>
            </>
          ) : (
            /* ── inline confirmation panel ── */
            <div style={{
              background: 'var(--danger-bg, rgba(220,38,38,0.08))',
              border: '1px solid var(--danger-fg, #dc2626)',
              borderRadius: 8,
              padding: '1rem',
              display: 'flex', flexDirection: 'column', gap: '0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ color: 'var(--danger-fg, #dc2626)', flexShrink: 0, marginTop: 1 }}>
                  <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 4v4m0 4h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                <div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '0.2rem' }}>
                    {isAr ? 'تأكيد تعطيل المصادقة الثنائية' : 'Confirm disabling 2FA'}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                    {isAr
                      ? 'سيؤدي هذا إلى إزالة طبقة الحماية الإضافية من حسابك. لا يمكن التراجع عن هذا الإجراء.'
                      : 'This removes the extra security layer from your account. You can re-enable it anytime.'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }}
                  disabled={saving}
                  onClick={() => setConfirmDisable(false)}>
                  {isAr ? 'رجوع' : 'Go back'}
                </button>
                <button type="button" className="btn btn-danger btn-sm" style={{ flex: 1 }}
                  disabled={saving}
                  onClick={confirmAndDisable}>
                  {saving ? '…' : (isAr ? 'نعم، تعطيل' : 'Yes, disable')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action button — shown only in idle */}
      {phase === 'idle' && (
        <div style={{ marginTop: '1rem' }}>
          {!enabled ? (
            <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={startEnable}>
              {saving ? '…' : (isAr ? 'تفعيل المصادقة الثنائية' : 'Enable 2FA')}
            </button>
          ) : canDisable ? (
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-fg)' }} onClick={() => setPhase('disabling')}>
              {isAr ? 'تعطيل المصادقة الثنائية' : 'Disable 2FA'}
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                <rect x="5" y="9" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                {isAr
                  ? 'المصادقة الثنائية إلزامية لهذا الدور ولا يمكن تعطيلها.'
                  : '2FA is mandatory for your role and cannot be disabled.'}
              </span>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function ProfilePage() {
  const { isAr, lang } = useLang();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    const tk = localStorage.getItem('accessToken');
    if (!tk) return;
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${tk}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setMe({ name: d.name ?? d.email ?? '—', email: d.email ?? '', role: d.role ?? '', twoFactorEnabled: d.totpEnabled ?? d.twoFactorEnabled ?? false }); })
      .catch(() => {});
  }, []);

  const initials = me?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '..';

  const ROLE_AR: Record<string, string> = {
    SUPER_ADMIN: 'مدير النظام', ADMIN: 'مدير', FINANCE: 'مالية',
    MANAGER: 'مدير فرع', SALES_REP: 'مندوب مبيعات', CUSTOMER: 'عميل',
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1.5rem' }}>

      {/* ── Profile header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="avatar" style={{
          width: 56, height: 56, fontSize: '1.25rem', flexShrink: 0,
          background: 'var(--primary)', color: '#fff',
        }}>
          {initials}
        </div>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.25rem' }}>
            {me?.name ?? '—'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            {me?.email && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>{me.email}</span>
            )}
            {me?.role && (
              <>
                <span style={{ color: 'var(--border-strong)' }}>·</span>
                <span className="badge badge-info" style={{ fontSize: '0.6875rem' }}>
                  {isAr ? (ROLE_AR[me.role] ?? me.role) : me.role.replace(/_/g, ' ')}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        <PasswordSection isAr={isAr} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <AppearanceSection isAr={isAr} />
          <LanguageSection isAr={isAr} />
        </div>
        <TwoFASection me={me} isAr={isAr} />
      </div>
    </div>
  );
}
