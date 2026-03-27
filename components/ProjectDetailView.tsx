'use client';

import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { getWeekMonday } from '@/lib/parser';
import { useAppStore } from '@/lib/store';
import type { Task } from '@/lib/types';

interface WeekBucket {
  week: number;
  year: number;
  total: number;
  done: number;
  tasks: Task[];
}
interface MemberBucket {
  memberId: number;
  name: string;
  total: number;
  done: number;
}
interface ProjectDetail {
  project: { id: number; name: string; color: string };
  weeklyBreakdown: WeekBucket[];
  memberBreakdown: MemberBucket[];
  totalTasks: number;
  doneTasks: number;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 5, background: 'var(--bg-base)', borderRadius: 99, overflow: 'hidden', flex: 1 }}>
      <div style={{
        height: '100%', width: `${Math.round(value * 100)}%`,
        background: color, borderRadius: 99,
        transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
      }} />
    </div>
  );
}

export default function ProjectDetailView({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { fetchProjects, fetchAll } = useAppStore();

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Project detail request failed');
        return r.json();
      })
      .then((d) => {
        setData(d);
      })
      .catch((e) => {
        console.error(e);
        setData(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [projectId]);

  const toggleWeek = (key: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleDeleteProject = () => {
    if (!data?.project) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeleteProject = async () => {
    try {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      await fetchProjects();
      await fetchAll();
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Yükleniyor...</div>
    );
  }
  if (!data || !data.project) return null;

  const { project, weeklyBreakdown, memberBreakdown, totalTasks, doneTasks } = data;
  const progressRatio = totalTasks > 0 ? doneTasks / totalTasks : 0;

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-xl)',
      padding: 28,
      animation: 'slide-up 0.25s cubic-bezier(0.22,1,0.36,1)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: project.color, flexShrink: 0 }} />
        <h2 style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 800 }}>{project.name}</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn-icon" style={{ color: 'var(--accent-sos)' }} onClick={handleDeleteProject} title="Projeyi Sil">
            <Trash2 size={16} />
          </button>
          <button className="btn-icon" style={{ color: 'var(--text-3)' }} onClick={onClose} title="Kapat">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Overall progress */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
        <div className="card-subtle">
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Toplam Görev
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)' }}>{totalTasks}</div>
        </div>
        <div className="card-subtle">
          <div style={{ fontSize: 11, color: 'var(--accent-help)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Tamamlanan
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent-help)' }}>{doneTasks}</div>
        </div>
        <div className="card-subtle">
          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            İlerleme
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
            {Math.round(progressRatio * 100)}%
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <ProgressBar value={progressRatio} color={project.color} />
        <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
          {doneTasks}/{totalTasks} tamamlandı
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>
        {/* Weekly history */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>
            Haftalık Geçmiş
          </div>
          {weeklyBreakdown.length === 0 && (
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Henüz görev kaydı yok</p>
          )}
          {weeklyBreakdown.map((wb) => {
            const key = `${wb.year}-${wb.week}`;
            const monday = getWeekMonday(wb.week, wb.year);
            const mondayStr = monday.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
            const ratio = wb.total > 0 ? wb.done / wb.total : 0;
            const expanded = expandedWeeks.has(key);

            return (
              <div key={key} style={{ marginBottom: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    background: 'var(--bg-elevated)', cursor: 'pointer',
                  }}
                  onClick={() => toggleWeek(key)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Hafta {wb.week}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{mondayStr}&apos;den itibaren</div>
                  </div>
                  <ProgressBar value={ratio} color={project.color} />
                  <span style={{ fontSize: 12, color: ratio === 1 ? 'var(--accent-help)' : 'var(--text-3)', whiteSpace: 'nowrap', minWidth: 44, textAlign: 'right' }}>
                    {wb.done}/{wb.total}
                  </span>
                  {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </div>

                {expanded && (
                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(wb.tasks as Task[])
                      .filter(t => selectedMemberId ? t.assigned_to === selectedMemberId : true)
                      .map((t) => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <span style={{ color: t.status === 'done' ? 'var(--accent-help)' : 'var(--text-3)' }}>
                          {t.status === 'done' ? <CheckCircle size={13} /> : <Clock size={13} />}
                        </span>
                        <span style={{ flex: 1, color: t.status === 'done' ? 'var(--text-3)' : 'var(--text-1)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>
                          {t.title}
                        </span>
                        {t.assigned_name && (
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>@{t.assigned_name}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Member breakdown */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>
            Kişi Bazlı İlerleme
          </div>
          {memberBreakdown.length === 0 && (
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Atanan üye yok</p>
          )}
          {memberBreakdown.map((mb) => {
            const ratio = mb.total > 0 ? mb.done / mb.total : 0;
            const isSelected = selectedMemberId === mb.memberId;
            return (
              <div
                key={mb.memberId}
                onClick={() => setSelectedMemberId(isSelected ? null : mb.memberId)}
                style={{ 
                  marginBottom: 10, 
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                  border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-display)',
                  }}>
                    {mb.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span style={{ fontWeight: 500, fontSize: 13, color: isSelected ? 'var(--text-1)' : 'var(--text-2)' }}>{mb.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
                    {mb.done}/{mb.total}
                  </span>
                </div>
                <ProgressBar value={ratio} color={project.color} />
              </div>
            );
          })}
        </div>
      </div>

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}>
          <div style={{ background: 'var(--bg-surface)', padding: 24, borderRadius: 'var(--radius-lg)', width: 340, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-1)' }}>Projeyi Sil</h3>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5 }}>
              &quot;{project.name}&quot; projesini ve içindeki tüm görevleri kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDeleteConfirm(false)}>İptal</button>
              <button className="btn btn-sm" style={{ background: 'var(--accent-sos)', color: '#fff', border: 'none' }} onClick={() => {
                 setShowDeleteConfirm(false);
                 confirmDeleteProject();
              }}>Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
