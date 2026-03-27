import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getWeekNumber } from '@/lib/parser';
import type { RolloverResult } from '@/lib/types';

function getNextIsoWeek(week: number, year: number) {
  const nextDate = new Date(Date.UTC(year, 0, 4 + week * 7));
  return getWeekNumber(nextDate);
}

function getPreviousIsoWeek(week: number, year: number) {
  const prevDate = new Date(Date.UTC(year, 0, 4 + (week - 2) * 7));
  return getWeekNumber(prevDate);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json().catch(() => ({}));
  const mode = body?.mode === 'auto' ? 'auto' : 'manual';
  const now = new Date();
  const isSunday = now.getDay() === 0;

  const current = getWeekNumber(now);
  let sourceWeek = 0;
  let sourceYear = 0;
  let newWeek = 0;
  let newYear = 0;

  if (mode === 'auto') {
    if (!isSunday) {
      const skippedResult: RolloverResult = {
        rolledOver: 0,
        archived: 0,
        newWeek: current.week,
        newYear: current.year,
        skipped: true,
        reason: 'Auto rollover only runs on Sunday.',
      };
      return NextResponse.json(skippedResult);
    }

    sourceWeek = current.week;
    sourceYear = current.year;
    const next = getNextIsoWeek(current.week, current.year);
    newWeek = next.week;
    newYear = next.year;

    const autoKey = `auto-rollover-${sourceYear}-W${sourceWeek}`;
    const alreadyDone = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(autoKey) as { value?: string } | undefined;
    if (alreadyDone?.value === 'done') {
      const skippedResult: RolloverResult = {
        rolledOver: 0,
        archived: 0,
        newWeek,
        newYear,
        skipped: true,
        reason: 'This week already auto-rolled over.',
      };
      return NextResponse.json(skippedResult);
    }
  } else {
    newWeek = current.week;
    newYear = current.year;
    const prev = getPreviousIsoWeek(current.week, current.year);
    sourceWeek = prev.week;
    sourceYear = prev.year;
  }

  const sourceTasks = db.prepare(
    "SELECT * FROM tasks WHERE week_number = ? AND year = ?"
  ).all(sourceWeek, sourceYear) as Array<{
    id: number; title: string; body: string; status: string;
    project_id: number; assigned_to: number; helper_id: number; tags: string;
  }>;

  const rolloverInsert = db.prepare(`
    INSERT INTO tasks (
      title, body, status, project_id, assigned_to, helper_id,
      week_number, year, is_rollover, origin_task_id, source_week_number, source_year, pulled_into_current_week, tags
    )
    VALUES (?, ?, 'pending', ?, ?, NULL, ?, ?, 1, ?, ?, ?, 0, ?)
  `);

  const duplicateCheck = db.prepare(`
    SELECT id FROM tasks WHERE origin_task_id = ? AND week_number = ? AND year = ? LIMIT 1
  `);

  const upsertSetting = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  let rolledOver = 0;
  let archived = 0;

  const doRollover = db.transaction(() => {
    for (const task of sourceTasks) {
      if (task.status !== 'done') {
        const exists = duplicateCheck.get(task.id, newWeek, newYear) as { id: number } | undefined;
        if (exists) continue;

        rolloverInsert.run(
          task.title, task.body, task.project_id, task.assigned_to,
          newWeek, newYear, task.id, sourceWeek, sourceYear, task.tags
        );
        rolledOver++;
      } else {
        archived++;
      }
    }

    if (mode === 'auto') {
      const autoKey = `auto-rollover-${sourceYear}-W${sourceWeek}`;
      upsertSetting.run(autoKey, 'done');
    }
  });

  doRollover();

  const result: RolloverResult = { rolledOver, archived, newWeek, newYear };
  return NextResponse.json(result);
}
