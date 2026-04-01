import { NextRequest, NextResponse } from 'next/server';
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

type MemberRow = {
  id: number;
  name: string;
};

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
  const guardLimit = 120;
  let safety = 0;

  while (safety < guardLimit) {
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

  const taskParams: Array<number> = [];
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
    FROM tasks
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN members m ON t.assigned_to = m.id
    WHERE 1=1
  `;

  if (memberId) {
    taskSql += ' AND assigned_to = ?';
    taskParams.push(memberId);
  }
  if (projectId) {
    taskSql += ' AND project_id = ?';
    taskParams.push(projectId);
  }

  const allTasks = await db.prepare(taskSql).all(...taskParams) as TaskRow[];
  const scopedTasks = allTasks.filter((task) => weekKeySet.has(`${task.year}-W${task.week_number}`));

  const total = scopedTasks.length;
  const completed = scopedTasks.filter((t) => t.status === 'done').length;
  const pending = scopedTasks.filter((t) => t.status === 'pending').length;
  const blocked = scopedTasks.filter((t) => t.status === 'blocked').length;
  const sos = scopedTasks.filter((t) => t.status === 'sos').length;
  const helping = scopedTasks.filter((t) => t.status === 'helping').length;

  const weeklyTrend = weeks.map((w) => {
    const bucket = scopedTasks.filter((task) => task.week_number === w.week && task.year === w.year);
    const created = bucket.length;
    const done = bucket.filter((task) => task.status === 'done').length;

    return {
      week: w.week,
      year: w.year,
      created,
      completed: done,
      pending: bucket.filter((task) => task.status === 'pending').length,
      blocked: bucket.filter((task) => task.status === 'blocked').length,
      rolloverCount: bucket.filter((task) => task.is_rollover === 1).length,
      completionRate: created > 0 ? Number(((done / created) * 100).toFixed(1)) : 0,
    };
  });

  const projectMap = new Map<number, { total: number; completed: number }>();
  scopedTasks.forEach((task) => {
    if (!task.project_id) return;
    const existing = projectMap.get(task.project_id) || { total: 0, completed: 0 };
    existing.total += 1;
    if (task.status === 'done') existing.completed += 1;
    projectMap.set(task.project_id, existing);
  });

  const projectIds = Array.from(projectMap.keys());
  const projects = projectIds.length > 0
    ? await db.prepare(`SELECT id, name, color FROM projects WHERE id = ANY(?)`).all(projectIds) as Array<{ id: number; name: string; color: string }>
    : [];

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const topProjects = Array.from(projectMap.entries())
    .map(([projectId, stats]) => {
      const project = projectById.get(projectId);
      return {
        projectId,
        name: project?.name || `Proje ${projectId}`,
        color: project?.color || '#7c88ff',
        total: stats.total,
        completed: stats.completed,
        completionRate: stats.total > 0 ? Number(((stats.completed / stats.total) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const members = await db.prepare('SELECT id, name FROM members ORDER BY name ASC').all() as MemberRow[];
  const memberWorkload = members
    .map((member) => {
      const bucket = scopedTasks.filter((task) => task.assigned_to === member.id);
      const done = bucket.filter((task) => task.status === 'done').length;
      return {
        memberId: member.id,
        name: member.name,
        total: bucket.length,
        completed: done,
        pending: bucket.filter((task) => task.status === 'pending').length,
        blocked: bucket.filter((task) => task.status === 'blocked').length,
        sos: bucket.filter((task) => task.status === 'sos').length,
        completionRate: bucket.length > 0 ? Number(((done / bucket.length) * 100).toFixed(1)) : 0,
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    period: {
      startWeek: weeks[0]?.week,
      startYear: weeks[0]?.year,
      endWeek: weeks[weeks.length - 1]?.week,
      endYear: weeks[weeks.length - 1]?.year,
    },
    filters: {
      memberId,
      projectId,
      weekRange: hasCustomBounds ? null : weekRange,
      startWeek: hasCustomBounds ? startWeek : null,
      startYear: hasCustomBounds ? startYear : null,
      endWeek: hasCustomBounds ? endWeek : null,
      endYear: hasCustomBounds ? endYear : null,
    },
    taskMetrics: {
      total,
      completed,
      pending,
      blocked,
      sos,
      helping,
      completionRate: total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0,
    },
    weeklyTrend,
    topProjects,
    memberWorkload,
    scopedTasks: scopedTasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      week_number: task.week_number,
      year: task.year,
      project_id: task.project_id,
      project_name: task.project_name,
      assigned_to: task.assigned_to,
      assigned_name: task.assigned_name,
      is_rollover: task.is_rollover,
    })),
  });
}
