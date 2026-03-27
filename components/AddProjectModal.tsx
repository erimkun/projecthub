'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '@/lib/store';

const PRESET_COLORS = [
  '#f59e0b', '#6366f1', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
];

export default function AddProjectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#f59e0b');
  const { createProject } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createProject({ name: name.trim(), color });
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: 16 }}>Proje Ekle</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
              Proje Adı
            </label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Backend API"
              autoFocus
              id="input-project-name"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>
              Renk
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                    outline: color === c ? `3px solid ${c}` : '3px solid transparent',
                    outlineOffset: 2,
                    transition: 'outline 0.15s',
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>İptal</button>
            <button type="submit" className="btn btn-primary" id="btn-submit-project">Oluştur</button>
          </div>
        </form>
      </div>
    </div>
  );
}
