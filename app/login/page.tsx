'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, User, Lock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, action: mode }),
      });

      let data: { error?: string } = {};
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text) as { error?: string };
        } catch {
          // Ignore parsing errors and rely on fallback error text.
        }
      }

      if (!res.ok) {
        setError(data.error || 'Bir hata oluştu');
        return;
      }

      router.push('/?login=1');
      router.refresh();
    } catch {
      setError('Sunucuya ulaşılamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)',
    }}>
      {/* Background grid decoration */}
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.03,
        backgroundImage: 'repeating-linear-gradient(0deg, var(--text-1) 0, var(--text-1) 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, var(--text-1) 0, var(--text-1) 1px, transparent 1px, transparent 48px)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: 'min(400px, calc(100vw - 40px))',
        animation: 'slide-up 0.35s cubic-bezier(0.22,1,0.36,1)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            fontFamily: 'var(--font-display)', 
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={24} color="oklch(10% 0 0)" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                Project<span style={{ color: 'var(--accent)' }}>Hub</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Ekip Üretkenlik Paneli
              </div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: 32,
        }}>
          {/* Mode tabs */}
          <div className="view-toggle" style={{ marginBottom: 24 }}>
            <button
              className={`view-toggle-btn${mode === 'login' ? ' active' : ''}`}
              onClick={() => { setMode('login'); setError(''); }}
              id="tab-login"
            >
              Giriş Yap
            </button>
            <button
              className={`view-toggle-btn${mode === 'register' ? ' active' : ''}`}
              onClick={() => { setMode('register'); setError(''); }}
              id="tab-register"
            >
              Kayıt Ol
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Kullanıcı Adı
              </label>
              <div style={{ position: 'relative' }}>
                <User size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                <input
                  className="input"
                  style={{ paddingLeft: 36 }}
                  placeholder="ahmet"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  autoComplete="username"
                  id="input-username"
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Şifre
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                <input
                  className="input"
                  type="password"
                  style={{ paddingLeft: 36 }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  id="input-password"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', background: 'color-mix(in oklch, var(--accent-sos) 10%, transparent)',
                border: '1px solid color-mix(in oklch, var(--accent-sos) 30%, transparent)',
                borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--accent-sos)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: 14, marginTop: 4 }}
              disabled={loading}
              id="btn-auth-submit"
            >
              {loading ? 'Bekleniyor...' : mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>

          {mode === 'register' && (
            <p style={{ marginTop: 14, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
              Kayıt olunca otomatik olarak ekip üyesi profili oluşturulur.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
