import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getSession } from '@/lib/session';
import { getWeekNumber } from '@/lib/parser';
import { logAudit } from '@/lib/audit';

type ActionInput = {
  text: string;
  assigned_tos?: number[];
  project_id?: number | null;
  new_project_name?: string;
  new_project_color?: string;
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
        decisions: '',
        summary: '',
      },
      actions: [],
    });
  }

  const actions = await db.prepare(`
    SELECT ma.*
    FROM meeting_actions ma
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
  const decisions = asText(body.decisions);
  const decisionsHtml = asText(body.decisionsHtml || body.decisions);
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
        "UPDATE meetings SET criticals = '', decisions = ?, updated_at = NOW() WHERE id = ?"
      ).run(decisionsHtml || decisions, meetingId);
      await txDb.prepare('DELETE FROM meeting_actions WHERE meeting_id = ?').run(meetingId);
    } else {
      const insertMeeting = await txDb.prepare(
        'INSERT INTO meetings (week_number, year, criticals, decisions, created_by_user_id) VALUES (?, ?, ?, ?, ?)'
      ).run(weekNumber, year, '', decisionsHtml || decisions, session.userId);
      meetingId = Number(insertMeeting.lastInsertRowid);
    }

    const actionRows: Array<{
      text: string;
      assignedIds: number[];
      assignedNames: string[];
      projectId: number | null;
      projectName: string;
      dueWeek: number;
      dueYear: number;
      dueDate: string;
      taskIds: number[];
    }> = [];

    const createdProjectByKey = new Map<string, { id: number; name: string }>();

    for (const action of actionsInput) {
      const text = asText(action.text);
      if (!text) continue;

      const assignedIds = Array.isArray(action.assigned_tos)
        ? action.assigned_tos.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
        : [];
      const dueWeek = Number(action.due_week_number || weekNumber) || weekNumber;
      const dueYear = Number(action.due_year || year) || year;
      const dueDate = asText(action.due_date);
      let effectiveProjectId = Number(action.project_id || 0) || null;
      let effectiveProjectName = 'Projesiz';

      const newProjectName = asText(action.new_project_name);
      const newProjectColor = asText(action.new_project_color) || '#f59e0b';
      if (newProjectName) {
        const key = `${newProjectName.toLowerCase()}::${newProjectColor.toLowerCase()}`;
        const cached = createdProjectByKey.get(key);
        if (cached) {
          effectiveProjectId = cached.id;
          effectiveProjectName = cached.name;
        } else {
          const createdProject = await txDb.prepare(
            'INSERT INTO projects (name, color) VALUES (?, ?)'
          ).run(newProjectName, newProjectColor);
          effectiveProjectId = Number(createdProject.lastInsertRowid);
          effectiveProjectName = newProjectName;
          createdProjectByKey.set(key, { id: effectiveProjectId, name: effectiveProjectName });
        }
      } else if (effectiveProjectId) {
        const project = await txDb.prepare('SELECT name FROM projects WHERE id = ?').get(effectiveProjectId) as { name: string } | undefined;
        if (project?.name) effectiveProjectName = project.name;
      }

      const assignedNames: string[] = [];
      for (const memberId of assignedIds) {
        const member = await txDb.prepare('SELECT name FROM members WHERE id = ?').get(memberId) as { name: string } | undefined;
        if (member?.name) assignedNames.push(member.name);
      }

      if (assignedNames.length === 0) assignedNames.push('Atanmadı');

      const taskIds: number[] = [];
      if (assignedIds.length > 0) {
        for (const assignedId of assignedIds) {
          const taskResult = await txDb.prepare(
            'INSERT INTO tasks (title, body, status, project_id, assigned_to, week_number, year, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(
            text,
            `Toplantı aksiyonu (${weekNumber}/${year})`,
            'pending',
            effectiveProjectId,
            assignedId,
            dueWeek,
            dueYear,
            'toplanti-aksiyon'
          );
          taskIds.push(Number(taskResult.lastInsertRowid));
        }
      } else {
        const taskResult = await txDb.prepare(
          'INSERT INTO tasks (title, body, status, project_id, assigned_to, week_number, year, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          text,
          `Toplantı aksiyonu (${weekNumber}/${year})`,
          'pending',
          effectiveProjectId,
          null,
          dueWeek,
          dueYear,
          'toplanti-aksiyon'
        );
        taskIds.push(Number(taskResult.lastInsertRowid));
      }

      await txDb.prepare(
        'INSERT INTO meeting_actions (meeting_id, action_text, assigned_to, assigned_member_ids, project_id, due_week_number, due_year, due_date, task_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        meetingId,
        text,
        assignedIds[0] || null,
        assignedIds.join(','),
        effectiveProjectId,
        dueWeek,
        dueYear,
        dueDate || null,
        taskIds[0] || null
      );

      actionRows.push({
        text,
        assignedIds,
        assignedNames,
        projectId: effectiveProjectId,
        projectName: effectiveProjectName,
        dueWeek,
        dueYear,
        dueDate,
        taskIds,
      });
    }

    const summaryLines = [
      `Haftalık Toplantı Özeti - H${weekNumber} ${year}`,
      '',
      'Kararlar:',
      asText((decisionsHtml || decisions).replace(/<[^>]+>/g, ' ')) || '-',
      '',
      'Aksiyonlar:',
      actionRows.length === 0
        ? '- Aksiyon yok'
        : actionRows.map((row, index) => `${index + 1}. ${row.text} | Sorumlu: ${row.assignedNames.join(', ')} | Proje: ${row.projectName} | Termin: H${row.dueWeek}/${row.dueYear}${row.dueDate ? ` (${row.dueDate})` : ''}`).join('\n'),
      '',
      `Toplantı kaydı: ${actor?.username || 'kullanıcı'}`,
    ];

    const summary = summaryLines.join('\n');
    const summaryHtml = `
      <div class="meeting-summary">
        <h3>Haftalık Toplantı Özeti - H${weekNumber}/${year}</h3>
        <div><strong>Kararlar</strong></div>
        <div>${decisionsHtml || decisions || '-'}</div>
        <div style="margin-top:12px;"><strong>Aksiyonlar</strong></div>
        <pre style="white-space:pre-wrap; font-family:var(--font-body);">${actionRows.length === 0 ? '- Aksiyon yok' : actionRows.map((row, index) => `${index + 1}. ${row.text} | Sorumlu: ${row.assignedNames.join(', ')} | Proje: ${row.projectName} | Termin: H${row.dueWeek}/${row.dueYear}${row.dueDate ? ` (${row.dueDate})` : ''}`).join('\n')}</pre>
      </div>
    `;

    if (noteId) {
      await txDb.prepare("UPDATE notes SET title = ?, content = ?, updated_at = NOW() WHERE id = ?")
        .run(`Toplantı Özeti - H${weekNumber}/${year}`, summaryHtml.trim(), noteId);
    } else {
      const note = await txDb.prepare(
        'INSERT INTO notes (title, content, project_id) VALUES (?, ?, ?)'
      ).run(`Toplantı Özeti - H${weekNumber}/${year}`, summaryHtml.trim(), null);
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
