import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Eksik proje ID' }, { status: 400 });

  const projectId = Number(id);
  const project = db.prepare('SELECT id, name, color FROM projects WHERE id = ?').get(projectId) as
    | { id: number; name: string; color: string }
    | undefined;

  if (!project) {
    return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 });
  }

  const totals = db.prepare(`
    SELECT
      COUNT(*) as totalTasks,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as doneTasks
    FROM tasks
    WHERE project_id = ?
  `).get(projectId) as { totalTasks: number; doneTasks: number | null };

  const weeklyRows = db.prepare(`
    SELECT
      year,
      week_number as week,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
    FROM tasks
    WHERE project_id = ?
    GROUP BY year, week_number
    ORDER BY year DESC, week_number DESC
  `).all(projectId) as Array<{ year: number; week: number; total: number; done: number | null }>;

  const tasksByWeekStmt = db.prepare(`
    SELECT t.*, m.name as assigned_name
    FROM tasks t
    LEFT JOIN members m ON t.assigned_to = m.id
    WHERE t.project_id = ? AND t.year = ? AND t.week_number = ?
    ORDER BY t.created_at DESC
  `);

  const weeklyBreakdown = weeklyRows.map((row) => ({
    year: row.year,
    week: row.week,
    total: row.total,
    done: row.done ?? 0,
    tasks: tasksByWeekStmt.all(projectId, row.year, row.week),
  }));

  const memberBreakdown = db.prepare(`
    SELECT
      m.id as memberId,
      m.name as name,
      COUNT(t.id) as total,
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done
    FROM tasks t
    JOIN members m ON t.assigned_to = m.id
    WHERE t.project_id = ?
    GROUP BY m.id, m.name
    ORDER BY total DESC, name ASC
  `).all(projectId) as Array<{ memberId: number; name: string; total: number; done: number | null }>;

  return NextResponse.json({
    project,
    weeklyBreakdown,
    memberBreakdown: memberBreakdown.map((m) => ({ ...m, done: m.done ?? 0 })),
    totalTasks: totals.totalTasks,
    doneTasks: totals.doneTasks ?? 0,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Eksik proje ID' }, { status: 400 });

  db.transaction(() => {
    db.prepare('DELETE FROM projects WHERE id = ?').run(Number(id));
    db.prepare('DELETE FROM tasks WHERE project_id = ?').run(Number(id));
  })();

  return NextResponse.json({ success: true });
}
