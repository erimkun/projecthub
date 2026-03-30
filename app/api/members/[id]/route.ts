import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { COOKIE_NAME, getSession } from '@/lib/session';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb();
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Eksik üye ID' }, { status: 400 });

  const session = await getSession();
  const targetId = Number(id);
  const isSelf = Boolean(session && session.memberId && session.memberId === targetId);

  const removeMember = db.transaction(async (txDb) => {
    await txDb.prepare('DELETE FROM members WHERE id = ?').run(targetId);
    await txDb.prepare('DELETE FROM users WHERE member_id = ?').run(targetId);
  });

  await removeMember();

  const res = NextResponse.json({ success: true, loggedOut: isSelf });
  if (isSelf) {
    res.cookies.set(COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
  }
  return res;
}
