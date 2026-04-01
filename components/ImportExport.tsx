'use client';

import { useRef, useState } from 'react';
import { X, Upload, Download, FileSpreadsheet } from 'lucide-react';

type ImportTarget = 'tasks' | 'projects';
type ImportField = 'title' | 'body' | 'project_id' | 'assigned_to' | 'tags' | 'status' | 'week_number' | 'year' | 'parent_task_id' | 'project_name' | 'project_color';

type ImportPreview = {
  target: ImportTarget;
  columns: string[];
  rowCount: number;
  sampleRows: Record<string, unknown>[];
};

type MappingTemplate = {
  id: string;
  name: string;
  target: ImportTarget;
  mapping: Partial<Record<ImportField, string>>;
};

const templateStorageKey = 'ph-import-mapping-templates';

const taskFieldDefs: Array<{ key: ImportField; label: string; required?: boolean }> = [
  { key: 'title', label: 'Görev Başlığı', required: true },
  { key: 'body', label: 'Açıklama' },
  { key: 'project_id', label: 'Proje ID' },
  { key: 'assigned_to', label: 'Kişi ID' },
  { key: 'tags', label: 'Etiketler' },
  { key: 'status', label: 'Durum' },
  { key: 'week_number', label: 'Hafta No' },
  { key: 'year', label: 'Yıl' },
  { key: 'parent_task_id', label: 'Üst Görev ID' },
];

const projectFieldDefs: Array<{ key: ImportField; label: string; required?: boolean }> = [
  { key: 'project_name', label: 'Proje Adı', required: true },
  { key: 'project_color', label: 'Renk (hex)' },
];

const aliasMap: Record<ImportField, string[]> = {
  title: ['başlık', 'baslik', 'title', 'gorev', 'görev'],
  body: ['açıklama', 'aciklama', 'description', 'body', 'detay'],
  project_id: ['proje id', 'project id', 'project_id'],
  assigned_to: ['kişi id', 'kisi id', 'assignee id', 'assigned_to', 'uye id', 'üye id'],
  tags: ['etiketler', 'tags', 'etiket'],
  status: ['durum', 'status'],
  week_number: ['hafta', 'week', 'week_number'],
  year: ['yıl', 'yil', 'year'],
  parent_task_id: ['üst görev id', 'ust gorev id', 'parent task id', 'parent_task_id'],
  project_name: ['proje', 'proje adi', 'proje adı', 'project', 'project name', 'name'],
  project_color: ['renk', 'color', 'project_color'],
};

