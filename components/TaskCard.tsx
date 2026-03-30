'use client';

import { useState } from 'react';
import { Check, AlertTriangle, Heart, Trash2, Copy, Calendar } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { Task } from '@/lib/types';

interface TaskCardProps {
  task: Task;
}

export default function TaskCard({ task }: TaskCardProps) {
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const { updateTask, deleteTask, createTask, currentMemberId, members, selectedWeek, selectedYear } = useAppStore();

  const isDone = task.status === 'done';
  const isSOS = task.status === 'sos';
  const isHelping = task.status === 'helping';

  const closeCtx = () => setCtx(null);
  const isCurrentWeekTask = task.week_number === selectedWeek && task.year === selectedYear;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtx({ x: e.clientX, y: e.clientY });
  };

  const toggleDone = async () => {
    await updateTask(task.id, { status: isDone ? 'pending' : 'done' });
  };

  const triggerSOS = async () => {
    if (!currentMemberId) return;
    const helper = members.find((m) => m.status === 'available' && m.id !== currentMemberId);
    await updateTask(task.id, {
      status: 'sos',
      sos_from: currentMemberId,
      sos_to: helper?.id || currentMemberId,
      task_title: task.title,
    });
    closeCtx();
  };

  const offerHelp = async () => {
    if (!currentMemberId) return;
    await updateTask(task.id, { status: 'helping', helper_id: currentMemberId });
    closeCtx();
  };

  const handleDuplicate = async () => {
    await createTask({
      title: `${task.title} (kopya)`,
      body: task.body,
      project_id: task.project_id,
      assigned_to: task.assigned_to,
      week_number: selectedWeek,
      year: selectedYear,
      tags: task.tags,
    });
    closeCtx();
  };

  const handleMoveNextWeek = async () => {
    let nextWeek = selectedWeek + 1;
    let nextYear = selectedYear;
    if (nextWeek > 52) { nextWeek = 1; nextYear = selectedYear + 1; }
    await updateTask(task.id, {
      week_number: nextWeek,
      year: nextYear,
      source_week_number: task.week_number,
      source_year: task.year,
      is_rollover: 0,
      pulled_into_current_week: 0,
    });
    closeCtx();
  };

  const handlePullToCurrentWeek = async () => {
    if (isCurrentWeekTask) {
      closeCtx();
      return;
    }

    await updateTask(task.id, {
      week_number: selectedWeek,
      year: selectedYear,
      source_week_number: task.source_week_number || task.week_number,
      source_year: task.source_year || task.year,
      is_rollover: 1,
      pulled_into_current_week: 1,
    });
    closeCtx();
  };

  const handleDelete = async () => {
    await deleteTask(task.id);
    closeCtx();
  };

  return (
    <>
      <div
        className={`task-card status-${task.status}${task.is_rollover ? ' is-rollover' : ''}`}
        id={`task-${task.id}`}
        onContextMenu={handleContextMenu}
      >
        <div className="task-week-chip">H{task.week_number} · {task.year}</div>

        {/* Checkbox */}
        <div
          className={`task-checkbox${isDone ? ' checked' : ''}`}
          onClick={toggleDone}
          title={isDone ? 'Geri al' : 'Tamamlandı'}
        >
          {isDone && <Check size={11} color="white" strokeWidth={3} />}
        </div>

        {/* Body */}
        <div className="task-body">
          <div className={`task-title${isDone ? ' done' : ''}`}>{task.title}</div>
          <div className="task-meta">
            {task.project_color && (
              <span className="task-project-dot" style={{ background: task.project_color }} title={task.project_name} />
            )}
            {task.project_name && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{task.project_name}</span>
            )}
            {task.assigned_name && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>@{task.assigned_name}</span>
            )}
            {task.is_rollover === 1 && task.source_week_number && task.source_year && (
              <span className="rollover-badge">↩ Geçen Hafta: H{task.source_week_number}</span>
            )}
            {task.pulled_into_current_week === 1 && (
              <span className="rollover-badge pulled">Bu Haftaya Alındı</span>
            )}
            {isSOS && <span className="status-badge status-sos">SOS</span>}
            {isHelping && task.helper_name && (
              <span className="status-badge status-helping">🤝 {task.helper_name}</span>
            )}
          </div>
        </div>

        {/* Quick actions (inline) */}
        <div className="task-actions">
          {!isDone && !isSOS && task.assigned_to === currentMemberId && (
            <button
              className="btn btn-sos btn-sm"
              style={{ padding: '2px 8px', fontSize: 11 }}
              onClick={triggerSOS}
              title="SOS — Yardım İste"
            >
              <AlertTriangle size={11} /> SOS
            </button>
          )}
          {isSOS && task.assigned_to !== currentMemberId && (
            <button
              className="btn btn-help btn-sm"
              style={{ padding: '2px 8px', fontSize: 11 }}
              onClick={offerHelp}
              title="Yardım Et"
            >
              <Heart size={11} /> Yardım Et
            </button>
          )}
          <span style={{ fontSize: 10, color: 'var(--text-3)', userSelect: 'none' }} title="Sağ tıkla — daha fazla seçenek">
            ···
          </span>
        </div>
      </div>

      {/* Right-click context menu */}
      {ctx && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
            onClick={closeCtx}
            onContextMenu={(e) => { e.preventDefault(); closeCtx(); }}
          />
          <div
            style={{
              position: 'fixed',
              left: Math.min(ctx.x, window.innerWidth - 200),
              top: Math.min(ctx.y, window.innerHeight - 200),
              zIndex: 999,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
              minWidth: 190,
              animation: 'fade-in 0.1s ease',
            }}
          >
            <div style={{ padding: '6px 10px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>
              {task.title.length > 22 ? task.title.slice(0, 22) + '…' : task.title}
            </div>

            <button
              className="btn"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '9px 14px', borderRadius: 0, gap: 10, fontSize: 13 }}
              onClick={toggleDone}
            >
              <Check size={13} /> {isDone ? 'Tamamlandı Kaldır' : 'Tamamlandı İşaretle'}
            </button>

            <button
              className="btn"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '9px 14px', borderRadius: 0, gap: 10, fontSize: 13, color: 'var(--text-2)' }}
              onClick={handleDuplicate}
            >
              <Copy size={13} /> Kopyasını Oluştur
            </button>

            <button
              className="btn"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '9px 14px', borderRadius: 0, gap: 10, fontSize: 13, color: 'var(--text-2)' }}
              onClick={handleMoveNextWeek}
            >
              <Calendar size={13} /> Bir Sonraki Haftaya Taşı
            </button>

            {!isCurrentWeekTask && (
              <button
                className="btn"
                style={{ width: '100%', justifyContent: 'flex-start', padding: '9px 14px', borderRadius: 0, gap: 10, fontSize: 13, color: 'var(--accent)' }}
                onClick={handlePullToCurrentWeek}
              >
                <Calendar size={13} /> Bu Haftaya Çek
              </button>
            )}

            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

            <button
              className="btn"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '9px 14px', borderRadius: 0, gap: 10, fontSize: 13, color: 'var(--accent-sos)' }}
              onClick={handleDelete}
            >
              <Trash2 size={13} /> Sil
            </button>
          </div>
        </>
      )}
    </>
  );
}
