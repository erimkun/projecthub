import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import * as XLSX from 'xlsx';
import { getWeekNumber } from '@/lib/parser';

export async function POST(req: NextRequest) {
  const db = await getDb();
  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, string>[];

  const { week, year } = getWeekNumber();

  const insertMany = db.transaction(async (txDb) => {
    const txInsert = txDb.prepare(
      'INSERT INTO tasks (title, body, status, project_id, assigned_to, week_number, year, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    for (const row of rows) {
      await txInsert.run(
        String(row['Başlık'] || row['Title'] || row['title'] || 'İsimsiz Görev'),
        String(row['Açıklama'] || row['Body'] || row['description'] || ''),
        'pending',
        row['Proje ID'] ? Number(row['Proje ID']) : null,
        row['Kişi ID'] ? Number(row['Kişi ID']) : null,
        week,
        year,
        String(row['Etiketler'] || row['Tags'] || '')
      );
    }
  });

  await insertMany();
  return NextResponse.json({ imported: rows.length });
}

export async function GET() {
  const db = await getDb();
  const tasks = await db.prepare(`
    SELECT t.id, t.title, t.body, t.status, t.tags, t.week_number, t.year,
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
