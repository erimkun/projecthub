'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { MemberSummaryCard, MemberTaskPanel } from './MemberCard';
import ManagementInsights from './ManagementInsights';
import type { Member } from '@/lib/types';

type FocusTaskDetail = {
  taskId: number;
  memberId?: number | null;
  weekNumber?: number;
  year?: number;
};

export default function TeamRadar() {
  const { members, tasks, selectedWeek, selectedYear, setSelectedWeekYear } = useAppStore();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [renamingMember, setRenamingMember] = useState<Member | null>(null);
  const [newName, setNewName] = useState('');

  const getTaskCount = (memberId: number) =>
    tasks.filter(
      (t) =>
        t.assigned_to === memberId &&
        t.week_number === selectedWeek &&
        t.year === selectedYear &&
        t.status !== 'done'
    ).length;

  const sorted = [...members].sort((a, b) => {
    const order: Record<string, number> = { sos: 0, helping: 1, available: 2, busy: 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });

  const selectedMember = members.find((m) => m.id === selectedId);
  const selectedIndex = sorted.findIndex((m) => m.id === selectedId);

  const handleCardClick = (id: number) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const sosMember = members.find((m) => m.status === 'sos');

  useEffect(() => {
    const focusTask = (taskId: number) => {
      const taskEl = document.getElementById(`task-${taskId}`);
      if (!taskEl) return;
      taskEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      taskEl.classList.add('focus-flash');
      window.setTimeout(() => taskEl.classList.remove('focus-flash'), 1400);
    };

    const onFocusTask = (event: Event) => {
      const detail = (event as CustomEvent<FocusTaskDetail>).detail;
      if (!detail?.taskId) return;

      if (detail.weekNumber && detail.year) {
        setSelectedWeekYear(detail.weekNumber, detail.year);
      }

      if (detail.memberId) {
        setSelectedId(detail.memberId);
        window.setTimeout(() => focusTask(detail.taskId), 360);
        return;
      }

      window.setTimeout(() => focusTask(detail.taskId), 220);
    };

    window.addEventListener('ph-focus-task', onFocusTask as EventListener);
    return () => window.removeEventListener('ph-focus-task', onFocusTask as EventListener);
  }, [setSelectedWeekYear]);

  return (
    <div>
      <div className="mb-6">
        <h1>Ekip Radarı</h1>
        <p className="text-muted mt-2" style={{ fontSize: 13 }}>
          {members.length} üye · Hafta {selectedWeek} · Bir karta tıkla, görevlerini gör
        </p>
      </div>

      {/* SOS Alert Banner */}
      {sosMember && (
        <div
          style={{
            padding: '14px 20px',
            borderRadius: 'var(--radius-lg)',
            background: 'color-mix(in oklch, var(--accent-sos) 8%, var(--bg-surface))',
            border: '1px solid color-mix(in oklch, var(--accent-sos) 40%, transparent)',
            marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <span style={{ fontSize: 20 }}>🆘</span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-sos)' }}>
              {sosMember.name} yardım bekliyor
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              Kartina tikla ve gorev listesinden &quot;Yardim Et&quot; butonuna bas
            </div>
          </div>
        </div>
      )}

      <ManagementInsights />

      {members.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <p className="text-muted">Henüz ekip üyesi yok</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Sol menuden &quot;Uye Ekle&quot; butonunu kullan</p>
        </div>
      ) : (
        <>
          {/* Compact member grid — no task cards inside */}
          <div className="team-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {sorted.map((member, i) => (
              <MemberSummaryCard
                key={member.id}
                member={member}
                taskCount={getTaskCount(member.id)}
                avatarIndex={i % 6}
                selected={selectedId === member.id}
                onClick={() => handleCardClick(member.id)}
                onContextMenu={(e: React.MouseEvent) => {
                  e.preventDefault();
                  setRenamingMember(member);
                  setNewName(member.name);
                }}
              />
            ))}
          </div>

          {/* Full-width task detail panel — renders below the grid when a member is selected */}
          {selectedMember && (
            <MemberTaskPanel
              member={selectedMember}
              avatarIndex={selectedIndex % 6}
              onClose={() => setSelectedId(null)}
            />
          )}
        </>
      )}

      {renamingMember && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}>
          <div style={{ background: 'var(--bg-surface)', padding: 24, borderRadius: 'var(--radius-lg)', width: 300, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Üye adını düzenle</h3>
            <input 
              autoFocus
              className="input" 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              onKeyDown={async e => {
                 if (e.key === 'Enter') {
                   if (newName.trim() && newName.trim() !== renamingMember.name) {
                     await useAppStore.getState().updateMember(renamingMember.id, { name: newName.trim() });
                   }
                   setRenamingMember(null);
                 }
                 if (e.key === 'Escape') setRenamingMember(null);
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setRenamingMember(null)}>İptal</button>
              <button className="btn btn-primary btn-sm" onClick={async () => {
                 if (newName.trim() && newName.trim() !== renamingMember.name) {
                   await useAppStore.getState().updateMember(renamingMember.id, { name: newName.trim() });
                 }
                 setRenamingMember(null);
              }}>Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
