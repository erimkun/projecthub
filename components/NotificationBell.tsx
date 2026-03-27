'use client';

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, fetchNotifications, markNotificationsRead, currentMemberId } = useAppStore();

  const unread = notifications.filter((n) => !n.read && n.to_member_id === currentMemberId).length;

  useEffect(() => {
    if (currentMemberId) fetchNotifications(currentMemberId);
    const t = setInterval(() => {
      if (currentMemberId) fetchNotifications(currentMemberId);
    }, 15000);
    return () => clearInterval(t);
  }, [currentMemberId, fetchNotifications]);

  const handleOpen = () => {
    setOpen(!open);
    if (!open && currentMemberId && unread > 0) {
      markNotificationsRead(currentMemberId);
    }
  };

  const typeEmoji: Record<string, string> = {
    sos: '🆘',
    mention: '@',
    help_offered: '🤝',
  };

  const myNotifications = notifications.filter((n) => n.to_member_id === currentMemberId);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn-icon"
        style={{ position: 'relative', padding: 8 }}
        onClick={handleOpen}
        id="btn-notif-bell"
        title="Bildirimler"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" id="notif-dropdown">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>Bildirimler</span>
            <button className="btn-icon" onClick={() => setOpen(false)}><X size={13} /></button>
          </div>
          {myNotifications.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              Bildirim yok
            </div>
          ) : (
            myNotifications.slice(0, 8).map((n) => (
              <div key={n.id} className={`notif-item${!n.read ? ' unread' : ''}`}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span>{typeEmoji[n.type] || '📢'}</span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{n.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {new Date(n.created_at).toLocaleDateString('tr-TR')}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
