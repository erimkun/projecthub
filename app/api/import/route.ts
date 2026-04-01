import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import * as XLSX from 'xlsx';
import { getWeekNumber } from '@/lib/parser';

type ImportRow = Record<string, unknown>;
type ImportTarget = 'tasks' | 'projects';
type ImportMapping = Partial<Record<'title' | 'body' | 'project_id' | 'assigned_to' | 'tags' | 'status' | 'week_number' | 'year' | 'parent_task_id' | 'project_name' | 'project_color', string>>;

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function pickValue(row: ImportRow, mappingKey: string | undefined, fallbacks: string[]): unknown {
  if (mappingKey && mappingKey in row) return row[mappingKey];
  for (const key of fallbacks) {
    if (key in row && asText(row[key]) !== '') return row[key];
  }
  return undefined;
}

function normalizedStatus(value: unknown): 'pending' | 'done' | 'sos' | 'helping' | 'blocked' {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'done') return 'done';
  if (normalized === 'sos') return 'sos';
  if (normalized === 'helping') return 'helping';
  if (normalized === 'blocked' || normalized === 'bloke') return 'blocked';
  return 'pending';
}

function collectColumns(rows: ImportRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows.slice(0, 30)) {
    Object.keys(row).forEach((key) => seen.add(key));
  }
  return Array.from(seen);
}

export async function POST(req: NextRequest) {
  const db = await getDb();
  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });

  const mode = String(formData.get('mode') || 'import');
  const target = (String(formData.get('target') || 'tasks') === 'projects' ? 'projects' : 'tasks') as ImportTarget;
  const mappingRaw = formData.get('mapping');
  let mapping: ImportMapping = {};
  if (typeof mappingRaw === 'string' && mappingRaw.trim()) {
    try {
      mapping = JSON.parse(mappingRaw) as ImportMapping;
    } catch {
      return NextResponse.json({ error: 'Kolon eşleme verisi geçersiz.' }, { status: 400 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as ImportRow[];
  const columns = collectColumns(rows);

  if (mode === 'preview') {
    return NextResponse.json({
      target,
      columns,
      rowCount: rows.length,
      sampleRows: rows.slice(0, 5),
    });
  }

  if (target === 'projects') {
    const insertManyProjects = db.transaction(async (txDb) => {
      const txInsertProject = txDb.prepare('INSERT INTO projects (name, color) VALUES (?, ?)');

      for (const row of rows) {
        const projectNameValue = pickValue(row, mapping.project_name, ['Proje', 'Proje Adı', 'Proje Adi', 'Project', 'Project Name', 'name']);
        const projectColorValue = pickValue(row, mapping.project_color, ['Renk', 'Color', 'project_color']);

        const name = asText(projectNameValue);
        if (!name) continue;

        await txInsertProject.run(
          name,
          asText(projectColorValue) || '#f59e0b'
        );
      }
    });

    await insertManyProjects();
    return NextResponse.json({ imported: rows.length, target, columnsDetected: columns.length });
  }

  const { week, year } = getWeekNumber();

  const insertMany = db.transaction(async (txDb) => {
    const txInsert = txDb.prepare(
      'INSERT INTO tasks (title, body, status, parent_task_id, project_id, assigned_to, week_number, year, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    for (const row of rows) {
      const titleValue = pickValue(row, mapping.title, ['Başlık', 'Title', 'title']);
      const bodyValue = pickValue(row, mapping.body, ['Açıklama', 'Body', 'description']);
      const projectValue = pickValue(row, mapping.project_id, ['Proje ID', 'Project ID', 'project_id']);
      const assignedValue = pickValue(row, mapping.assigned_to, ['Kişi ID', 'Assignee ID', 'assigned_to']);
      const tagsValue = pickValue(row, mapping.tags, ['Etiketler', 'Tags', 'tags']);
      const statusValue = pickValue(row, mapping.status, ['Durum', 'Status', 'status']);
      const weekValue = pickValue(row, mapping.week_number, ['Hafta', 'Week', 'week_number']);
      const yearValue = pickValue(row, mapping.year, ['Yıl', 'Yil', 'Year', 'year']);
      const parentValue = pickValue(row, mapping.parent_task_id, ['Üst Görev ID', 'Parent Task ID', 'parent_task_id']);

      await txInsert.run(
        asText(titleValue) || 'İsimsiz Görev',
        asText(bodyValue),
        normalizedStatus(statusValue),
        asNumber(parentValue),
        asNumber(projectValue),
        asNumber(assignedValue),
        asNumber(weekValue) || week,
        asNumber(yearValue) || year,
        asText(tagsValue)
      );
    }
  });

  await insertMany();
  return NextResponse.json({ imported: rows.length, target, columnsDetected: columns.length });
}

export async function GET() {
  const db = await getDb();
  const tasks = await db.prepare(`
    SELECT t.id, t.parent_task_id, t.title, t.body, t.status, t.tags, t.week_number, t.year,
      p.name as project, m.name as assigned_to
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN members m ON t.assigned_to = m.id
    ORDER BY t.created_at DESC
  `).all();

  const ws = XLSX.utils.json_to_sheet(tasks);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Görevler');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="project-hub-tasks.xlsx"',
    },
  });
}
