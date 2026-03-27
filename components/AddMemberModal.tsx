'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function AddMemberModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const { createMember } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createMember({ name: name.trim() });
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: 16 }}>Ekip Üyesi Ekle</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
              İsim
            </label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ahmet Yılmaz"
              autoFocus
              id="input-member-name"
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>İptal</button>
            <button type="submit" className="btn btn-primary" id="btn-submit-member">Ekle</button>
          </div>
        </form>
      </div>
    </div>
  );
}
