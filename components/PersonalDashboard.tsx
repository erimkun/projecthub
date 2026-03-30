'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import TaskCard from './TaskCard';
import { CheckCircle, Clock, AlertCircle, BookOpen, Plus, X } from 'lucide-react';

function QuickAddTask({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<number | null>(null);
  const { createTask, currentMemberId, projects, fetchTasks, selectedWeek, selectedYear } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask({
      title: title.trim(),
      project_id: projectId || undefined,
      assigned_to: currentMemberId || undefined,
      week_number: selectedWeek,
      year: selectedYear,
    });
    fetchTasks();
    onClose();
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: '14px 16px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--accent)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 0 0 3px color-mix(in oklch, var(--accent) 10%, transparent)',
        marginBottom: 10,
        animation: 'slide-up 0.2s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          autoFocus
          className="input"
          style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
          placeholder="Görev başlığı..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          id="quick-add-input"
        />
        <button type="button" className="btn-icon" onClick={onClose}><X size={14} /></button>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select
          className="input"
          style={{ flex: 1, padding: '5px 10px', fontSize: 12 }}
          value={projectId ?? ''}
          onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Proje seç (isteğe bağlı)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary btn-sm" id="quick-add-submit">
          <Plus size={13} /> Ekle
        </button>
      </div>
    </form>
  );
}