function normalizeColumn(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function buildAutoMapping(columns: string[]): Partial<Record<ImportField, string>> {
  const normalizedColumns = columns.map((col) => ({ raw: col, normalized: normalizeColumn(col) }));
  const mapping: Partial<Record<ImportField, string>> = {};

  for (const field of [...taskFieldDefs, ...projectFieldDefs]) {
    const aliases = aliasMap[field.key];
    const match = normalizedColumns.find((col) => aliases.includes(col.normalized));
    if (match) mapping[field.key] = match.raw;
  }

  return mapping;
}

export default function ImportExport({ onClose }: { onClose: () => void }) {
  const [importTarget, setImportTarget] = useState<ImportTarget>('tasks');
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, string>>>({});
  const [templates, setTemplates] = useState<MappingTemplate[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(templateStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as MappingTemplate[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const persistTemplates = (nextTemplates: MappingTemplate[]) => {
    setTemplates(nextTemplates);
    window.localStorage.setItem(templateStorageKey, JSON.stringify(nextTemplates));
  };

  const saveTemplate = () => {
    const name = templateName.trim();
    if (!name) {
      setImportResult('❌ Şablon adı girmelisin.');
      return;
    }
    const nextTemplate: MappingTemplate = {
      id: `${Date.now()}`,
      name,
      target: importTarget,
      mapping,
    };
    const nextTemplates = [nextTemplate, ...templates].slice(0, 20);
    persistTemplates(nextTemplates);
    setTemplateName('');
    setImportResult('✅ Eşleme şablonu kaydedildi.');
  };

  const loadTemplate = () => {
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) return;
    setImportTarget(template.target);
    setMapping(template.mapping);
    setImportResult(`✅ ${template.name} şablonu yüklendi.`);
  };

  const deleteTemplate = () => {
    if (!selectedTemplateId) return;
    const nextTemplates = templates.filter((item) => item.id !== selectedTemplateId);
    persistTemplates(nextTemplates);
    setSelectedTemplateId('');
    setImportResult('✅ Şablon silindi.');
  };

  const handleFilePreview = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    setSelectedFile(file);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', 'preview');
    formData.append('target', importTarget);

    const res = await fetch('/api/import', { method: 'POST', body: formData });
    const data = await res.json();
    setImporting(false);

    if (res.ok) {
      const previewData = data as ImportPreview;
      setPreview(previewData);
      setMapping(buildAutoMapping(previewData.columns));
      setImportResult(`${previewData.rowCount} satır bulundu. Eşleme yapıp içe aktarabilirsin.`);
    } else {
      setImportResult(`❌ Hata: ${data.error}`);
    }
  };

  const runMappedImport = async () => {
    if (!selectedFile) return;
    if (importTarget === 'tasks' && !mapping.title) {
      setImportResult('❌ Başlık alanı için bir kolon seçmelisin.');
      return;
    }
    if (importTarget === 'projects' && !mapping.project_name) {
      setImportResult('❌ Proje adı alanı için bir kolon seçmelisin.');
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('mode', 'import');
    formData.append('target', importTarget);
    formData.append('mapping', JSON.stringify(mapping));

    const res = await fetch('/api/import', { method: 'POST', body: formData });
    const data = await res.json();
    setImporting(false);

    if (res.ok) {
      const targetLabel = importTarget === 'tasks' ? 'görev' : 'proje';
      setImportResult(`✅ ${data.imported} ${targetLabel} başarıyla içe aktarıldı`);
      setPreview(null);
      setSelectedFile(null);
      setMapping({});
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

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button
              className={`btn btn-sm ${importTarget === 'tasks' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setImportTarget('tasks');
                setPreview(null);
                setMapping({});
                setImportResult(null);
              }}
              type="button"
            >
              Görev İçe Aktar
            </button>
            <button
              className={`btn btn-sm ${importTarget === 'projects' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setImportTarget('projects');
                setPreview(null);
                setMapping({});
                setImportResult(null);
              }}
              type="button"
            >
              Proje İçe Aktar
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 10 }}>
            <input
              className="input"
              placeholder="Eşleme şablonu adı"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              style={{ fontSize: 12, padding: '6px 8px' }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={saveTemplate}>Şablon Kaydet</button>
            <select
              className="input"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              style={{ fontSize: 12, padding: '6px 8px', minWidth: 140 }}
            >
              <option value="">Şablon Seç</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={loadTemplate} disabled={!selectedTemplateId}>Şablon Yükle</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={deleteTemplate} disabled={!selectedTemplateId}>Şablon Sil</button>
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
              if (file) handleFilePreview(file);
            }}
          >
            <Upload size={24} style={{ color: 'var(--accent)', margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              {importing ? 'Yükleniyor...' : 'Dosyayı buraya sürükle veya tıkla'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
              XLSX veya CSV · {importTarget === 'tasks' ? 'Görev' : 'Proje'} kolonları bu adımda otomatik algılanır
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFilePreview(f); }}
              id="input-file-import"
            />
          </div>

          {preview && (
            <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, background: 'var(--bg-elevated)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, fontWeight: 600 }}>
                Kolon Eşleme ({preview.rowCount} satır)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(importTarget === 'tasks' ? taskFieldDefs : projectFieldDefs).map((field) => (
                  <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {field.label}{field.required ? ' *' : ''}
                    </span>
                    <select
                      className="input"
                      style={{ fontSize: 12, padding: '6px 8px' }}
                      value={mapping[field.key] || ''}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value || undefined }))}
                    >
                      <option value="">Kolon seçme</option>
                      {preview.columns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              {preview.sampleRows.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Önizleme (ilk 3 satır)</div>
                  <div style={{ maxHeight: 140, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr>
                          {preview.columns.map((col) => (
                            <th key={col} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sampleRows.slice(0, 3).map((row, index) => (
                          <tr key={index}>
                            {preview.columns.map((col) => (
                              <td key={col} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-2)' }}>
                                {String(row[col] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn btn-primary" onClick={runMappedImport} disabled={importing}>
                  {importing ? 'İçe Aktarılıyor...' : 'Eşleme ile İçe Aktar'}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setPreview(null);
                    setSelectedFile(null);
                    setMapping({});
                    setImportResult(null);
                  }}
                  disabled={importing}
                >
                  Sıfırla
                </button>
              </div>
            </div>
          )}

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
