import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/auth', '/not-authorized'];

// ponytail: role gating via lightweight admin_role cookie (set at login alongside admin_session)
const FINANCE_PATHS = ['/finance'];
const ADMIN_PATHS = ['/settings', '/users', '/audit-log'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (isPublic) return NextResponse.next();

  const sessionFlag = request.cookies.get('admin_session')?.value;

  if (!sessionFlag) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = request.cookies.get('admin_role')?.value ?? '';

  const requiresFinance = FINANCE_PATHS.some((p) => pathname.startsWith(p));
  const requiresAdmin = ADMIN_PATHS.some((p) => pathname.startsWith(p));

  // MANAGER has read-only finance/settings visibility; API enforces write restrictions
  if (requiresFinance && !['MANAGER', 'FINANCE', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
    return NextResponse.redirect(new URL('/not-authorized', request.url));
  }
  if (requiresAdmin && !['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
    return NextResponse.redirect(new URL('/not-authorized', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|auth).*)'],
};
