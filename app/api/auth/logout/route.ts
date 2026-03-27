import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/session';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return res;
}
