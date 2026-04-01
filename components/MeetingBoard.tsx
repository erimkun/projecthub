'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bold, Image as ImageIcon, Italic, List, Palette, PenTool, Plus, Table, Trash2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getWeekNumber } from '@/lib/parser';
import DrawingModal from './DrawingModal';

type MeetingAction = {
  id?: number;
  text: string;
  assigned_tos: number[];
  project_id: number | null;
  new_project_name: string;
  new_project_color: string;
  due_week_number: number;
  due_year: number;
  due_date: string;
};

export default function MeetingBoard() {
  const { members, projects, selectedWeek, selectedYear, fetchProjects } = useAppStore();
  const [decisions, setDecisions] = useState('');
  const [summary, setSummary] = useState('');
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showDrawing, setShowDrawing] = useState(false);
  const [actions, setActions] = useState<MeetingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const colorPickerRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/meetings?week=${selectedWeek}&year=${selectedYear}`);
        const data = await res.json();
        if (!active) return;
        const decisionsHtml = String(data.meeting?.decisions || '<p><br></p>');
        setDecisions(decisionsHtml);
        if (editorRef.current) editorRef.current.innerHTML = decisionsHtml;
        setSummary(String(data.meeting?.summary || ''));
        setActions(
          (Array.isArray(data.actions) ? data.actions : []).map((row: Record<string, unknown>) => ({
            id: Number(row.id || 0),
            text: String(row.action_text || ''),
            assigned_tos: String(row.assigned_member_ids || '')
              .split(',')
              .map((value) => Number(value))
              .filter((value) => Number.isFinite(value) && value > 0),
            project_id: row.project_id ? Number(row.project_id) : null,
            new_project_name: '',
            new_project_color: '#f59e0b',
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

  const saveEditorContent = useCallback(() => {
    const value = editorRef.current?.innerHTML || '<p><br></p>';
    setDecisions(value);
  }, []);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    saveEditorContent();
  };

  const insertTable = () => {
    const html = `<table style="width:100%; border-collapse:collapse; margin:16px 0; border:1px solid var(--border)">
      <tr><td style="border:1px solid var(--border); padding:8px">Hücre</td><td style="border:1px solid var(--border); padding:8px">Hücre</td></tr>
      <tr><td style="border:1px solid var(--border); padding:8px">Hücre</td><td style="border:1px solid var(--border); padding:8px">Hücre</td></tr>
    </table><p><br></p>`;
    execCommand('insertHTML', html);
  };

  const insertImageFromUrl = () => {
    const url = imageUrl.trim();
    if (!url) return;
    execCommand('insertImage', url);
    setImageUrl('');
    setImageModalOpen(false);
  };

  const handleSaveDrawing = (base64: string) => {
    const html = `<img src="${base64}" alt="Toplantı çizimi" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--border);" /><br/>`;
    execCommand('insertHTML', html);
    setShowDrawing(false);
  };

  const computedSummary = useMemo(() => {
    const cleanDecisions = decisions.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const lines: string[] = [
      `Haftalık Toplantı Özeti - H${selectedWeek}/${selectedYear}`,
      '',
      'Kararlar:',
      cleanDecisions || '-',
      '',
      'Aksiyonlar:',
    ];

    if (actions.length === 0) {
      lines.push('- Aksiyon yok');
    } else {
      actions.forEach((action, index) => {
        const selectedMembers = members.filter((item) => action.assigned_tos.includes(item.id));
        const projectName = action.new_project_name.trim()
          ? action.new_project_name.trim()
          : (projects.find((project) => project.id === action.project_id)?.name || 'Projesiz');
        lines.push(`${index + 1}. ${action.text || '(boş)'} | Sorumlu: ${selectedMembers.length > 0 ? selectedMembers.map((member) => member.name).join(', ') : 'Atanmadı'} | Proje: ${projectName} | Termin: H${action.due_week_number}/${action.due_year}${action.due_date ? ` (${action.due_date})` : ''}`);
      });
    }

    return lines.join('\n');
  }, [actions, decisions, members, projects, selectedWeek, selectedYear]);

  const addAction = () => {
    const now = getWeekNumber();
    setActions((prev) => ([
      ...prev,
      {
        text: '',
        assigned_tos: [],
        project_id: null,
        new_project_name: '',
        new_project_color: '#f59e0b',
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
          decisionsHtml: decisions,
          actions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Toplantı kaydedilemedi.');
        return;
      }
      setSummary(String(data.summary || computedSummary));
      setMessage('Toplantı kaydedildi. Özet notlara yazıldı ve aksiyon görevleri üretildi.');
      await fetchProjects();
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
          Kararlar zengin metin olarak tutulur. Aksiyonlar kaydedildiğinde otomatik görev olur ve notlara özet düşer.
        </p>
      </div>

      <section className="card" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-2)' }}>Kararlar</label>
          <div className="notes-toolbar" style={{ gap: 6, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 8, flexWrap: 'wrap' }}>
            <button className="btn-icon" title="Kalın" onClick={() => execCommand('bold')}><Bold size={14} /></button>
            <button className="btn-icon" title="İtalik" onClick={() => execCommand('italic')}><Italic size={14} /></button>
            <button className="btn-icon" title="Liste" onClick={() => execCommand('insertUnorderedList')}><List size={14} /></button>
            <span style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
            <button className="btn-icon" title="Resim Ekle" onClick={() => setImageModalOpen(true)}><ImageIcon size={14} /></button>
            <button className="btn-icon" title="Tablo Ekle" onClick={insertTable}><Table size={14} /></button>
            <button className="btn-icon" title="Çizim Ekle" onClick={() => setShowDrawing(true)}><PenTool size={14} /></button>
          </div>
          <div
            ref={editorRef}
            contentEditable
            className="prose input"
            onInput={saveEditorContent}
            style={{ minHeight: 140, whiteSpace: 'normal' }}
            suppressContentEditableWarning
          />
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
                value=""
                onChange={(e) => {
                  const memberId = e.target.value ? Number(e.target.value) : 0;
                  if (!memberId) return;
                  setActions((prev) => prev.map((item, itemIndex) => {
                    if (itemIndex !== index) return item;
                    if (item.assigned_tos.includes(memberId)) return item;
                    return { ...item, assigned_tos: [...item.assigned_tos, memberId] };
                  }));
                }}
              >
                <option value="">Sorumlu ekle</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
              <select
                className="input"
                value={action.new_project_name.trim() ? '__new__' : (action.project_id ?? '')}
                onChange={(e) => {
                  const value = e.target.value;
                  setActions((prev) => prev.map((item, itemIndex) => {
                    if (itemIndex !== index) return item;
                    if (value === '__new__') {
                      return { ...item, project_id: null, new_project_name: item.new_project_name || '', new_project_color: item.new_project_color || '#f59e0b' };
                    }
                    return { ...item, project_id: value ? Number(value) : null, new_project_name: '' };
                  }));
                }}
              >
                <option value="">Projesiz</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
                <option value="__new__">+ Yeni Proje</option>
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

            {action.new_project_name !== '' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  value={action.new_project_name}
                  placeholder="Yeni proje adı"
                  onChange={(e) => {
                    const value = e.target.value;
                    setActions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, new_project_name: value } : item));
                  }}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn-icon"
                    title="Renk paletini aç"
                    onClick={() => colorPickerRefs.current[index]?.click()}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      border: '1px solid var(--border)',
                      background: 'conic-gradient(from 0deg, #ef4444, #f59e0b, #84cc16, #10b981, #06b6d4, #6366f1, #a855f7, #ef4444)',
                      color: 'white',
                    }}
                  >
                    <Palette size={15} />
                  </button>
                  <input
                    ref={(el) => {
                      colorPickerRefs.current[index] = el;
                    }}
                    type="color"
                    value={action.new_project_color}
                    onChange={(e) => {
                      const value = e.target.value;
                      setActions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, new_project_color: value } : item));
                    }}
                    style={{ width: 0, height: 0, opacity: 0, position: 'absolute', pointerEvents: 'none' }}
                  />
                  <span className="status-badge" style={{ background: action.new_project_color, color: '#0b1020' }}>{action.new_project_color}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {action.assigned_tos.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Sorumlu seçilmedi, görev atanmamış açılır.</span>
              )}
              {action.assigned_tos.map((memberId) => {
                const member = members.find((item) => item.id === memberId);
                if (!member) return null;
                return (
                  <button
                    key={memberId}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={() => {
                      setActions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, assigned_tos: item.assigned_tos.filter((id) => id !== memberId) } : item));
                    }}
                  >
                    @{member.name} ×
                  </button>
                );
              })}
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
          {saving ? 'Kaydediliyor...' : 'Kaydet (Aksiyonlar Otomatik Görev Olsun)'}
        </button>
      </div>

      {imageModalOpen && (
        <div className="overlay" onClick={() => setImageModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16 }}>Resim URL Ekle</h2>
            </div>
            <input
              className="input"
              autoFocus
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => setImageModalOpen(false)}>İptal</button>
              <button className="btn btn-primary" onClick={insertImageFromUrl}>Ekle</button>
            </div>
          </div>
        </div>
      )}

      {showDrawing && <DrawingModal onClose={() => setShowDrawing(false)} onSave={handleSaveDrawing} />}
    </div>
  );
}
