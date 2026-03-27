import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get('memberId');

  let notifications;
  if (memberId) {
    notifications = db.prepare(`
      SELECT n.*, m.name as from_name, t.title as task_title
      FROM notifications n
      LEFT JOIN members m ON n.from_member_id = m.id
      LEFT JOIN tasks t ON n.task_id = t.id
      WHERE n.to_member_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `).all(Number(memberId));
  } else {
    notifications = db.prepare(`
      SELECT n.*, m.name as from_name, t.title as task_title
      FROM notifications n
      LEFT JOIN members m ON n.from_member_id = m.id
      LEFT JOIN tasks t ON n.task_id = t.id
      ORDER BY n.created_at DESC
      LIMIT 50
    `).all();
  }

  return NextResponse.json(notifications);
}

export async function PATCH(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  if (body.markAllRead && body.memberId) {
    db.prepare('UPDATE notifications SET read = 1 WHERE to_member_id = ?').run(body.memberId);
  } else if (body.id) {
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(body.id);
  }
  return NextResponse.json({ success: true });
}
