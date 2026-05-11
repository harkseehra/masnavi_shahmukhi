import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/admin/login') return NextResponse.next();

  const cookie = req.cookies.get('ws-auth');
  const pass   = process.env.WORKBENCH_PASSWORD;

  if (!pass || cookie?.value !== pass) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
