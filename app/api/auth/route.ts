import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import getDb from '@/lib/db';
import { createSession, COOKIE_NAME } from '@/lib/session';

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { username, password, action } = body; // action: 'login' | 'register'

  if (!username?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'Kullanıcı adı ve şifre gerekli' }, { status: 400 });
  }

  if (action === 'register') {
    // Check if username exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
    if (existing) {
      return NextResponse.json({ error: 'Bu kullanıcı adı zaten alınmış' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);

    // Create a member profile with the same name
    const memberResult = db.prepare(
      "INSERT INTO members (name, status) VALUES (?, 'available')"
    ).run(username.trim());

    const userResult = db.prepare(
      'INSERT INTO users (username, password_hash, member_id) VALUES (?, ?, ?)'
    ).run(username.trim(), hash, memberResult.lastInsertRowid);

    const token = await createSession({
      userId: Number(userResult.lastInsertRowid),
      username: username.trim(),
      memberId: Number(memberResult.lastInsertRowid),
    });

    const res = NextResponse.json({ success: true, memberId: Number(memberResult.lastInsertRowid) });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    return res;
  }

  // Login
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim()) as
    | { id: number; username: string; password_hash: string; member_id: number | null }
    | undefined;

  if (!user) {
    return NextResponse.json({ error: 'Kullanıcı adı veya şifre hatalı' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Kullanıcı adı veya şifre hatalı' }, { status: 401 });
  }

  const token = await createSession({
    userId: user.id,
    username: user.username,
    memberId: user.member_id,
  });

  const res = NextResponse.json({ success: true, memberId: user.member_id });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return res;
}
