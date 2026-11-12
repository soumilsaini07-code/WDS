import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'econ-club-thapar-dalal-street-super-secret-key-2026'
);

const COOKIE_NAME = 'econ_token';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Retrieve token from cookie or Authorization header
  let token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  let session: { userId: string; email: string; role: string } | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      session = {
        userId: payload.userId as string,
        email: payload.email as string,
        role: (payload.role as string) || 'participant',
      };
    } catch (err) {
      session = null;
    }
  }

  // 1. Strict Protection for Admin Routes (/admin and /api/admin/*)
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Unauthorized: Platform Administrator privileges required.' },
          { status: 403 }
        );
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'admin_required');
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Dashboard (/dashboard) is now completely PUBLIC for all participants and floor displays
  // No sign-in or login required for participants to view live prices, charts, and news!

  // 3. Sensitive Participant & Trading Endpoints Protection
  if (
    pathname.startsWith('/api/slips') ||
    pathname.startsWith('/api/user') ||
    pathname.startsWith('/api/trade') ||
    pathname.startsWith('/api/tick')
  ) {
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Session authentication token required.' },
        { status: 401 }
      );
    }
  }

  // 4. Login page redirection if already authenticated
  if (pathname === '/login') {
    if (session) {
      const dest = session.role === 'admin' || session.role === 'superadmin' ? '/admin' : '/dashboard';
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/slips/:path*',
    '/api/user/:path*',
    '/api/trade/:path*',
    '/api/tick/:path*',
    '/login',
  ],
};
