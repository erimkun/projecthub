import { NextRequest, NextResponse } from 'next/server';
import { PDFFont, PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import getDb from '@/lib/db';
import { getWeekNumber } from '@/lib/parser';

type TaskRow = {
  id: number;
  title: string;
  status: 'pending' | 'done' | 'sos' | 'helping' | 'blocked';
  week_number: number;
  year: number;
  project_name: string | null;
  assigned_name: string | null;
  is_rollover: number;
};

type MemberRow = { id: number; name: string };

function getPreviousIsoWeek(week: number, year: number) {
  const prevDate = new Date(Date.UTC(year, 0, 4 + (week - 2) * 7));
  return getWeekNumber(prevDate);
}

function getNextIsoWeek(week: number, year: number) {
  const nextDate = new Date(Date.UTC(year, 0, 4 + week * 7));
  return getWeekNumber(nextDate);
}

function getPeriod(weekRange: number) {
  const current = getWeekNumber();
  const weeks: Array<{ week: number; year: number; key: string }> = [];
  let cursor = { week: current.week, year: current.year };
  for (let i = 0; i < weekRange; i++) {
    weeks.push({ week: cursor.week, year: cursor.year, key: `${cursor.year}-W${cursor.week}` });
    cursor = getPreviousIsoWeek(cursor.week, cursor.year);
  }
  return weeks.reverse();
}

function getPeriodFromBounds(startWeek: number, startYear: number, endWeek: number, endYear: number) {
  const weeks: Array<{ week: number; year: number; key: string }> = [];
  let cursor = { week: startWeek, year: startYear };
  let safety = 0;
  while (safety < 120) {
    weeks.push({ week: cursor.week, year: cursor.year, key: `${cursor.year}-W${cursor.week}` });
    if (cursor.week === endWeek && cursor.year === endYear) break;
    cursor = getNextIsoWeek(cursor.week, cursor.year);
    safety += 1;
  }
  return weeks;
}

function writeLine(page: PDFPage, text: string, y: number, font: PDFFont, size = 11) {
  page.drawText(text, { x: 40, y, size, font, color: rgb(0.16, 0.18, 0.22) });
}

export async function GET(req: NextRequest) {
  const db = await getDb();
  const { searchParams } = new URL(req.url);

  const memberId = Number(searchParams.get('memberId') || 0) || null;
  const projectId = Number(searchParams.get('projectId') || 0) || null;
  const weekRange = Math.min(Math.max(Number(searchParams.get('weekRange') || 8), 2), 24);

  const startWeek = Number(searchParams.get('startWeek') || 0) || null;
  const startYear = Number(searchParams.get('startYear') || 0) || null;
  const endWeek = Number(searchParams.get('endWeek') || 0) || null;
  const endYear = Number(searchParams.get('endYear') || 0) || null;

  const hasCustomBounds = !!(startWeek && startYear && endWeek && endYear);
  const weeks = hasCustomBounds
    ? getPeriodFromBounds(startWeek!, startYear!, endWeek!, endYear!)
    : getPeriod(weekRange);
  const weekKeySet = new Set(weeks.map((w) => w.key));

  const taskParams: number[] = [];
  let taskSql = `
    SELECT
      t.id,
      t.title,
      t.status,
      t.week_number,
      t.year,
      p.name as project_name,
      m.name as assigned_name,
      t.is_rollover
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN members m ON t.assigned_to = m.id
    WHERE 1=1
  `;

  if (memberId) {
    taskSql += ' AND t.assigned_to = ?';
    taskParams.push(memberId);
  }
  if (projectId) {
    taskSql += ' AND t.project_id = ?';
    taskParams.push(projectId);
  }

  const allTasks = await db.prepare(taskSql).all(...taskParams) as TaskRow[];
  const scopedTasks = allTasks.filter((task) => weekKeySet.has(`${task.year}-W${task.week_number}`));

  const completed = scopedTasks.filter((task) => task.status === 'done').length;
  const pending = scopedTasks.filter((task) => task.status === 'pending').length;
  const blocked = scopedTasks.filter((task) => task.status === 'blocked').length;
  const sos = scopedTasks.filter((task) => task.status === 'sos').length;

  const members = await db.prepare('SELECT id, name FROM members ORDER BY name ASC').all() as MemberRow[];
  const memberSummary = members
    .map((member) => {
      const bucket = scopedTasks.filter((task) => task.assigned_name === member.name);
      const done = bucket.filter((task) => task.status === 'done').length;
      return {
        name: member.name,
        total: bucket.length,
        done,
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 30, y: 540, width: 782, height: 34, color: rgb(0.92, 0.95, 1) });
  writeLine(page, 'Project Hub - Analytics Report', 553, bold, 16);

  writeLine(page, `Weeks: ${weeks[0]?.year}-W${weeks[0]?.week} to ${weeks[weeks.length - 1]?.year}-W${weeks[weeks.length - 1]?.week}`, 520, regular, 11);
  writeLine(page, `Filters -> memberId: ${memberId ?? 'all'}, projectId: ${projectId ?? 'all'}`, 504, regular, 11);

  writeLine(page, `Total Tasks: ${scopedTasks.length}`, 474, bold, 12);
  writeLine(page, `Completed: ${completed}  |  Pending: ${pending}  |  Blocked: ${blocked}  |  SOS: ${sos}`, 456, regular, 11);

  let y = 426;
  writeLine(page, 'Top Members', y, bold, 12);
  y -= 16;
  memberSummary.forEach((row, idx) => {
    writeLine(page, `${idx + 1}. ${row.name}  -  ${row.done}/${row.total} done`, y, regular, 10);
    y -= 14;
  });

  y -= 6;
  writeLine(page, 'Task Details (first 20)', y, bold, 12);
  y -= 16;

  scopedTasks.slice(0, 20).forEach((task, idx) => {
    const line = `${idx + 1}. [${task.status}] ${task.title} | H${task.week_number}/${task.year} | ${task.project_name || 'No Project'} | @${task.assigned_name || 'Unassigned'}`;
    writeLine(page, line.slice(0, 115), y, regular, 9);
    y -= 12;
  });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="project-hub-analytics.pdf"',
    },
  });
}
