'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getWeekNumber } from '@/lib/parser';

type MeetingAction = {
  id?: number;
  text: string;
  assigned_to: number | null;
  due_week_number: number;
  due_year: number;
  due_date: string;
};

export default function MeetingBoard() {
  const { members, projects, selectedWeek, selectedYear } = useAppStore();
  const [criticals, setCriticals] = useState('');
  const [decisions, setDecisions] = useState('');
  const [summary, setSummary] = useState('');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [actions, setActions] = useState<MeetingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/meetings?week=${selectedWeek}&year=${selectedYear}`);
        const data = await res.json();
        if (!active) return;
        setCriticals(String(data.meeting?.criticals || ''));
        setDecisions(String(data.meeting?.decisions || ''));
        setSummary(String(data.meeting?.summary || ''));
        setActions(
          (Array.isArray(data.actions) ? data.actions : []).map((row: Record<string, unknown>) => ({
            id: Number(row.id || 0),
            text: String(row.action_text || ''),
            assigned_to: row.assigned_to ? Number(row.assigned_to) : null,
            due_week_number: Number(row.due_week_number || selectedWeek),
            due_year: Number(row.due_year || selectedYear),
            due_date: String(row.due_date || ''),
          }))
        );
      } catch {
        if (active) setMessage('Toplantı verisi alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [selectedWeek, selectedYear]);

  const computedSummary = useMemo(() => {
    const lines: string[] = [
      `Haftalık Toplantı Özeti - H${selectedWeek}/${selectedYear}`,
      '',
      'Kritikler:',
      criticals || '-',
      '',
      'Kararlar:',
      decisions || '-',
      '',
      'Aksiyonlar:',
    ];

    if (actions.length === 0) {
      lines.push('- Aksiyon yok');
    } else {
      actions.forEach((action, index) => {
        const member = members.find((item) => item.id === action.assigned_to);
        lines.push(`${index + 1}. ${action.text || '(boş)'} | Sorumlu: ${member?.name || 'Atanmadı'} | Termin: H${action.due_week_number}/${action.due_year}${action.due_date ? ` (${action.due_date})` : ''}`);
      });
    }

    return lines.join('\n');
  }, [actions, criticals, decisions, members, selectedWeek, selectedYear]);

  const addAction = () => {
    const now = getWeekNumber();
    setActions((prev) => ([
      ...prev,
      {
        text: '',
        assigned_to: null,
        due_week_number: now.week,
        due_year: now.year,
        due_date: '',
      },
    ]));
  };

  const saveMeeting = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_number: selectedWeek,
          year: selectedYear,
          criticals,
          decisions,
          actions,
          project_id: projectId,
          autoCreateTasks: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Toplantı kaydedilemedi.');
        return;
      }
      setSummary(String(data.summary || computedSummary));
      setMessage('Toplantı kaydedildi. Özet notlara yazıldı ve aksiyon görevleri üretildi.');
    } catch {
      setMessage('Toplantı kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gap: 16 }}>
      <div>
        <h1>Haftalık Toplantı Modu</h1>
        <p className="text-muted mt-2" style={{ fontSize: 13 }}>
          Kritikler, kararlar ve aksiyonlar tek ekranda. Kaydettiğinizde özet otomatik notlara yansır.
        </p>
      </div>

      <section className="card" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-2)' }}>Kritikler</label>
          <textarea className="input" value={criticals} onChange={(e) => setCriticals(e.target.value)} placeholder="Bu hafta kritik riskler..." />
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-2)' }}>Kararlar</label>
          <textarea className="input" value={decisions} onChange={(e) => setDecisions(e.target.value)} placeholder="Toplantıda alınan kararlar..." />
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-2)' }}>Aksiyonların Projesi (isteğe bağlı)</label>
          <select className="input" value={projectId ?? ''} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Projesiz</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16 }}>Aksiyonlar</h2>
          <button className="btn btn-ghost" type="button" onClick={addAction}>
            <Plus size={14} /> Aksiyon Ekle
          </button>
        </div>

        {actions.length === 0 && (
          <div style={{ padding: 12, border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-3)', fontSize: 13 }}>
            Henüz aksiyon yok. Aksiyon Ekle ile başlayabilirsiniz.
          </div>
        )}

        {actions.map((action, index) => (
          <div key={index} style={{ display: 'grid', gap: 8, padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <input
              className="input"
              placeholder="Aksiyon metni"
              value={action.text}
              onChange={(e) => {
                const value = e.target.value;
                setActions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, text: value } : item));
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8 }}>
              <select
                className="input"
                value={action.assigned_to ?? ''}
                onChange={(e) => {
                  const assigned_to = e.target.value ? Number(e.target.value) : null;
                  setActions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, assigned_to } : item));
                }}
              >
                <option value="">Sorumlu seç</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                min={1}
                max={53}
                value={action.due_week_number}
                onChange={(e) => {
                  const due_week_number = Number(e.target.value || selectedWeek);
                  setActions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, due_week_number } : item));
                }}
              />
              <input
                className="input"
                type="number"
                min={2020}
                max={2100}
                value={action.due_year}
                onChange={(e) => {
                  const due_year = Number(e.target.value || selectedYear);
                  setActions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, due_year } : item));
                }}
              />
              <button
                className="btn-icon"
                type="button"
                onClick={() => setActions((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                title="Aksiyonu sil"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="card" style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ fontSize: 16 }}>Otomatik Özet Önizleme</h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-2)' }}>
          {summary || computedSummary}
        </pre>
      </section>

      {message && (
        <div className="status-badge status-pending" style={{ width: 'fit-content' }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" type="button" onClick={saveMeeting} disabled={saving || loading}>
          {saving ? 'Kaydediliyor...' : 'Toplantıyı Kaydet ve Notlara Yaz'}
        </button>
      </div>
    </div>
  );
}
