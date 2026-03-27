import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  const db = getDb();
  const members = db.prepare('SELECT * FROM members ORDER BY name ASC').all();
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const result = db.prepare(
    'INSERT INTO members (name, avatar, status) VALUES (?, ?, ?)'
  ).run(body.name, body.avatar || null, body.status || 'available');

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(member, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { id, status, name } = body;

  const updates = [];
  const params = [];
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }
  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE members SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  return NextResponse.json(member);
}
