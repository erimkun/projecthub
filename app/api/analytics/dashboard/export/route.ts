import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import getDb from '@/lib/db';
import { getWeekNumber } from '@/lib/parser';

type TaskRow = {
  id: number;
  title: string;
  status: 'pending' | 'done' | 'sos' | 'helping' | 'blocked';
  week_number: number;
  year: number;
  project_id: number | null;
  project_name: string | null;
  assigned_to: number | null;
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
      t.project_id,
      p.name as project_name,
      t.assigned_to,
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

  const weeklyTrend = weeks.map((w) => {
    const bucket = scopedTasks.filter((task) => task.week_number === w.week && task.year === w.year);
    const created = bucket.length;
    const completed = bucket.filter((task) => task.status === 'done').length;
    return {
      week: w.week,
      year: w.year,
      created,
      completed,
      pending: bucket.filter((task) => task.status === 'pending').length,
      blocked: bucket.filter((task) => task.status === 'blocked').length,
      sos: bucket.filter((task) => task.status === 'sos').length,
      helping: bucket.filter((task) => task.status === 'helping').length,
      rollover: bucket.filter((task) => task.is_rollover === 1).length,
      completionRate: created > 0 ? Number(((completed / created) * 100).toFixed(1)) : 0,
    };
  });

  const members = await db.prepare('SELECT id, name FROM members ORDER BY name ASC').all() as MemberRow[];
  const memberWorkload = members
    .map((member) => {
      const bucket = scopedTasks.filter((task) => task.assigned_to === member.id);
      const completed = bucket.filter((task) => task.status === 'done').length;
      return {
        memberId: member.id,
        member: member.name,
        total: bucket.length,
        completed,
        pending: bucket.filter((task) => task.status === 'pending').length,
        blocked: bucket.filter((task) => task.status === 'blocked').length,
        sos: bucket.filter((task) => task.status === 'sos').length,
        helping: bucket.filter((task) => task.status === 'helping').length,
        completionRate: bucket.length > 0 ? Number(((completed / bucket.length) * 100).toFixed(1)) : 0,
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);

  const projectMap = new Map<string, { total: number; completed: number }>();
  scopedTasks.forEach((task) => {
    const key = task.project_name || 'Projelendirilmemiş';
    const value = projectMap.get(key) || { total: 0, completed: 0 };
    value.total += 1;
    if (task.status === 'done') value.completed += 1;
    projectMap.set(key, value);
  });

  const projectSummary = Array.from(projectMap.entries()).map(([project, value]) => ({
    project,
    total: value.total,
    completed: value.completed,
    completionRate: value.total > 0 ? Number(((value.completed / value.total) * 100).toFixed(1)) : 0,
  }));

  const overview = [
    { metric: 'Toplam Görev', value: scopedTasks.length },
    { metric: 'Tamamlanan', value: scopedTasks.filter((task) => task.status === 'done').length },
    { metric: 'Bekleyen', value: scopedTasks.filter((task) => task.status === 'pending').length },
    { metric: 'Bloke', value: scopedTasks.filter((task) => task.status === 'blocked').length },
    { metric: 'SOS', value: scopedTasks.filter((task) => task.status === 'sos').length },
    { metric: 'Yardım Eden', value: scopedTasks.filter((task) => task.status === 'helping').length },
    { metric: 'Rollover', value: scopedTasks.filter((task) => task.is_rollover === 1).length },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(overview), 'Özet');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(weeklyTrend), 'Haftalık Trend');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(memberWorkload), 'Üye Yükü');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(projectSummary), 'Proje Özet');
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      scopedTasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        week: task.week_number,
        year: task.year,
        project: task.project_name || '',
        assigned_to: task.assigned_name || '',
        is_rollover: task.is_rollover,
      }))
    ),
    'Görev Detay'
  );

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="project-hub-analytics.xlsx"',
    },
  });
}
