'use client';

import { useState, useRef } from 'react';
import { X, Upload, Download, FileSpreadsheet } from 'lucide-react';

export default function ImportExport({ onClose }: { onClose: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/import', { method: 'POST', body: formData });
    const data = await res.json();
    setImporting(false);
    if (res.ok) {
      setImportResult(`✅ ${data.imported} görev başarıyla içe aktarıldı`);
    } else {
      setImportResult(`❌ Hata: ${data.error}`);
    }
  };

  const handleExport = () => {
    window.open('/api/import', '_blank');
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileSpreadsheet size={18} style={{ color: 'var(--accent)' }} />
            Excel İçe / Dışa Aktar
          </h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Import */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>
            XLSX / CSV İçe Aktar
          </div>
          <div
            className={`drop-zone${dragging ? ' drag-over' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <Upload size={24} style={{ color: 'var(--accent)', margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              {importing ? 'Yükleniyor...' : 'Dosyayı buraya sürükle veya tıkla'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>XLSX veya CSV · Başlık sütunu: Başlık, Açıklama, Proje ID, Kişi ID, Etiketler</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              id="input-file-import"
            />
          </div>
          {importResult && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
              {importResult}
            </div>
          )}
        </div>

        <div className="divider" />

        {/* Export */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>
            Görevleri Dışa Aktar
          </div>
          <button className="btn btn-ghost w-full" onClick={handleExport} id="btn-export-xlsx">
            <Download size={14} />
            Tüm Görevleri XLSX Olarak İndir
          </button>
        </div>
      </div>
    </div>
  );
}
