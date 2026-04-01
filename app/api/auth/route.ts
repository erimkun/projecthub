import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import getDb from '@/lib/db';
import { createSession, COOKIE_NAME } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();
    const { username, password, action } = body; // action: 'login' | 'register'

    if (!username?.trim() || !password?.trim()) {
      return NextResponse.json({ error: 'Kullanıcı adı ve şifre gerekli' }, { status: 400 });
    }

    if (action === 'register') {
      // Check if username exists
      const existing = await db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
      if (existing) {
        return NextResponse.json({ error: 'Bu kullanıcı adı zaten alınmış' }, { status: 409 });
      }

      const hash = await bcrypt.hash(password, 10);
      const userResult = await db.prepare(
        'INSERT INTO users (username, password_hash, member_id, approved, is_superadmin) VALUES (?, ?, NULL, 0, 0)'
      ).run(username.trim(), hash);

      await db.prepare(
        'INSERT INTO audit_logs (action, entity_type, entity_id, actor_user_id, detail) VALUES (?, ?, ?, ?, ?)'
      ).run('register_requested', 'user', Number(userResult.lastInsertRowid), null, `Yeni kayıt beklemede: ${username.trim()}`);

      return NextResponse.json({ success: true, pendingApproval: true });
    }

    // Login
    const user = await db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim()) as
      | {
        id: number;
        username: string;
        password_hash: string;
        member_id: number | null;
        approved: number;
        is_superadmin: number;
      }
      | undefined;

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı adı veya şifre hatalı' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Kullanıcı adı veya şifre hatalı' }, { status: 401 });
    }

    if (!user.is_superadmin && user.approved !== 1) {
      return NextResponse.json({ error: 'Hesabınız henüz onaylanmadı. Superadmin onayı bekleniyor.' }, { status: 403 });
    }

    const token = await createSession({
      userId: user.id,
      username: user.username,
      memberId: user.member_id,
      isSuperadmin: user.is_superadmin === 1,
    });

    const res = NextResponse.json({ success: true, memberId: user.member_id, isSuperadmin: user.is_superadmin === 1 });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return res;
  } catch (error) {
    console.error('POST /api/auth failed:', error);
    return NextResponse.json({ error: 'Sunucu hatası oluştu' }, { status: 500 });
  }
}
