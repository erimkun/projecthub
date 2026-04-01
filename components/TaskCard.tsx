'use client';

import { useState, useRef } from 'react';
import { Check, AlertTriangle, Heart, Trash2, Copy, Calendar, MoreHorizontal, Plus } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getWeekNumber } from '@/lib/parser';
import type { Task } from '@/lib/types';

interface TaskCardProps {
  task: Task;
  depth?: number;
  ancestorIds?: number[];
}

export default function TaskCard({ task, depth = 0, ancestorIds = [] }: TaskCardProps) {
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const { tasks, updateTask, deleteTask, createTask, currentMemberId, members, selectedWeek, selectedYear } = useAppStore();

  const isDone = task.status === 'done';
  const isSOS = task.status === 'sos';
  const isHelping = task.status === 'helping';
  const isBlocked = task.status === 'blocked';

  const closeCtx = () => setCtx(null);
  const isCurrentWeekTask = task.week_number === selectedWeek && task.year === selectedYear;
  const childTasks = tasks
    .filter((candidate) => candidate.parent_task_id === task.id && !ancestorIds.includes(candidate.id))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const createdLabel = (() => {
    const date = new Date(task.created_at);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  })();

  const continuityLabel = (() => {
    if (!task.source_week_number || !task.source_year) return null;
    return `H${task.source_week_number}/${task.source_year} haftasından beri`;
  })();

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtx({ x: e.clientX, y: e.clientY });
  };

  const toggleDone = async () => {
    if (!isDone) {
      setIsCompleting(true);
      cardRef.current?.classList.add('complete-animation');
      setTimeout(() => {
        cardRef.current?.classList.remove('complete-animation');
        setIsCompleting(false);
      }, 400);
    }
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
    let nextWeek = task.week_number + 1;
    let nextYear = task.year;
    const weeksInYear = (year: number) => getWeekNumber(new Date(Date.UTC(year, 11, 28))).week;
    if (nextWeek > weeksInYear(nextYear)) {
      nextWeek = 1;
      nextYear += 1;
    }
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

  const handleToggleBlocked = async () => {
    if (isBlocked) {
      await updateTask(task.id, { status: 'pending', blocked_reason: null });
      closeCtx();
      return;
    }
    setBlockReason(task.blocked_reason || '');
    setShowBlockModal(true);
    closeCtx();
  };

  const submitBlockedReason = async () => {
    await updateTask(task.id, { status: 'blocked', blocked_reason: blockReason.trim() || 'Belirtilmedi' });
    setShowBlockModal(false);
    setBlockReason('');
  };

  const handleCreateSubtask = async () => {
    const title = subtaskTitle.trim();
    if (!title) return;

    await createTask({
      title,
      body: '',
      status: 'pending',
      parent_task_id: task.id,
      project_id: task.project_id,
      assigned_to: task.assigned_to,
      week_number: task.week_number,
      year: task.year,
      tags: task.tags,
    });
    setSubtaskTitle('');
    setShowSubtaskInput(false);
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
        ref={cardRef}
        className={`task-card status-${task.status}${task.is_rollover ? ' is-rollover' : ''} ${isCompleting ? ' complete-animation' : ''}`}
        id={`task-${task.id}`}
        onContextMenu={handleContextMenu}
        style={depth > 0 ? { marginLeft: Math.min(depth, 5) * 18 } : undefined}
      >
        {depth === 0 && <div className="task-week-chip">H{task.week_number} · {task.year}</div>}

        {/* Quick Actions Hover Overlay */}
        <div className="quick-actions">
          {!isDone && task.assigned_to === currentMemberId && (
            <button
              className="sos"
              onClick={(e) => { e.stopPropagation(); triggerSOS(); }}
              title="SOS — Yardım İste"
            >
              <AlertTriangle size={14} />
            </button>
          )}
          {isSOS && task.assigned_to !== currentMemberId && (
            <button
              className="help"
              onClick={(e) => { e.stopPropagation(); offerHelp(); }}
              title="Yardım Et"
            >
              <Heart size={14} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleDuplicate(); }}
            title="Kopyasını Oluştur"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleDone(); }}
            title={isDone ? 'Geri al' : 'Tamamlandı'}
            style={{ color: isDone ? 'var(--accent-help)' : 'inherit' }}
          >
            <Check size={14} />
          </button>
          <button
            className="delete"
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            title="Sil"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleContextMenu(e); }}
            title="Daha fazla"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>

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
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Oluşturma: {createdLabel}</span>
            {task.is_rollover === 1 && task.source_week_number && task.source_year && (
              <span className="rollover-badge">↩ Bu haftaya taşındı</span>
            )}
            {continuityLabel && (
              <span className="status-badge status-pending">{continuityLabel}</span>
            )}
            {task.pulled_into_current_week === 1 && (
              <span className="rollover-badge pulled">Bu Haftaya Alındı</span>
            )}
            {isSOS && <span className="status-badge status-sos">SOS</span>}
            {isBlocked && <span className="status-badge status-blocked">Bloke</span>}
            {isHelping && task.helper_name && (
              <span className="status-badge status-helping">🤝 {task.helper_name}</span>
            )}
            {isBlocked && task.blocked_reason && (
              <span style={{ fontSize: 11, color: 'var(--accent-sos)' }}>Neden: {task.blocked_reason}</span>
            )}
          </div>
        </div>

        {/* Quick actions (inline - visible always for SOS/help) */}
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

            <button
              className="btn"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '9px 14px', borderRadius: 0, gap: 10, fontSize: 13, color: isBlocked ? 'var(--accent-help)' : 'var(--accent-sos)' }}
              onClick={handleToggleBlocked}
            >
              <AlertTriangle size={13} /> {isBlocked ? 'Blokeyi Kaldır' : 'Bloke Olarak İşaretle'}
            </button>

            <button
              className="btn"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '9px 14px', borderRadius: 0, gap: 10, fontSize: 13, color: 'var(--text-2)' }}
              onClick={() => {
                setShowSubtaskInput(true);
                closeCtx();
              }}
            >
              <Plus size={13} /> Alt Görev Ekle
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

      {showSubtaskInput && (
        <div
          style={{
            marginTop: 8,
            marginLeft: Math.min(depth + 1, 5) * 18,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <input
            className="input"
            autoFocus
            value={subtaskTitle}
            placeholder="Alt görev başlığı..."
            onChange={(e) => setSubtaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSubtask();
              if (e.key === 'Escape') {
                setShowSubtaskInput(false);
                setSubtaskTitle('');
              }
            }}
            style={{ fontSize: 13, padding: '6px 10px' }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleCreateSubtask}>Ekle</button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setShowSubtaskInput(false);
              setSubtaskTitle('');
            }}
          >
            Vazgeç
          </button>
        </div>
      )}

      {childTasks.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {childTasks.map((childTask) => (
            <TaskCard
              key={childTask.id}
              task={childTask}
              depth={depth + 1}
              ancestorIds={[...ancestorIds, task.id]}
            />
          ))}
        </div>
      )}

      {showBlockModal && (
        <div className="overlay" onClick={() => setShowBlockModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 16 }}>Görevi Bloke Olarak İşaretle</h2>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
              Bloke sebebini yaz. Bu bilgi görev kartında görünür ve ekip tarafından takip edilir.
            </p>
            <textarea
              className="input"
              autoFocus
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Örn: API erişimi bekleniyor / dış bağımlılık tamamlanmadı"
              style={{ minHeight: 96 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button className="btn btn-ghost" onClick={() => setShowBlockModal(false)}>İptal</button>
              <button className="btn btn-primary" onClick={submitBlockedReason}>Blokeye Al</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
