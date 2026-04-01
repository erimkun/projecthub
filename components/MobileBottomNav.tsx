'use client';

import { LayoutDashboard, Users, NotebookPen, Menu } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function MobileBottomNav() {
  const { view, setView, setSidebarOpen } = useAppStore();

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobil alt gezinme">
      <div className="mobile-bottom-nav-items">
        <button
          type="button"
          className={`mobile-nav-item${view === 'personal' ? ' active' : ''}`}
          onClick={() => setView('personal')}
          aria-label="Kişisel Alanım"
        >
          <span className="mobile-nav-item-icon">
            <LayoutDashboard size={18} />
          </span>
          <span className="mobile-nav-item-label">Benim</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item${view === 'team' ? ' active' : ''}`}
          onClick={() => setView('team')}
          aria-label="Ekip Radarı"
        >
          <span className="mobile-nav-item-icon">
            <Users size={18} />
          </span>
          <span className="mobile-nav-item-label">Ekip</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item${view === 'notes' ? ' active' : ''}`}
          onClick={() => setView('notes')}
          aria-label="Notlar"
        >
          <span className="mobile-nav-item-icon">
            <NotebookPen size={18} />
          </span>
          <span className="mobile-nav-item-label">Notlar</span>
        </button>

        <button
          type="button"
          className="mobile-nav-item"
          onClick={() => setSidebarOpen(true)}
          aria-label="Menüyü aç"
        >
          <span className="mobile-nav-item-icon">
            <Menu size={18} />
          </span>
          <span className="mobile-nav-item-label">Menü</span>
        </button>
      </div>
    </nav>
  );
}