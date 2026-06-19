'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/vehicles', label: 'Vehicles' },
  { href: '/deals', label: 'Deals' },
  { href: '/crm', label: 'CRM' },
  { href: '/appointments', label: 'Appointments' },
  { href: '/purchase-orders', label: 'Purchase Orders' },
  { href: '/partners', label: 'Partners' },
  { href: '/finance', label: 'Finance' },
  { href: '/reports', label: 'Reports' },
  { href: '/audit-log', label: 'Audit Log' },
  { href: '/settings', label: 'Settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) {
      router.replace('/login');
    }
  }, [router]);

  function logout() {
    // ponytail: fire-and-forget API call to audit logout server-side
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1'}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {}); // best-effort
    }
    localStorage.removeItem('accessToken');
    document.cookie = 'admin_session=; path=/; max-age=0';
    router.replace('/login');
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-white/5 bg-gray-900 flex flex-col">
        <div className="px-5 py-4 border-b border-white/5">
          <span className="text-sm font-semibold text-white">iCar Admin</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm transition ${
                pathname === item.href
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5">
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-white rounded-lg hover:bg-white/5 transition"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
