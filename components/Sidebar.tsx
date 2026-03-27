'use client';

import { useState } from 'react';
import {
  LayoutDashboard, Users, FileText, Upload, Plus
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
  const { projects, members, currentMemberId, setCurrentMemberId, view, setView } = useAppStore();

  const navItems = [
    { id: 'dashboard' as SidebarSection, label: 'Dashboard', icon: <LayoutDashboard size={15} />, action: () => { setView('personal'); setActiveSection('dashboard'); setSelectedProjectId(null); } },
    { id: 'team' as SidebarSection, label: 'Ekip Radarı', icon: <Users size={15} />, action: () => { setView('team'); setActiveSection('team'); setSelectedProjectId(null); } },
    { id: 'notes' as SidebarSection, label: 'Notlar', icon: <FileText size={15} />, action: () => { setActiveSection('notes'); setView('notes'); setSelectedProjectId(null); } },
    { id: 'import' as SidebarSection, label: 'İçe/Dışa Aktar', icon: <Upload size={15} />, action: () => setShowImport(true) },
  ];

  const actualActive = view === 'team' ? 'team' : activeSection;

  return (
    <>
      <aside className="sidebar">
        <nav className="sidebar-nav">
          <div className="nav-section-label">Genel</div>
          {navItems.map((item) => (
            <div
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item${actualActive === item.id && !selectedProjectId ? ' active' : ''}`}
              onClick={item.action}
            >
              {item.icon}
              {item.label}
            </div>
          ))}

          <div className="divider" />

          <div className="nav-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 }}>
            Projeler
            <button className="btn-icon" onClick={() => setShowAddProject(true)} title="Proje Ekle" id="btn-add-project">
              <Plus size={12} />
            </button>
          </div>
          {projects.map((p) => (
            <div
              key={p.id}
              className={`nav-item${selectedProjectId === p.id ? ' active' : ''}`}
              onClick={() => {
                setSelectedProjectId(p.id);
                setView('personal');
              }}
              style={{ cursor: 'pointer' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
              <span className="truncate">{p.name}</span>
            </div>
          ))}

          <div className="divider" />

          <div className="nav-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8, marginTop: 16 }}>
            Üyeler
            <button className="btn-icon" onClick={() => setShowAddMember(true)} title="Üye Ekle" id="btn-add-member">
              <Plus size={12} />
            </button>
          </div>
          {members.map((m) => (
            <div
              key={m.id}
              className={`nav-item${activeSection === 'dashboard' && currentMemberId === m.id ? ' active' : ''}`}
              onClick={() => {
                setCurrentMemberId(m.id);
                setView('personal');
                setActiveSection('dashboard');
              }}
              style={{ cursor: 'pointer' }}
            >
              <img src={m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=random`} style={{ width: 16, height: 16, borderRadius: '50%' }} alt="" />
              <span className="truncate">{m.name}</span>
            </div>
          ))}
        </nav>
      </aside>

      {/* Project detail panel — renders in the main area via a portal-like approach */}
      {selectedProjectId && (
        <div
          style={{
            position: 'fixed',
            top: 56,
            left: 240,
            right: 0,
            bottom: 0,
            zIndex: 60,
            background: 'var(--bg-base)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedProjectId(null); }}
        >
          <div style={{ width: '100%', height: '100%', padding: 24, overflowY: 'auto' }}>
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
