import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getSession } from '@/lib/session';
import { getWeekNumber } from '@/lib/parser';
import { logAudit } from '@/lib/audit';

type ActionInput = {
  text: string;
  assigned_to?: number | null;
  due_week_number?: number | null;
  due_year?: number | null;
  due_date?: string | null;
};

function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export async function GET(req: NextRequest) {
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const current = getWeekNumber();
  const week = Number(searchParams.get('week') || current.week);
  const year = Number(searchParams.get('year') || current.year);

  const meeting = await db.prepare(
    'SELECT * FROM meetings WHERE week_number = ? AND year = ?'
  ).get(week, year) as Record<string, unknown> | undefined;

  if (!meeting) {
    return NextResponse.json({
      meeting: {
        week_number: week,
        year,
        criticals: '',
        decisions: '',
        summary: '',
      },
      actions: [],
    });
  }

  const actions = await db.prepare(`
    SELECT ma.*, m.name as assigned_name
    FROM meeting_actions ma
    LEFT JOIN members m ON ma.assigned_to = m.id
    WHERE ma.meeting_id = ?
    ORDER BY ma.id ASC
  `).all(Number(meeting.id));

  return NextResponse.json({ meeting, actions });
}

export async function POST(req: NextRequest) {
  const db = await getDb();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

  const body = await req.json();
  const current = getWeekNumber();
  const weekNumber = Number(body.week_number || current.week);
  const year = Number(body.year || current.year);
  const criticals = asText(body.criticals);
  const decisions = asText(body.decisions);
  const projectId = Number(body.project_id || 0) || null;
  const autoCreateTasks = body.autoCreateTasks !== false;
  const actionsInput = Array.isArray(body.actions) ? body.actions as ActionInput[] : [];

  const actor = await db.prepare('SELECT username FROM users WHERE id = ?').get(session.userId) as { username: string } | undefined;

  const saveMeeting = db.transaction(async (txDb) => {
    const existing = await txDb.prepare(
      'SELECT id, note_id FROM meetings WHERE week_number = ? AND year = ?'
    ).get(weekNumber, year) as { id: number; note_id: number | null } | undefined;

    let meetingId: number;
    let noteId = existing?.note_id || null;

    if (existing) {
      meetingId = existing.id;
      await txDb.prepare(
        "UPDATE meetings SET criticals = ?, decisions = ?, updated_at = NOW() WHERE id = ?"
      ).run(criticals, decisions, meetingId);
      await txDb.prepare('DELETE FROM meeting_actions WHERE meeting_id = ?').run(meetingId);
    } else {
      const insertMeeting = await txDb.prepare(
        'INSERT INTO meetings (week_number, year, criticals, decisions, created_by_user_id) VALUES (?, ?, ?, ?, ?)'
      ).run(weekNumber, year, criticals, decisions, session.userId);
      meetingId = Number(insertMeeting.lastInsertRowid);
    }

    const actionRows: Array<{
      text: string;
      assignedTo: number | null;
      assignedName: string;
      dueWeek: number;
      dueYear: number;
      dueDate: string;
      taskId: number | null;
    }> = [];

    for (const action of actionsInput) {
      const text = asText(action.text);
      if (!text) continue;

      const assignedTo = Number(action.assigned_to || 0) || null;
      const dueWeek = Number(action.due_week_number || weekNumber) || weekNumber;
      const dueYear = Number(action.due_year || year) || year;
      const dueDate = asText(action.due_date);

      let assignedName = 'Atanmadı';
      if (assignedTo) {
        const member = await txDb.prepare('SELECT name FROM members WHERE id = ?').get(assignedTo) as { name: string } | undefined;
        if (member?.name) assignedName = member.name;
      }

      let taskId: number | null = null;
      if (autoCreateTasks) {
        const taskResult = await txDb.prepare(
          'INSERT INTO tasks (title, body, status, project_id, assigned_to, week_number, year, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          text,
          `Toplantı aksiyonu (${weekNumber}/${year})`,
          'pending',
          projectId,
          assignedTo,
          dueWeek,
          dueYear,
          'toplanti-aksiyon'
        );
        taskId = Number(taskResult.lastInsertRowid);
      }

      await txDb.prepare(
        'INSERT INTO meeting_actions (meeting_id, action_text, assigned_to, due_week_number, due_year, due_date, task_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(meetingId, text, assignedTo, dueWeek, dueYear, dueDate || null, taskId);

      actionRows.push({
        text,
        assignedTo,
        assignedName,
        dueWeek,
        dueYear,
        dueDate,
        taskId,
      });
    }

    const summaryLines = [
      `Haftalık Toplantı Özeti - H${weekNumber} ${year}`,
      '',
      'Kritikler:',
      criticals || '-',
      '',
      'Kararlar:',
      decisions || '-',
      '',
      'Aksiyonlar:',
      actionRows.length === 0
        ? '- Aksiyon yok'
        : actionRows.map((row, index) => `${index + 1}. ${row.text} | Sorumlu: ${row.assignedName} | Termin: H${row.dueWeek}/${row.dueYear}${row.dueDate ? ` (${row.dueDate})` : ''}`).join('\n'),
      '',
      `Toplantı kaydı: ${actor?.username || 'kullanıcı'}`,
    ];

    const summary = summaryLines.join('\n');
    const summaryHtml = `<pre style="white-space:pre-wrap; font-family:var(--font-body);">${summary}</pre>`;

    if (noteId) {
      await txDb.prepare("UPDATE notes SET title = ?, content = ?, updated_at = NOW() WHERE id = ?")
        .run(`Toplantı Özeti - H${weekNumber}/${year}`, summaryHtml, noteId);
    } else {
      const note = await txDb.prepare(
        'INSERT INTO notes (title, content, project_id) VALUES (?, ?, ?)'
      ).run(`Toplantı Özeti - H${weekNumber}/${year}`, summaryHtml, projectId);
      noteId = Number(note.lastInsertRowid);
    }

    await txDb.prepare("UPDATE meetings SET summary = ?, note_id = ?, updated_at = NOW() WHERE id = ?")
      .run(summary, noteId, meetingId);

    await logAudit(
      txDb,
      'meeting_saved',
      'meeting',
      meetingId,
      session.userId,
      `H${weekNumber}/${year} toplantı kaydı güncellendi. Aksiyon sayısı: ${actionRows.length}`
    );

    return { meetingId, noteId, summary, actionRows };
  });

  const result = await saveMeeting();
  return NextResponse.json({
    success: true,
    meetingId: result.meetingId,
    noteId: result.noteId,
    summary: result.summary,
    actionCount: result.actionRows.length,
  });
}
