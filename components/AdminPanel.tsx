'use client';

import { useEffect, useState } from 'react';

type PendingUser = {
  id: number;
  username: string;
  created_at: string;
};

type AuditRow = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  detail: string;
  actor_username: string | null;
  created_at: string;
};

export default function AdminPanel() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [pendingRes, auditRes] = await Promise.all([
        fetch('/api/admin/pending-users'),
        fetch('/api/admin/audit'),
      ]);

      if (!pendingRes.ok || !auditRes.ok) {
        setError('Superadmin yetkisi gerekli veya veri alınamadı.');
        return;
      }

      const pendingData = await pendingRes.json();
      const auditData = await auditRes.json();
      setPendingUsers(Array.isArray(pendingData.users) ? pendingData.users : []);
      setLogs(Array.isArray(auditData.logs) ? auditData.logs : []);
    } catch {
      setError('Yönetim verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const updatePending = async (userId: number, action: 'approve' | 'reject') => {
    const res = await fetch('/api/admin/pending-users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action }),
    });
    if (res.ok) {
      await loadAll();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'İşlem başarısız.');
    }
  };

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gap: 16 }}>
      <div>
        <h1>Superadmin Kontrol Merkezi</h1>
        <p className="text-muted mt-2" style={{ fontSize: 13 }}>
          Kayıt onayları ve sistem audit kayıtları
        </p>
      </div>

      {error && (
        <div style={{ color: 'var(--accent-sos)', fontSize: 13 }}>{error}</div>
      )}

      <section className="card" style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ fontSize: 16 }}>Onay Bekleyen Kullanıcılar</h2>
        {loading && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Yükleniyor...</div>}
        {!loading && pendingUsers.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Onay bekleyen kullanıcı yok.</div>
        )}
        {pendingUsers.map((user) => (
          <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{user.username}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(user.created_at).toLocaleString('tr-TR')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={() => updatePending(user.id, 'approve')}>Onayla</button>
              <button className="btn btn-danger btn-sm" onClick={() => updatePending(user.id, 'reject')}>Reddet</button>
            </div>
          </div>
        ))}
      </section>

      <section className="card" style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ fontSize: 16 }}>Audit Trail</h2>
        <div style={{ display: 'grid', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
          {logs.map((log) => (
            <div key={log.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                <span className="status-badge status-pending">{log.action}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{log.entity_type}#{log.entity_id ?? '-'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(log.created_at).toLocaleString('tr-TR')}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{log.detail}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Yapan: {log.actor_username || 'sistem'}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
