import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb();
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Eksik üye ID' }, { status: 400 });

  const removeMember = db.transaction(async (txDb) => {
    await txDb.prepare('DELETE FROM members WHERE id = ?').run(Number(id));
    await txDb.prepare('DELETE FROM users WHERE member_id = ?').run(Number(id));
  });

  await removeMember();

  return NextResponse.json({ success: true });
}
