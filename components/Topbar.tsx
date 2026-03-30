'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import MagicInput from './MagicInput';
import NotificationBell from './NotificationBell';
import { RefreshCw, LogOut, User, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { getWeekNumber, getWeekMonday } from '@/lib/parser';

export default function Topbar() {
  const { view, setView, triggerRollover, setCurrentMemberId, selectedWeek, selectedYear, setSelectedWeekYear } = useAppStore();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const weekPickerRef = useRef<HTMLDivElement>(null);
  const { week: currentWeek, year: currentYear } = getWeekNumber();

  // Load session user on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setUsername(d.user.username);
          if (d.user.memberId) setCurrentMemberId(d.user.memberId);
        }
      });
  }, [setCurrentMemberId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!weekPickerRef.current) return;
      if (!weekPickerRef.current.contains(event.target as Node)) {
        setShowWeekPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const monday = useMemo(() => getWeekMonday(selectedWeek, selectedYear), [selectedWeek, selectedYear]);
  const mondayStr = monday.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

  const weekInputValue = useMemo(
    () => `${selectedYear}-W${String(selectedWeek).padStart(2, '0')}`,
    [selectedWeek, selectedYear]
  );

  const shiftWeek = (delta: number) => {
    let nextWeek = selectedWeek + delta;
    let nextYear = selectedYear;

    const weeksInYear = (year: number) => getWeekNumber(new Date(Date.UTC(year, 11, 28))).week;

    while (nextWeek < 1) {
      nextYear -= 1;
      nextWeek += weeksInYear(nextYear);
    }

    while (nextWeek > weeksInYear(nextYear)) {
      nextWeek -= weeksInYear(nextYear);
      nextYear += 1;
    }

    setSelectedWeekYear(nextWeek, nextYear);
  };

  const handleWeekInputChange = (value: string) => {
    const match = value.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return;
    const parsedYear = Number(match[1]);
    const parsedWeek = Number(match[2]);
    setSelectedWeekYear(parsedWeek, parsedYear);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="topbar">
      {/* Logo + week indicator */}
      <div ref={weekPickerRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setShowWeekPicker((prev) => !prev)}
          style={{ display: 'flex', flexDirection: 'column', gap: 1, whiteSpace: 'nowrap', alignItems: 'flex-start' }}
          title="Hafta seç"
        >
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>
            Project<span style={{ color: 'var(--accent)' }}>Hub</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: 4 }}>
            Hafta {selectedWeek} · <span style={{ color: 'var(--accent-dim)' }}>{mondayStr} baslangici</span>
            <Calendar size={11} />
          </div>
        </button>

        {showWeekPicker && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              zIndex: 120,
              width: 260,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 700 }}>
              Hafta Secimi
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="btn-icon" onClick={() => shiftWeek(-1)} title="Önceki hafta">
                <ChevronLeft size={14} />
              </button>
              <input
                className="input"
                type="week"
                value={weekInputValue}
                onChange={(e) => handleWeekInputChange(e.target.value)}
                style={{ fontSize: 12, padding: '6px 10px', textTransform: 'uppercase' }}
              />
              <button className="btn-icon" onClick={() => shiftWeek(1)} title="Sonraki hafta">
                <ChevronRight size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setSelectedWeekYear(currentWeek, currentYear)}
              >
                Bu Hafta
              </button>
              <button
                className="btn btn-primary btn-sm"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setShowWeekPicker(false)}
              >
                Tamam
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Toggle */}
      <div className="view-toggle" style={{ marginLeft: 8 }}>
        <button
          id="btn-personal-view"
          className={`view-toggle-btn${view === 'personal' ? ' active' : ''}`}
          onClick={() => setView('personal')}
        >
          <span className="hide-mobile">Kişisel Alanım</span>
          <span className="show-mobile">Benim</span>
        </button>
        <button
          id="btn-team-view"
          className={`view-toggle-btn${view === 'team' ? ' active' : ''}`}
          onClick={() => setView('team')}
        >
          <span className="hide-mobile">Ekip Radarı</span>
          <span className="show-mobile">Ekip</span>
        </button>
      </div>

      {/* Magic Input */}
      <MagicInput />

      {/* Actions */}
      <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
        <button
          id="btn-rollover"
          className="btn btn-ghost btn-sm hide-mobile"
          onClick={triggerRollover}
          title="Manuel haftalık devir"
        >
          <RefreshCw size={13} />
          Devir
        </button>
        <NotificationBell />
        {username && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 8, borderLeft: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)' }}>
              <User size={13} />
              {username}
            </div>
            <button
              className="btn-icon"
              onClick={handleLogout}
              title="Çıkış Yap"
              id="btn-logout"
              style={{ color: 'var(--text-3)' }}
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
