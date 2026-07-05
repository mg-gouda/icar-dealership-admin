'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotAuthorizedPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="card p-8 text-center" style={{ maxWidth: '28rem', width: '100%' }}>
        <div style={{
          width: '4rem', height: '4rem', borderRadius: '50%',
          background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.25rem',
        }}>
          <svg className="w-8 h-8" style={{ color: 'var(--danger-fg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h1 className="page-title mb-2">Access Denied</h1>
        <p className="page-subtitle mb-6">
          You don&apos;t have permission to view this page. Contact your administrator if you believe this is an error.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => router.back()} className="btn btn-secondary">
            Go Back
          </button>
          <Link href="/" className="btn btn-primary">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
