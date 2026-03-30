import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { COOKIE_NAME, getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });

  const db = await getDb();
  const user = await db.prepare('SELECT id, username, member_id FROM users WHERE id = ?').get(session.userId);
  if (!user) {
    const res = NextResponse.json({ user: null });
    // Invalidate cookie if JWT is still valid but account is deleted.
    res.cookies.set(COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
    return res;
  }

  // If member profile was deleted, block access even if JWT still exists.
  const memberId = session.memberId;
  if (!memberId) return NextResponse.json({ user: null });
  const member = await db.prepare('SELECT id FROM members WHERE id = ?').get(memberId);
  if (!member) {
    const res = NextResponse.json({ user: null });
    res.cookies.set(COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
    return res;
  }

  // Keep the original session payload, but only after DB existence checks.
  return NextResponse.json({ user: session });
}
