'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useRouter } from 'next/navigation';
import { cacheFieldPermissions } from '../../lib/fieldPermissions';
import { useLang } from '@/lib/lang-context';
import { API_BASE as API } from '@/lib/config';

type Stage = 'credentials' | 'totp-verify' | 'totp-setup' | 'totp-confirm';

// ponytail: set both session + role cookies together at each auth completion point
function setSessionCookies(accessToken: string, role: string) {
  const maxAge = 8 * 3600;
  document.cookie = `admin_session=${accessToken}; path=/; max-age=${maxAge}`;
  document.cookie = `admin_role=${role}; path=/; max-age=${maxAge}`;
}

async function fetchAndCacheFieldPerms(token: string) {
  try {
    const r = await fetch(`${API}/auth/me/field-permissions`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) cacheFieldPermissions(await r.json());
  } catch { /* non-critical */ }
}


export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [stage, setStage] = useState<Stage>('credentials');
  const [preToken, setPreToken] = useState('');
  const [setupUri, setSetupUri] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showManualKey, setShowManualKey] = useState(false);
  const [brandName, setBrandName] = useState('iCar Dealership');
  const [brandLogo, setBrandLogo] = useState('');
  const { isAr } = useLang();

  useEffect(() => {
    try {
      const raw = localStorage.getItem('dealerms_brand');
      if (raw) {
        const b = JSON.parse(raw);
        const name = b.displayName || 'iCar Dealership';
        setBrandName(name);
        if (b.logoUrl) setBrandLogo(b.logoUrl);
        document.title = name === 'iCar Dealership' ? name : `${name} | iCar Dealership`;
        // apply saved favicon
        if (b.faviconUrl) {
          let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
          if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
          link.href = b.faviconUrl;
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!setupUri) return;
    QRCode.toDataURL(setupUri, { width: 200, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [setupUri]);

  async function post(path: string, body: object, token?: string) {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? 'Request failed');
    return data;
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await post('/auth/login', { email, password });
      if (data.requiresTotpSetup) {
        setPreToken(data.preAuthToken);
        // Immediately call setup to get secret+URI
        const setup = await post('/auth/2fa/setup', {}, data.preAuthToken);
        setSetupSecret(setup.secret);
        setSetupUri(setup.uri);
        setStage('totp-setup');
      } else if (data.requiresTotp) {
        setPreToken(data.preAuthToken);
        setStage('totp-verify');
      } else {
        localStorage.setItem('accessToken', data.accessToken);
        setSessionCookies(data.accessToken, data.user.role);
        await fetchAndCacheFieldPerms(data.accessToken);
        router.replace('/');
      }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Login failed'); }
    finally { setLoading(false); }
  }

  async function handleTotpVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await post('/auth/2fa/verify', { token: totpCode }, preToken);
      localStorage.setItem('accessToken', data.accessToken);
      setSessionCookies(data.accessToken, data.user.role);
      await fetchAndCacheFieldPerms(data.accessToken);
      router.replace('/');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Invalid code'); }
    finally { setLoading(false); }
  }

  async function handleTotpConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await post('/auth/2fa/confirm', { token: totpCode }, preToken);
      localStorage.setItem('accessToken', data.accessToken);
      setSessionCookies(data.accessToken, data.user.role);
      await fetchAndCacheFieldPerms(data.accessToken);
      router.replace('/');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Invalid code'); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'oklch(0.12 0.04 255)' }}>
      {/* Abstract blurred blobs — 10% blur as per design spec */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden style={{ filter: 'blur(90px)', opacity: 0.35 }}>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
          style={{ background: 'oklch(0.42 0.22 265)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full"
          style={{ background: 'oklch(0.38 0.18 295)' }} />
        <div className="absolute top-1/2 left-2/3 w-64 h-64 rounded-full"
          style={{ background: 'oklch(0.3 0.14 240)' }} />
      </div>
      <div className="absolute inset-0 pointer-events-none" style={{ backdropFilter: 'blur(10px)' }} aria-hidden />

      <div className="relative z-10 w-full max-w-[320px] px-4">
        {/* Brand mark above card */}
        <div className="text-center mb-5">
          {brandLogo
            ? <img src={brandLogo} alt={brandName} className="mx-auto mb-1.5" style={{ height: 44, maxWidth: 160, objectFit: 'contain', borderRadius: 6 }} />
            : <span className="text-3xl" aria-hidden>🚗</span>
          }
          <p className="text-sm font-semibold text-white mt-1.5 tracking-tight">{brandName}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'oklch(1 0 0 / 0.4)' }}>
            {isAr ? 'بوابة الإدارة' : 'Staff Management Portal'}
          </p>
        </div>

        <div className="rounded-xl shadow-2xl px-5 py-5"
          style={{ background: 'oklch(1 0 0 / 0.06)', border: '1px solid oklch(1 0 0 / 0.1)', backdropFilter: 'blur(20px)' }}>

          {/* Stage: credentials */}
          {stage === 'credentials' && (
            <>
              <div className="mb-4 text-center">
                <p className="text-[0.9375rem] font-semibold text-white">
                  {isAr ? 'مرحباً بعودتك' : 'Welcome Back'}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'oklch(1 0 0 / 0.45)' }}>
                  {isAr ? 'تسجيل الدخول إلى حسابك للمتابعة' : 'Sign in to your account to continue'}
                </p>
              </div>
              <form onSubmit={handleCredentials} className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: 'oklch(1 0 0 / 0.55)' }}>
                    {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    required autoComplete="email" placeholder="your-name@dealership.com"
                    className="w-full rounded-lg px-3 py-2 text-xs text-white focus:outline-none transition"
                    style={{ background: 'oklch(1 0 0 / 0.07)', border: '1px solid oklch(1 0 0 / 0.12)', color: 'white' }}
                    onFocus={e => (e.target.style.borderColor = 'oklch(1 0 0 / 0.3)')}
                    onBlur={e => (e.target.style.borderColor = 'oklch(1 0 0 / 0.12)')}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: 'oklch(1 0 0 / 0.55)' }}>
                    {isAr ? 'كلمة المرور' : 'Password'}
                  </label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    required autoComplete="current-password" placeholder="••••••••"
                    className="w-full rounded-lg px-3 py-2 text-xs text-white focus:outline-none transition"
                    style={{ background: 'oklch(1 0 0 / 0.07)', border: '1px solid oklch(1 0 0 / 0.12)' }}
                    onFocus={e => (e.target.style.borderColor = 'oklch(1 0 0 / 0.3)')}
                    onBlur={e => (e.target.style.borderColor = 'oklch(1 0 0 / 0.12)')}
                  />
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" className="w-3 h-3 rounded" style={{ accentColor: 'oklch(0.65 0.2 265)' }} />
                    <span className="text-[11px]" style={{ color: 'oklch(1 0 0 / 0.45)' }}>
                      {isAr ? 'تذكرني' : 'Remember me'}
                    </span>
                  </label>
                  <button type="button" className="text-[11px] transition"
                    style={{ color: 'oklch(0.72 0.18 265)' }}
                    onClick={async () => {
                      if (!email) { setError('Enter your email first.'); return; }
                      setLoading(true); setError('');
                      try {
                        await post('/auth/forgot-password', { email });
                        setError('If that email exists, a reset link was sent.');
                      } catch { setError('Could not send reset link. Try again.'); }
                      finally { setLoading(false); }
                    }}>
                    {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                  </button>
                </div>
                {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full rounded-lg text-white text-xs font-semibold py-2.5 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  style={{ background: 'oklch(0.52 0.22 265)' }}
                  onMouseOver={e => !loading && (e.currentTarget.style.background = 'oklch(0.46 0.21 265)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'oklch(0.52 0.22 265)')}>
                  {loading
                    ? (isAr ? 'جاري تسجيل الدخول…' : 'Signing in…')
                    : <>{isAr ? 'تسجيل الدخول' : 'Sign In'} <span aria-hidden>→</span></>}
                </button>
              </form>
            </>
          )}

          {/* Stage: TOTP verify (already enrolled) */}
          {stage === 'totp-verify' && (
            <>
              <div className="mb-4 text-center">
                <span className="text-2xl block mb-2" aria-hidden>🔐</span>
                <p className="text-[0.9375rem] font-semibold text-white">
                  {isAr ? 'المصادقة الثنائية' : 'Two-Factor Authentication'}
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'oklch(1 0 0 / 0.45)' }}>
                  {isAr
                    ? 'أدخل رمز التحقق المكون من 6 أرقام من تطبيق المصادقة لإتمام تسجيل الدخول'
                    : 'Enter the 6-digit code from your authenticator app to complete login'}
                </p>
              </div>
              <form onSubmit={handleTotpVerify} className="space-y-3">
                {/* 6-box OTP display — input overlays boxes so clicking anywhere focuses it */}
                <div className="relative flex gap-1.5 justify-center">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-9 h-10 rounded-lg flex items-center justify-center text-base font-bold text-white"
                      style={{ background: 'oklch(1 0 0 / 0.1)', border: `1px solid ${totpCode[i] ? 'oklch(0.65 0.2 265)' : 'oklch(1 0 0 / 0.15)'}` }}>
                      {totpCode[i] ?? ''}
                    </div>
                  ))}
                  <input type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                    value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    required autoFocus aria-label="6-digit code"
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'text', width: '100%', height: '100%' }} />
                </div>
                {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}
                <button type="submit" disabled={loading || totpCode.length < 6}
                  className="w-full rounded-lg text-white text-xs font-semibold py-2.5 transition disabled:opacity-50"
                  style={{ background: 'oklch(0.52 0.22 265)' }}>
                  {loading
                    ? (isAr ? 'جاري التحقق…' : 'Verifying…')
                    : (isAr ? 'تحقق من الرمز' : 'Verify Code')}
                </button>
                <p className="text-center text-[11px]" style={{ color: 'oklch(1 0 0 / 0.35)' }}>
                  {isAr ? 'فقدت الوصول إلى تطبيق المصادقة؟' : 'Lost access to your authenticator?'}{' '}
                  <span style={{ color: 'oklch(0.72 0.18 265)' }}>
                    {isAr ? 'تواصل مع المسؤول.' : 'Contact your admin.'}
                  </span>
                </p>
                <p className="text-center text-[10px] rounded-md px-2 py-1.5"
                  style={{ background: 'oklch(0.68 0.16 72 / 0.12)', color: 'oklch(0.85 0.1 72)' }}>
                  {isAr ? '⚠️ مطلوب لأدوار المالية والإدارة والمديرين' : '⚠️ Required for Finance, Admin & Manager roles'}
                </p>
                <button type="button" onClick={() => { setStage('credentials'); setError(''); setTotpCode(''); }}
                  className="w-full text-[11px] transition" style={{ color: 'oklch(1 0 0 / 0.3)' }}>
                  {isAr ? '→ العودة لتسجيل الدخول' : '← Back to login'}
                </button>
              </form>
            </>
          )}

          {/* Stage: TOTP setup (first enrollment) */}
          {stage === 'totp-setup' && (
            <>
              <div className="mb-4 text-center">
                <p className="text-[0.9375rem] font-semibold text-white">
                  {isAr ? 'إعداد المصادقة الثنائية' : 'Set Up Two-Factor Auth'}
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'oklch(1 0 0 / 0.4)' }}>
                  {isAr
                    ? 'افتح Google Authenticator أو Authy وامسح الرمز.'
                    : 'Open Google Authenticator or Authy and scan the code.'}
                </p>
              </div>

              {/* QR code */}
              <div className="flex justify-center mb-3">
                {qrDataUrl ? (
                  <div className="rounded-xl overflow-hidden p-2" style={{ background: '#fff', display: 'inline-block' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="2FA QR code" width={180} height={180} />
                  </div>
                ) : (
                  <div className="rounded-xl flex items-center justify-center"
                    style={{ width: 196, height: 196, background: 'oklch(1 0 0 / 0.07)', border: '1px solid oklch(1 0 0 / 0.12)' }}>
                    <span className="text-[11px]" style={{ color: 'oklch(1 0 0 / 0.3)' }}>Generating…</span>
                  </div>
                )}
              </div>

              {/* Manual key toggle */}
              <div className="mb-3 text-center">
                <button type="button"
                  onClick={() => setShowManualKey(v => !v)}
                  className="text-[11px] transition"
                  style={{ color: 'oklch(1 0 0 / 0.35)' }}>
                  {showManualKey
                    ? (isAr ? '▲ إخفاء المفتاح اليدوي' : '▲ Hide manual key')
                    : (isAr ? '▼ لا يمكنك المسح؟ أدخل يدوياً' : "▼ Can't scan? Enter key manually")}
                </button>
                {showManualKey && (
                  <div className="mt-2 rounded-lg p-3"
                    style={{ background: 'oklch(1 0 0 / 0.07)', border: '1px solid oklch(1 0 0 / 0.12)' }}>
                    <p className="text-[10px] mb-1" style={{ color: 'oklch(1 0 0 / 0.4)' }}>
                      {isAr ? 'المفتاح السري' : 'Secret key'}
                    </p>
                    <p className="text-sm font-mono text-white tracking-wider break-all select-all">{setupSecret}</p>
                  </div>
                )}
              </div>

              <button onClick={() => { setTotpCode(''); setStage('totp-confirm'); }}
                className="w-full rounded-lg text-white text-xs font-semibold py-2.5 transition"
                style={{ background: 'oklch(0.52 0.22 265)' }}>
                {isAr ? 'لقد مسحت الرمز ←' : "I've scanned the code →"}
              </button>
              <button type="button" onClick={() => { setStage('credentials'); setError(''); setTotpCode(''); }}
                className="w-full text-[11px] transition mt-2" style={{ color: 'oklch(1 0 0 / 0.3)' }}>
                {isAr ? '→ إلغاء' : '← Cancel'}
              </button>
            </>
          )}

          {/* Stage: confirm first code to finalize enrollment */}
          {stage === 'totp-confirm' && (
            <>
              <div className="mb-4 text-center">
                <p className="text-[0.9375rem] font-semibold text-white">
                  {isAr ? 'تأكيد الإعداد' : 'Confirm Setup'}
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'oklch(1 0 0 / 0.4)' }}>
                  {isAr
                    ? 'أدخل رمز التحقق المكون من 6 أرقام من تطبيقك لتفعيل المصادقة الثنائية'
                    : 'Enter the 6-digit code from your app to activate 2FA'}
                </p>
              </div>
              <form onSubmit={handleTotpConfirm} className="space-y-3">
                <div className="relative flex gap-1.5 justify-center">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-9 h-10 rounded-lg flex items-center justify-center text-base font-bold text-white"
                      style={{ background: 'oklch(1 0 0 / 0.1)', border: `1px solid ${totpCode[i] ? 'oklch(0.65 0.2 265)' : 'oklch(1 0 0 / 0.15)'}` }}>
                      {totpCode[i] ?? ''}
                    </div>
                  ))}
                  <input type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                    value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    required autoFocus aria-label="6-digit code"
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'text', width: '100%', height: '100%' }} />
                </div>
                {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}
                <button type="submit" disabled={loading || totpCode.length < 6}
                  className="w-full rounded-lg text-white text-xs font-semibold py-2.5 transition disabled:opacity-50"
                  style={{ background: 'oklch(0.52 0.22 265)' }}>
                  {loading
                    ? (isAr ? 'جاري التفعيل…' : 'Activating…')
                    : (isAr ? 'تفعيل المصادقة الثنائية وتسجيل الدخول' : 'Activate 2FA & Sign In')}
                </button>
                <button type="button" onClick={() => { setStage('totp-setup'); setError(''); }}
                  className="w-full text-[11px] transition" style={{ color: 'oklch(1 0 0 / 0.3)' }}>
                  {isAr ? '→ رجوع' : '← Back'}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Security notice below card */}
        <p className="text-center text-[10px] mt-4" style={{ color: 'oklch(1 0 0 / 0.3)' }}>
          {isAr
            ? <> 🔒 هذه البوابة مخصصة للموظفين المصرح لهم فقط.<br />الوصول غير المصرح به محظور تماماً.</>
            : <>🔒 This portal is for authorized staff only.<br />Unauthorized access is strictly prohibited.</>}
        </p>

        {/* Developer credit */}
        <p className="text-center text-[10px] mt-3" style={{ color: 'oklch(1 0 0 / 0.2)' }}>
          {isAr ? 'تطوير ' : 'Developed by '}
          <a href="https://wa.me/+201002805139" target="_blank" rel="noopener noreferrer"
            style={{ color: 'oklch(1 0 0 / 0.35)', textDecoration: 'none', borderBottom: '1px solid oklch(1 0 0 / 0.2)' }}
            onMouseOver={e => (e.currentTarget.style.color = 'oklch(1 0 0 / 0.6)')}
            onMouseOut={e => (e.currentTarget.style.color = 'oklch(1 0 0 / 0.35)')}>
            Mohamed Gouda
          </a>
          {' | v0.1.0'}
        </p>
      </div>
    </main>
  );
}
