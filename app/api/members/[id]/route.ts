import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Eksik üye ID' }, { status: 400 });

  db.transaction(() => {
    db.prepare('DELETE FROM members WHERE id = ?').run(Number(id));
    db.prepare('DELETE FROM users WHERE member_id = ?').run(Number(id));
  })();

  return NextResponse.json({ success: true });
}
