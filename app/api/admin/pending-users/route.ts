import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';

async function requireSuperadmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Yetkisiz' }, { status: 401 }) };

  const db = await getDb();
  const user = await db.prepare('SELECT id, is_superadmin FROM users WHERE id = ?').get(session.userId) as
    | { id: number; is_superadmin: number }
    | undefined;

  if (!user || user.is_superadmin !== 1) {
    return { error: NextResponse.json({ error: 'Bu işlem için superadmin yetkisi gerekiyor' }, { status: 403 }) };
  }

  return { db, session };
}

export async function GET() {
  const access = await requireSuperadmin();
  if (access.error) return access.error;

  const pendingUsers = await access.db.prepare(`
    SELECT id, username, created_at
    FROM users
    WHERE approved = 0 AND is_superadmin = 0
    ORDER BY created_at ASC
  `).all();

  return NextResponse.json({ users: pendingUsers });
}

export async function PATCH(req: NextRequest) {
  const access = await requireSuperadmin();
  if (access.error) return access.error;

  const body = await req.json();
  const targetUserId = Number(body.userId || 0);
  const action = String(body.action || 'approve');

  if (!targetUserId) {
    return NextResponse.json({ error: 'Geçersiz kullanıcı' }, { status: 400 });
  }

  const user = await access.db.prepare('SELECT id, username, approved, member_id FROM users WHERE id = ?').get(targetUserId) as
    | { id: number; username: string; approved: number; member_id: number | null }
    | undefined;

  if (!user) {
    return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
  }

  if (action === 'reject') {
    await access.db.prepare('DELETE FROM users WHERE id = ? AND is_superadmin = 0').run(targetUserId);
    await logAudit(access.db, 'user_rejected', 'user', targetUserId, access.session.userId, `Kayıt reddedildi: ${user.username}`);
    return NextResponse.json({ success: true, action: 'rejected' });
  }

  if (user.approved === 1) {
    return NextResponse.json({ success: true, action: 'already_approved' });
  }

  let memberId = user.member_id;
  if (!memberId) {
    const member = await access.db.prepare("INSERT INTO members (name, status) VALUES (?, 'available')").run(user.username);
    memberId = Number(member.lastInsertRowid);
  }

  await access.db.prepare(
    'UPDATE users SET approved = 1, member_id = ?, approved_by = ?, approved_at = NOW() WHERE id = ?'
  ).run(memberId, access.session.userId, targetUserId);

  await logAudit(access.db, 'user_approved', 'user', targetUserId, access.session.userId, `Kullanıcı onaylandı: ${user.username}`);

  return NextResponse.json({ success: true, action: 'approved', memberId });
}
