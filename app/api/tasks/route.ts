import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getWeekNumber } from '@/lib/parser';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const assignedTo = searchParams.get('assignedTo');
  const weekNum = searchParams.get('week');
  const year = searchParams.get('year');
  const projectId = searchParams.get('project');
  const status = searchParams.get('status');

  let query = `
    SELECT t.*, 
      p.name as project_name, p.color as project_color,
      m1.name as assigned_name, m2.name as helper_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN members m1 ON t.assigned_to = m1.id
    LEFT JOIN members m2 ON t.helper_id = m2.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (assignedTo) { query += ` AND t.assigned_to = ?`; params.push(Number(assignedTo)); }
  if (weekNum) { query += ` AND t.week_number = ?`; params.push(Number(weekNum)); }
  if (year) { query += ` AND t.year = ?`; params.push(Number(year)); }
  if (projectId) { query += ` AND t.project_id = ?`; params.push(Number(projectId)); }
  if (status) { query += ` AND t.status = ?`; params.push(status); }

  query += ` ORDER BY t.created_at DESC`;

  const tasks = db.prepare(query).all(...params);
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { week, year } = getWeekNumber();

  const stmt = db.prepare(`
    INSERT INTO tasks (title, body, status, project_id, assigned_to, week_number, year, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    body.title || 'Yeni Görev',
    body.body || '',
    body.status || 'pending',
    body.project_id || null,
    body.assigned_to || null,
    body.week_number || week,
    body.year || year,
    body.tags || ''
  );

  const task = db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color,
      m1.name as assigned_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN members m1 ON t.assigned_to = m1.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  return NextResponse.json(task, { status: 201 });
}
