import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb();
  const { id } = await params;
  const body = await req.json();
  const session = await getSession();

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
  if (body.blocked_reason !== undefined) { fields.push('blocked_reason = ?'); values.push(body.blocked_reason); }
  if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
  if (body.body !== undefined) { fields.push('body = ?'); values.push(body.body); }
  if (body.parent_task_id !== undefined) { fields.push('parent_task_id = ?'); values.push(body.parent_task_id); }
  if (body.project_id !== undefined) { fields.push('project_id = ?'); values.push(body.project_id); }
  if (body.assigned_to !== undefined) { fields.push('assigned_to = ?'); values.push(body.assigned_to); }
  if (body.helper_id !== undefined) { fields.push('helper_id = ?'); values.push(body.helper_id); }
  if (body.week_number !== undefined) { fields.push('week_number = ?'); values.push(body.week_number); }
  if (body.year !== undefined) { fields.push('year = ?'); values.push(body.year); }
  if (body.is_rollover !== undefined) { fields.push('is_rollover = ?'); values.push(body.is_rollover); }
  if (body.source_week_number !== undefined) { fields.push('source_week_number = ?'); values.push(body.source_week_number); }
  if (body.source_year !== undefined) { fields.push('source_year = ?'); values.push(body.source_year); }
  if (body.pulled_into_current_week !== undefined) { fields.push('pulled_into_current_week = ?'); values.push(body.pulled_into_current_week); }
  if (body.tags !== undefined) { fields.push('tags = ?'); values.push(body.tags); }

  if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  values.push(Number(id));
  await db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  await logAudit(
    db,
    'task_updated',
    'task',
    Number(id),
    session?.userId || null,
    `Görev güncellendi. Alanlar: ${fields.map((field) => field.split('=')[0].trim()).join(', ')}`
  );

  // Create notification if status changed to 'sos'
  if (body.status === 'sos' && body.sos_from && body.sos_to) {
    await db.prepare(`
      INSERT INTO notifications (to_member_id, from_member_id, task_id, type, message)
      VALUES (?, ?, ?, 'sos', ?)
    `).run(body.sos_to, body.sos_from, Number(id), `SOS: ${body.task_title || 'Görev'} için yardım isteniyor`);
  }

  const task = await db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color,
      m1.name as assigned_name, m2.name as helper_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN members m1 ON t.assigned_to = m1.id
    LEFT JOIN members m2 ON t.helper_id = m2.id
    WHERE t.id = ?
  `).get(Number(id));

  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb();
  const { id } = await params;
  const session = await getSession();
  await db.prepare('DELETE FROM tasks WHERE id = ?').run(Number(id));
  await logAudit(db, 'task_deleted', 'task', Number(id), session?.userId || null, `Görev silindi: ${id}`);
  return NextResponse.json({ success: true });
}
