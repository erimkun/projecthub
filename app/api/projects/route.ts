import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  const db = getDb();
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const result = db.prepare(
    'INSERT INTO projects (name, color) VALUES (?, ?)'
  ).run(body.name, body.color || '#f59e0b');

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(project, { status: 201 });
}
