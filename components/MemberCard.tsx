'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import TaskCard from './TaskCard';
import type { Member } from '@/lib/types';
import { X, Plus, Trash2 } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  available: 'Müsait',
  busy: 'Meşgul',
  sos: 'Yardım Bekliyor',
  helping: 'Yardım Ediyor',
};
const STATUS_EMOJI: Record<string, string> = {
  available: '🟢',
  busy: '🔴',
  sos: '🆘',
  helping: '🤝',
};

function MemberSummaryCard({
  member,
  taskCount,
  avatarIndex,
  selected,
  onClick,
  onContextMenu,
}: {
  member: Member;
  taskCount: number;
  avatarIndex: number;
  selected: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const { updateMemberStatus, currentMemberId } = useAppStore();

  return (
    <div
      className={`member-card status-${member.status}`}
      id={`member-${member.id}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        cursor: 'pointer',
        outline: selected ? '2px solid var(--accent)' : 'none',
        outlineOffset: 2,
      }}
    >
      <div className="flex items-center gap-3">
        <div className={`member-avatar avatar-${avatarIndex}`} style={{ width: 40, height: 40, fontSize: 16, flexShrink: 0 }}>
          {member.name[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="member-name" style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {member.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
            {taskCount} aktif görev
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <span className={`status-badge status-${member.status}`} style={{ fontSize: 10 }}>
          {STATUS_EMOJI[member.status]} {STATUS_LABELS[member.status] || member.status}
        </span>
        {selected && (
           <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.04em' }}>
            SEÇİLİ ↓
          </span>
        )}
      </div>

      {/* Status toggle — restrict to current user */}
      {currentMemberId === member.id && (
        <div
          style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}
          onClick={(e) => e.stopPropagation()}
        >
          {(['available', 'busy'] as Member['status'][]).map((s) => (
            <button
              key={s}
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: 10, padding: '2px 8px',
                ...(member.status === s
                  ? { background: 'var(--bg-hover)', color: 'var(--text-1)', borderColor: 'var(--border-light)' }
                  : { color: 'var(--text-3)' }),
              }}
              onClick={() => updateMemberStatus(member.id, s)}
            >
              {STATUS_EMOJI[s]} {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberTaskPanel({ member, avatarIndex, onClose }: { member: Member; avatarIndex: number; onClose: () => void }) {
  const { tasks, fetchAll, currentMemberId, selectedWeek, selectedYear } = useAppStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const memberTasks = tasks.filter(
    (t) => t.assigned_to === member.id && t.week_number === selectedWeek && t.year === selectedYear
  );
  const pending = memberTasks.filter((t) => t.status === 'pending' || t.status === 'sos' || t.status === 'helping' || t.status === 'blocked');
  const done = memberTasks.filter((t) => t.status === 'done');
  const getVisibleRootTasks = (list: typeof memberTasks) => {
    const idSet = new Set(list.map((task) => task.id));
    return list.filter((task) => !task.parent_task_id || !idSet.has(task.parent_task_id));
  };
  const visiblePending = getVisibleRootTasks(pending);
  const visibleDone = getVisibleRootTasks(done);

  const handleDeleteMember = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteMember = async () => {
    try {
      const res = await fetch(`/api/members/${member.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      await fetchAll();
      onClose();
      // If we deleted ourselves, backend clears session cookie; force redirect.
      if (data.loggedOut || currentMemberId === member.id) {
        window.location.href = '/login';
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      style={{
        marginTop: 20,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-xl)',
        padding: 24,
        animation: 'slide-up 0.25s cubic-bezier(0.22,1,0.36,1)',
      }}
      id="member-task-panel"
    >
      {/* Panel header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div className={`member-avatar avatar-${avatarIndex}`} style={{ width: 44, height: 44, fontSize: 18 }}>
          {member.name[0].toUpperCase()}
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, lineHeight: 1.2 }}>
            {member.name}
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {memberTasks.length} görev · Hafta {selectedWeek}
          </div>
        </div>
        <span className={`status-badge status-${member.status}`} style={{ marginLeft: 8 }}>
          {STATUS_EMOJI[member.status]} {STATUS_LABELS[member.status]}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            className="btn-icon"
            style={{ color: 'var(--accent-sos)' }}
            onClick={handleDeleteMember}
            title="Kullanıcıyı Sil"
          >
            <Trash2 size={16} />
          </button>
          <button
            className="btn-icon"
            style={{ color: 'var(--text-3)' }}
            onClick={onClose}
            title="Kapat"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {memberTasks.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 0' }}>
          <div className="empty-icon">📋</div>
          <p className="text-muted" style={{ fontSize: 14 }}>Bu hafta için görev yok</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Aktif / Bekleyen */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Aktif Görevler · {pending.length}
            </div>
            {pending.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Aktif görev yok</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visiblePending.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            )}
          </div>
          {/* Tamamlanan */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Tamamlananlar · {done.length}
            </div>
            {done.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Henüz tamamlanan yok</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visibleDone.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}>
          <div style={{ background: 'var(--bg-surface)', padding: 24, borderRadius: 'var(--radius-lg)', width: 340, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-1)' }}>Üyeyi Sil</h3>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5 }}>
              {member.name} adlı üyeyi ve sistemdeki kullanıcı hesabını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDeleteConfirm(false)}>İptal</button>
              <button className="btn btn-sm" style={{ background: 'var(--accent-sos)', color: '#fff', border: 'none' }} onClick={() => {
                 setShowDeleteConfirm(false);
                 confirmDeleteMember();
              }}>Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { MemberSummaryCard, MemberTaskPanel };
export type { };