export default function PersonalDashboard() {
  const { tasks, currentMemberId, members, projects, notes, setActiveNoteId, setView, selectedWeek, selectedYear } = useAppStore();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'sos' | 'done' | 'rollover'>('all');
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  const [notesWidth, setNotesWidth] = useState(480);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = document.body.clientWidth - e.clientX - 32;
      setNotesWidth(Math.min(Math.max(newWidth, 300), 800));
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  const currentMember = members.find((m) => m.id === currentMemberId);
  const myTasks = tasks.filter(
    (t) => t.assigned_to === currentMemberId && t.week_number === selectedWeek && t.year === selectedYear
  );

  const pendingTasks = myTasks.filter((t) => t.status === 'pending' || t.status === 'helping');
  const sosTasks = myTasks.filter((t) => t.status === 'sos');
  const doneTasks = myTasks.filter((t) => t.status === 'done');
  const rolloverTasks = myTasks.filter((t) => t.is_rollover === 1);

  // Filtered task arrays for display
  const filteredTasks = myTasks.filter(t => {
     if (activeProjectId && t.project_id !== activeProjectId) return false;
     if (activeFilter === 'pending' && t.status !== 'pending' && t.status !== 'helping') return false;
     if (activeFilter === 'sos' && t.status !== 'sos') return false;
     if (activeFilter === 'done' && t.status !== 'done') return false;
     if (activeFilter === 'rollover' && t.is_rollover !== 1) return false;
     return true;
  });

  const displayPendingTasks = (activeFilter === 'all' || activeFilter === 'pending') ? filteredTasks.filter((t) => t.status === 'pending' || t.status === 'helping') : [];
  const displaySosTasks = (activeFilter === 'all' || activeFilter === 'sos') ? filteredTasks.filter((t) => t.status === 'sos') : [];
  const displayDoneTasks = (activeFilter === 'all' || activeFilter === 'done') ? filteredTasks.filter((t) => t.status === 'done') : [];
  const displayRolloverTasks = (activeFilter === 'all' || activeFilter === 'rollover') ? filteredTasks.filter((t) => t.is_rollover === 1) : [];
  const statCards: { id: 'pending' | 'sos' | 'done' | 'rollover'; label: string; value: number; icon: React.ReactNode; color: string }[] = [
    { id: 'pending', label: 'Bekleyen', value: pendingTasks.length, icon: <Clock size={16} />, color: 'var(--text-2)' },
    { id: 'sos', label: 'SOS', value: sosTasks.length, icon: <AlertCircle size={16} />, color: 'var(--accent-sos)' },
    { id: 'done', label: 'Tamamlanan', value: doneTasks.length, icon: <CheckCircle size={16} />, color: 'var(--accent-help)' },
    { id: 'rollover', label: 'Taşınan', value: rolloverTasks.length, icon: <span style={{ fontSize: 14 }}>↩</span>, color: 'var(--accent-dim)' },
  ];

  return (
    <div className="personal-dashboard-root">
      {/* Header */}
      <div className="mb-6">
        <h1>
          Merhaba, <span style={{ color: 'var(--accent)' }}>{currentMember?.name || 'Ekip Üyesi'}</span> 👋
        </h1>
        <p className="text-muted mt-2" style={{ fontSize: 13 }}>
          Hafta {selectedWeek} · {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Project Cards Row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, overflowX: 'auto', paddingBottom: 8 }}>
        <div
          className="card"
          onClick={() => setActiveProjectId(null)}
          style={{
            padding: '10px 16px', cursor: 'pointer', flexShrink: 0,
            background: activeProjectId === null ? 'var(--bg-hover)' : 'var(--bg-surface)',
            border: activeProjectId === null ? '1px solid var(--accent)' : '1px solid transparent'
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>Karışık (Tümü)</div>
        </div>
        {projects.map(p => {
           const projectTasks = myTasks.filter(t => t.project_id === p.id);
           if (projectTasks.length === 0) return null;
           return (
              <div
                key={p.id}
                className="card"
                onClick={() => setActiveProjectId(p.id)}
                style={{ 
                  padding: '10px 16px', cursor: 'pointer', minWidth: 120, flexShrink: 0,
                  background: activeProjectId === p.id ? 'var(--bg-hover)' : 'var(--bg-surface)',
                  border: activeProjectId === p.id ? `1px solid ${p.color}` : '1px solid transparent',
                  borderTop: `3px solid ${p.color}`
                }}
              >
                 <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{p.name}</div>
                 <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{projectTasks.length} görev</div>
              </div>
           )
        })}
      </div>

      {/* Stats Row */}
      <div className="stats-grid">
        {statCards.map((stat) => (
          <div
            key={stat.id}
            className="card"
            onClick={() => setActiveFilter(activeFilter === stat.id ? 'all' : stat.id)}
            style={{
              padding: '14px 16px',
              cursor: 'pointer',
              outline: activeFilter === stat.id ? `2px solid ${stat.color}` : 'none',
              outlineOffset: 1,
              background: activeFilter === stat.id ? 'var(--bg-hover)' : 'var(--bg-surface)',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: stat.color, marginBottom: 8 }}>
              {stat.icon}
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{stat.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', color: stat.color, lineHeight: 1 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Tasks View (Full Width Now) */}
        <div>
          {displayRolloverTasks.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <div className="section-header">
                <h2 style={{ fontSize: 13, color: 'var(--accent-dim)' }}>↩ Geçen Haftadan Taşınanlar</h2>
                <span className="status-badge status-pending">{displayRolloverTasks.length} görev</span>
              </div>
              <div className="task-list">
                {displayRolloverTasks.map((t, i) => (
                  <div key={t.id} className="animate-rollover" style={{ animationDelay: `${i * 60}ms` }}>
                    <TaskCard task={t} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {displaySosTasks.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <div className="section-header">
                <h2 style={{ fontSize: 13, color: 'var(--accent-sos)' }}>🆘 SOS — Yardım Bekleniyor</h2>
              </div>
              <div className="task-list">
                {displaySosTasks.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            </section>
          )}

          <section style={{ marginBottom: 24 }}>
            <div className="section-header" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 13 }}>Bu Hafta</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="status-badge status-pending">{displayPendingTasks.length} bekleyen</span>
                <button
                  className="btn btn-primary btn-sm"
                  id="btn-quick-add-task"
                  onClick={() => setShowQuickAdd((v) => !v)}
                  style={{ padding: '3px 10px', fontSize: 12 }}
                >
                  <Plus size={12} />
                  Görev Ekle
                </button>
              </div>
            </div>

            {/* Quick Add Form */}
            {showQuickAdd && <QuickAddTask onClose={() => setShowQuickAdd(false)} />}

            {displayPendingTasks.length === 0 && displayDoneTasks.length === 0 && !showQuickAdd ? (
              <div className="empty-state">
                <div className="empty-icon">🎯</div>
                <p className="text-muted" style={{ fontSize: 13 }}>Henüz görev yok</p>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowQuickAdd(true)}>
                  <Plus size={13} /> Hızlı Görev Ekle
                </button>
              </div>
            ) : (
              <div className="task-list">
                {displayPendingTasks.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            )}
          </section>

          {displayDoneTasks.length > 0 && (
            <section>
              <div className="section-header">
                <h2 style={{ fontSize: 13, color: 'var(--text-3)' }}>✓ Tamamlananlar</h2>
              </div>
              <div className="task-list">
                {displayDoneTasks.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            </section>
          )}
        </div>

        {/* Notes Grid Section */}
        <section style={{ marginTop: 12 }}>
          <div className="section-header" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', fontWeight: 800 }}>
              <BookOpen size={18} /> Notlarım
            </h2>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setActiveNoteId(null);
                setView('notes');
              }}
            >
              Tümüne Git &rarr;
            </button>
          </div>
          
          <div className="responsive-grid">
            {/* New Note Card */}
            <div
              className="card"
              onClick={() => { setActiveNoteId(null); setView('notes'); }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '32px 16px', cursor: 'pointer', border: '2px dashed var(--border)', background: 'transparent',
                color: 'var(--text-3)', transition: 'all 0.2s', minHeight: 140
              }}
            >
              <Plus size={24} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Yeni Not Oluştur</span>
            </div>

            {/* Existing Notes Preview Cards */}
            {notes.map(note => (
              <div
                key={note.id}
                className="card"
                onClick={() => { setActiveNoteId(note.id); setView('notes'); }}
                style={{
                  padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', minHeight: 140,
                  transition: 'all 0.2s', border: '1px solid var(--border-light)'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: 'var(--text-1)' }}>
                  {note.title || 'İsimsiz Not'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', lineHeight: 1.5, flex: 1 }}>
                  {note.content ? note.content.replace(/<[^>]+>/g, ' ') : 'Boş not...'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 12, borderTop: '1px solid var(--border-light)', paddingTop: 8 }}>
                  {new Date(note.updated_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
