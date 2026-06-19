'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cacheFieldPermissions } from '../../lib/fieldPermissions';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1';

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
    <main className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      {/* Abstract dark blobs */}
      <div className="absolute inset-0" style={{ filter: 'blur(80px)', opacity: 0.4 }} aria-hidden>
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-700 rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-800 rounded-full" />
        <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-indigo-900 rounded-full" />
      </div>
      <div className="absolute inset-0" style={{ backdropFilter: 'blur(10px)' }} aria-hidden />

      <div className="relative z-10 w-full max-w-xs px-4">
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl px-6 py-6">

          {/* Stage: credentials */}
          {stage === 'credentials' && (
            <>
              <div className="mb-5 text-center">
                <p className="text-base font-semibold text-white tracking-tight">iCar Dealership</p>
                <p className="text-xs text-white/40 mt-0.5">Admin Portal</p>
              </div>
              <form onSubmit={handleCredentials} className="space-y-3">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required autoComplete="email" placeholder="Email"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-white/30 transition" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  required autoComplete="current-password" placeholder="Password"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-white/30 transition" />
                {error && <p className="text-xs text-red-400 text-center">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-medium py-2 transition disabled:opacity-50">
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
            </>
          )}

          {/* Stage: TOTP verify (already enrolled) */}
          {stage === 'totp-verify' && (
            <>
              <div className="mb-5 text-center">
                <p className="text-base font-semibold text-white">Two-Factor Auth</p>
                <p className="text-xs text-white/40 mt-0.5">Enter the 6-digit code from your authenticator app</p>
              </div>
              <form onSubmit={handleTotpVerify} className="space-y-3">
                <input type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                  value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  required placeholder="000000" autoFocus
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white text-center tracking-[0.5em] placeholder-white/25 focus:outline-none focus:border-white/30 transition" />
                {error && <p className="text-xs text-red-400 text-center">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-medium py-2 transition disabled:opacity-50">
                  {loading ? 'Verifying…' : 'Verify'}
                </button>
                <button type="button" onClick={() => { setStage('credentials'); setError(''); setTotpCode(''); }}
                  className="w-full text-xs text-white/30 hover:text-white/60 transition">← Back to login</button>
              </form>
            </>
          )}

          {/* Stage: TOTP setup (first enrollment) */}
          {stage === 'totp-setup' && (
            <>
              <div className="mb-4 text-center">
                <p className="text-sm font-semibold text-white">Set Up Authenticator</p>
                <p className="text-xs text-white/40 mt-1">Your role requires 2FA. Scan the QR code with Google Authenticator, Authy, or any TOTP app.</p>
              </div>
              {/* QR-less: show URI as copyable secret + link */}
              <div className="mb-3 rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                <p className="text-xs text-white/40 mb-1">Secret key (manual entry)</p>
                <p className="text-sm font-mono text-white tracking-wider break-all select-all">{setupSecret}</p>
              </div>
              {setupUri && (
                <a href={setupUri} className="block text-center text-xs text-blue-400 hover:text-blue-300 mb-3 truncate transition" title={setupUri}>
                  Open in authenticator app →
                </a>
              )}
              <button onClick={() => { setTotpCode(''); setStage('totp-confirm'); }}
                className="w-full rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-medium py-2 transition">
                I've added the key →
              </button>
            </>
          )}

          {/* Stage: confirm first code to finalize enrollment */}
          {stage === 'totp-confirm' && (
            <>
              <div className="mb-5 text-center">
                <p className="text-sm font-semibold text-white">Confirm Setup</p>
                <p className="text-xs text-white/40 mt-1">Enter the 6-digit code from your app to activate 2FA</p>
              </div>
              <form onSubmit={handleTotpConfirm} className="space-y-3">
                <input type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                  value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  required placeholder="000000" autoFocus
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white text-center tracking-[0.5em] placeholder-white/25 focus:outline-none focus:border-white/30 transition" />
                {error && <p className="text-xs text-red-400 text-center">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-medium py-2 transition disabled:opacity-50">
                  {loading ? 'Activating…' : 'Activate 2FA & Sign In'}
                </button>
                <button type="button" onClick={() => { setStage('totp-setup'); setError(''); }}
                  className="w-full text-xs text-white/30 hover:text-white/60 transition">← Back</button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
