import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { COOKIE_NAME, getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });

  const db = await getDb();
  const user = await db.prepare('SELECT id, username, member_id, approved, is_superadmin FROM users WHERE id = ?').get(session.userId) as
    | { id: number; username: string; member_id: number | null; approved: number; is_superadmin: number }
    | undefined;
  if (!user) {
    const res = NextResponse.json({ user: null });
    // Invalidate cookie if JWT is still valid but account is deleted.
    res.cookies.set(COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
    return res;
  }

  if (!user.is_superadmin) {
    // If member profile was deleted, block access even if JWT still exists.
    const memberId = session.memberId;
    if (!memberId) return NextResponse.json({ user: null });
    const member = await db.prepare('SELECT id FROM members WHERE id = ?').get(memberId);
    if (!member) {
      const res = NextResponse.json({ user: null });
      res.cookies.set(COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
      return res;
    }
  }

  return NextResponse.json({
    user: {
      ...session,
      memberId: user.member_id,
      isSuperadmin: user.is_superadmin === 1,
      approved: user.approved === 1,
    },
  });
}
