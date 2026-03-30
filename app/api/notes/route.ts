import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

type NoteRow = {
  id: number;
  linked_tasks: number[];
  [key: string]: unknown;
};

export async function GET() {
  const db = await getDb();
  const notes = await db.prepare(`
    SELECT n.*, p.name as project_name
    FROM notes n
    LEFT JOIN projects p ON n.project_id = p.id
    ORDER BY n.updated_at DESC
  `).all() as Array<{ id: number; [key: string]: unknown }>;

  // Attach linked task IDs
  const stmtLinks = db.prepare('SELECT task_id FROM note_tasks WHERE note_id = ?');
  const result: NoteRow[] = notes.map((note) => ({
    ...note,
    linked_tasks: [] as number[],
  }));

  for (const note of result) {
    note.linked_tasks = (await stmtLinks.all(note.id) as { task_id: number }[]).map((r) => r.task_id);
  }

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const db = await getDb();
  const body = await req.json();
  const result = await db.prepare(
    'INSERT INTO notes (title, content, project_id) VALUES (?, ?, ?)'
  ).run(body.title || 'Yeni Not', body.content || '', body.project_id || null);

  const note = await db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(note, { status: 201 });
}
