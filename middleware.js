import { NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('token')?.value;

  const isStaffRoute = pathname.startsWith('/staff');
  const isOwnerRoute = pathname.startsWith('/owner');

  if (!isStaffRoute && !isOwnerRoute) return NextResponse.next();

  if (!token) return NextResponse.redirect(new URL('/', req.url));

  const session = await verifyToken(token);
  if (!session) return NextResponse.redirect(new URL('/', req.url));

  if (isOwnerRoute && session.role !== 'owner') {
    return NextResponse.redirect(new URL('/staff', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/staff/:path*', '/owner/:path*'],
};
