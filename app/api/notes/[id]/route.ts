import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getWeekNumber } from '@/lib/parser';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body = await req.json();

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
  if (body.content !== undefined) { fields.push('content = ?'); values.push(body.content); }
  if (body.project_id !== undefined) { fields.push('project_id = ?'); values.push(body.project_id); }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    values.push(Number(id));
    db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  // Link a task to this note
  if (body.link_task_id) {
    db.prepare('INSERT OR IGNORE INTO note_tasks (note_id, task_id) VALUES (?, ?)')
      .run(Number(id), body.link_task_id);
  }

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(Number(id));
  return NextResponse.json(note);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  db.prepare('DELETE FROM notes WHERE id = ?').run(Number(id));
  return NextResponse.json({ success: true });
}

// Convert a note line to a task (or multiple tasks if multiple assignees)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body = await req.json();
  const { week, year } = getWeekNumber();

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(Number(id)) as { project_id?: number } | undefined;
  if (!note) return NextResponse.json({ error: 'Not bulunamadı' }, { status: 404 });

  const projectId = body.project_id || note.project_id || null;
  const assignees = Array.isArray(body.assigned_tos) && body.assigned_tos.length > 0 
    ? body.assigned_tos 
    : [null]; // At least 1 task even if no one is assigned

  const createdTasks = [];
  
  for (const assignedTo of assignees) {
    const taskResult = db.prepare(
      'INSERT INTO tasks (title, body, status, project_id, assigned_to, week_number, year) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(body.title, body.body || '', 'pending', projectId, assignedTo, week, year);
  
    db.prepare('INSERT OR IGNORE INTO note_tasks (note_id, task_id) VALUES (?, ?)')
      .run(Number(id), taskResult.lastInsertRowid);
  
    const task = db.prepare(`
      SELECT t.*, p.name as project_name, p.color as project_color,
        m1.name as assigned_name, m2.name as helper_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN members m1 ON t.assigned_to = m1.id
      LEFT JOIN members m2 ON t.helper_id = m2.id
      WHERE t.id = ?
    `).get(taskResult.lastInsertRowid);
    createdTasks.push(task);
  }

  return NextResponse.json(createdTasks, { status: 201 });
}
