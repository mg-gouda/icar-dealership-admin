'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Login failed');
      localStorage.setItem('accessToken', data.accessToken);
      router.replace('/');
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      {/* Abstract dark blobs */}
      <div className="absolute inset-0" style={{ filter: 'blur(80px)', opacity: 0.4 }} aria-hidden>
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-700 rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-800 rounded-full" />
        <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-indigo-900 rounded-full" />
      </div>
      {/* 10% backdrop blur over the whole background */}
      <div className="absolute inset-0" style={{ backdropFilter: 'blur(10px)' }} aria-hidden />

      {/* Compact glass card */}
      <div className="relative z-10 w-full max-w-xs px-4">
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl px-6 py-6">
          <div className="mb-5 text-center">
            <p className="text-base font-semibold text-white tracking-tight">iCar Dealership</p>
            <p className="text-xs text-white/40 mt-0.5">Admin Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required autoComplete="email" placeholder="Email"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-white/30 transition"
            />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required autoComplete="current-password" placeholder="Password"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-white/30 transition"
            />
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-medium py-2 transition disabled:opacity-50">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
