'use client';

import { X, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { Task } from '@/lib/types';

interface SOSPanelProps {
  sosTasks: Task[];
}

export default function SOSPanel({ sosTasks }: SOSPanelProps) {
  const { members, currentMemberId, updateTask, updateMemberStatus } = useAppStore();

  // Only show SOS tasks relevant to current user (either assigned to them or they are the helper)
  const relevantTasks = sosTasks.filter(
    (t) => t.assigned_to === currentMemberId || t.helper_id === currentMemberId
  );

  if (relevantTasks.length === 0) return null;

  const task = relevantTasks[0];
  const assignee = members.find((m) => m.id === task.assigned_to);
  const helper = members.find((m) => m.id === task.helper_id);

  const handleOfferHelp = async () => {
    if (!currentMemberId) return;
    await updateTask(task.id, { status: 'helping', helper_id: currentMemberId });
    await updateMemberStatus(currentMemberId, 'helping');
  };

  const handleResolve = async () => {
    await updateTask(task.id, { status: 'done', helper_id: null });
    if (currentMemberId) {
      await updateMemberStatus(currentMemberId, 'available');
    }
  };

  return (
    <div className="sos-panel" id="sos-panel">
      <div className="sos-header">
        <div className="sos-indicator" />
        <h3 style={{ color: 'var(--accent-sos)', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          Aktif SOS Bağlantısı
        </h3>
        <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={handleResolve} title="Çözüldü olarak kapat">
          <X size={14} />
        </button>
      </div>

      <div className="sos-connection">
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'color-mix(in oklch, var(--accent-sos) 20%, var(--bg-elevated))',
              color: 'var(--accent-sos)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontFamily: 'var(--font-display)',
              margin: '0 auto 4px',
            }}
          >
            {assignee?.name[0] || '?'}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600 }}>{assignee?.name || 'Bilinmiyor'}</div>
          <div style={{ fontSize: 10, color: 'var(--accent-sos)' }}>İstiyor</div>
        </div>

        <div className="sos-arrow"><ArrowRight size={16} /></div>

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: helper
                ? 'color-mix(in oklch, var(--accent-help) 20%, var(--bg-elevated))'
                : 'var(--bg-hover)',
              color: helper ? 'var(--accent-help)' : 'var(--text-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontFamily: 'var(--font-display)',
              margin: '0 auto 4px',
              border: helper ? 'none' : '2px dashed var(--border)',
            }}
          >
            {helper ? helper.name[0] : '?'}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600 }}>{helper?.name || 'Bekleniyor...'}</div>
          <div style={{ fontSize: 10, color: helper ? 'var(--accent-help)' : 'var(--text-3)' }}>
            {helper ? 'Yardım Ediyor' : 'Henüz yok'}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.5 }}>
        "{task.title}"
      </div>

      {!helper && task.assigned_to !== currentMemberId && (
        <button className="btn btn-help w-full" id="btn-sos-help" onClick={handleOfferHelp}>
          🤝 Yardım Et
        </button>
      )}
      {(helper || task.assigned_to === currentMemberId) && (
        <button className="btn btn-ghost w-full btn-sm" onClick={handleResolve}>
          ✓ Çözüldü — Kapat
        </button>
      )}
    </div>
  );
}
