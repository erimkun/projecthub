import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

  const db = await getDb();
  const me = await db.prepare('SELECT is_superadmin FROM users WHERE id = ?').get(session.userId) as
    | { is_superadmin: number }
    | undefined;

  if (!me || me.is_superadmin !== 1) {
    return NextResponse.json({ error: 'Bu işlem için superadmin yetkisi gerekiyor' }, { status: 403 });
  }

  const logs = await db.prepare(`
    SELECT
      a.id,
      a.action,
      a.entity_type,
      a.entity_id,
      a.detail,
      a.created_at,
      u.username as actor_username
    FROM audit_logs a
    LEFT JOIN users u ON a.actor_user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT 150
  `).all();

  return NextResponse.json({ logs });
}
