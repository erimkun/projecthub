'use client';

import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, FileText, Upload, Plus, X
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import AddMemberModal from './AddMemberModal';
import AddProjectModal from './AddProjectModal';
import ImportExport from './ImportExport';
import ProjectDetailView from './ProjectDetailView';

type SidebarSection = 'dashboard' | 'team' | 'notes' | 'import';

export default function Sidebar() {
  const [activeSection, setActiveSection] = useState<SidebarSection>('dashboard');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const { projects, members, currentMemberId, setCurrentMemberId, view, setView, isSidebarOpen, setSidebarOpen } = useAppStore();

  useEffect(() => {
    if (isSidebarOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
    return () => {
      document.body.classList.remove('sidebar-open');
    };
  }, [isSidebarOpen]);

  const handleNavClick = (action: () => void) => {
    action();
    setSidebarOpen(false);
  };

  const navItems = [
    { id: 'dashboard' as SidebarSection, label: 'Dashboard', icon: <LayoutDashboard size={15} />, action: () => { setView('personal'); setActiveSection('dashboard'); setSelectedProjectId(null); } },
    { id: 'team' as SidebarSection, label: 'Ekip Radarı', icon: <Users size={15} />, action: () => { setView('team'); setActiveSection('team'); setSelectedProjectId(null); } },
    { id: 'notes' as SidebarSection, label: 'Notlar', icon: <FileText size={15} />, action: () => { setActiveSection('notes'); setView('notes'); setSelectedProjectId(null); } },
    { id: 'import' as SidebarSection, label: 'İçe/Dışa Aktar', icon: <Upload size={15} />, action: () => setShowImport(true) },
  ];

  const actualActive = view === 'team' ? 'team' : activeSection;

  return (
    <>
      <div 
        className={`sidebar-backdrop ${isSidebarOpen ? 'visible' : ''}`} 
        onClick={() => setSidebarOpen(false)} 
      />
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <nav className="sidebar-nav">
          <div className="sidebar-mobile-header">
            <button className="btn-icon" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="nav-section-label">Genel</div>
          {navItems.map((item) => (
            <button
              type="button"
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item${actualActive === item.id && !selectedProjectId ? ' active' : ''}`}
              onClick={() => handleNavClick(item.action)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}

          <div className="divider" />

          <div className="nav-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 }}>
            Projeler
            <button className="btn-icon" onClick={() => setShowAddProject(true)} title="Proje Ekle" id="btn-add-project">
              <Plus size={12} />
            </button>
          </div>
          <div>
            {projects.map((p) => (
              <button
                type="button"
                key={p.id}
                className={`nav-item${selectedProjectId === p.id ? ' active' : ''}`}
                onClick={() => {
                  setSelectedProjectId(p.id);
                  setView('personal');
                  setSidebarOpen(false);
                }}
                style={{ cursor: 'pointer' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>

          <div className="divider" />

          <div className="nav-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8, marginTop: 16 }}>
            Üyeler
            <button className="btn-icon" onClick={() => setShowAddMember(true)} title="Üye Ekle" id="btn-add-member">
              <Plus size={12} />
            </button>
          </div>
          <div>
            {members.map((m) => (
              <button
                type="button"
                key={m.id}
                className={`nav-item${activeSection === 'dashboard' && currentMemberId === m.id ? ' active' : ''}`}
                onClick={() => {
                  setCurrentMemberId(m.id);
                  setView('personal');
                  setActiveSection('dashboard');
                  setSidebarOpen(false);
                }}
                style={{ cursor: 'pointer' }}
              >
                <img src={m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=random`} style={{ width: 16, height: 16, borderRadius: '50%' }} alt="" />
                <span className="truncate">{m.name}</span>
              </button>
            ))}
          </div>
        </nav>
      </aside>

      {/* Project detail panel — renders in the main area via a portal-like approach */}
      {selectedProjectId && (
        <div
          className="project-detail-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedProjectId(null); }}
        >
          <div className="project-detail-container">
            <ProjectDetailView key={selectedProjectId} projectId={selectedProjectId} onClose={() => setSelectedProjectId(null)} />
          </div>
        </div>
      )}

      {showAddMember && <AddMemberModal onClose={() => setShowAddMember(false)} />}
      {showAddProject && <AddProjectModal onClose={() => setShowAddProject(false)} />}
      {showImport && <ImportExport onClose={() => setShowImport(false)} />}
    </>
  );
}
