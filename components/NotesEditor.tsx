'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, FileText, ArrowRight, Trash2, Bold, Italic, List, AlignLeft, CheckCircle, Image as ImageIcon, Table, PenTool } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import DrawingModal from './DrawingModal';

export default function NotesEditor() {
  const { notes, createNote, updateNote, deleteNote, convertNoteLineToTask, projects, members, currentMemberId, activeNoteId, setActiveNoteId } = useAppStore();
  
  const [convertingLine, setConvertingLine] = useState<string | null>(null);
  const [convertData, setConvertData] = useState<{ projectId: number | null; memberIds: number[] }>({ projectId: null, memberIds: [] });
  const [view, setView] = useState<'preview' | 'edit'>('edit');
  const [showDrawing, setShowDrawing] = useState(false);

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];
  const editorRef = useRef<HTMLDivElement>(null);

  // Initialize or update editor content exactly once per note change to avoid losing cursor
  useEffect(() => {
    if (editorRef.current && activeNote) {
      if (editorRef.current.innerHTML !== activeNote.content) {
        editorRef.current.innerHTML = activeNote.content || '<p><br></p>';
      }
    }
  }, [activeNote?.id, view]);

  const handleCreateNote = async () => {
    const note = await createNote({ title: `Not ${notes.length + 1}`, content: '' });
    if (note) setActiveNoteId(note.id);
  };

  const saveContent = useCallback(() => {
    if (!editorRef.current || !activeNote) return;
    updateNote(activeNote.id, { content: editorRef.current.innerHTML });
  }, [activeNote, updateNote]);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    saveContent();
  };

  const insertImage = () => {
    const url = window.prompt('Resim URL adresini girin:');
    if (url) {
      execCommand('insertImage', url);
    }
  };

  const insertTable = () => {
    const html = `<table style="width:100%; border-collapse:collapse; margin:16px 0; border: 1px solid var(--border)">
      <tr><td style="border:1px solid var(--border); padding:8px">Hücre</td><td style="border:1px solid var(--border); padding:8px">Hücre</td></tr>
      <tr><td style="border:1px solid var(--border); padding:8px">Hücre</td><td style="border:1px solid var(--border); padding:8px">Hücre</td></tr>
    </table><p><br></p>`;
    execCommand('insertHTML', html);
  };

  const handleSaveDrawing = (base64: string) => {
    // Replaced insertImage with insertHTML for better base64 compatibility in contentEditable
    const html = `<img src="${base64}" alt="Çizim" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--border);" /><br/>`;
    execCommand('insertHTML', html);
    setShowDrawing(false);
  };

  const handleConfirmConvert = async (lineHtml: string) => {
    if (!activeNote) return;
    // Strip HTML from line to get pure text title
    const temp = document.createElement('div');
    temp.innerHTML = lineHtml;
    const title = temp.innerText.replace(/^[-*•]\s*/, '').trim();
    if (!title) return;

    await convertNoteLineToTask(activeNote.id, {
      title,
      project_id: convertData.projectId || undefined,
      assigned_tos: convertData.memberIds.length > 0 ? convertData.memberIds : undefined,
    });
    setConvertingLine(null);
    
    // Add visual feedback to the note itself by appending a checkmark
    const newContent = activeNote.content.replace(lineHtml, lineHtml + ' ✅');
    updateNote(activeNote.id, { content: newContent });
  };

  // Extract block elements (div, p, li) or fallback to split by <br> for the preview mode
  const getParsedLines = () => {
    if (!activeNote?.content) return [];
    const temp = document.createElement('div');
    temp.innerHTML = activeNote.content;
    const items: { html: string; text: string }[] = [];
    
    // Very simple block extraction
    Array.from(temp.childNodes).forEach(node => {
      // If text node without wrapper, or div/p
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        items.push({ html: node.textContent, text: node.textContent.trim() });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName === 'IMG' || el.tagName === 'TABLE') {
            // Keep as read-only blocks, no task conversion needed typically but display them
            items.push({ html: el.outerHTML, text: '' });
        } else {
            const inner = el.innerHTML.trim();
            if (inner && inner !== '<br>') {
              items.push({ html: el.innerHTML, text: el.innerText.trim() });
            }
        }
      }
    });
    return items;
  };

  const parsedLines = getParsedLines();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
      <style>{`
        .prose img { max-width: 100%; border-radius: 8px; margin: 16px 0; border: 1px solid var(--border); }
        .prose table { width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid var(--border); }
        .prose td, .prose th { border: 1px solid var(--border); padding: 8px; }
        .prose ul { padding-left: 20px; list-style-type: disc; margin: 8px 0; }
        .prose li { margin-bottom: 4px; }
        .prose p { margin-bottom: 8px; margin-top: 0; }
        .prose:empty:before { content: attr(data-placeholder); color: var(--text-3); font-style: italic; }
      `}</style>
      
      {/* Note Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {notes.map((n) => (
          <button
            key={n.id}
            className="btn btn-ghost btn-sm"
            style={{
              fontSize: 12, padding: '4px 12px',
              ...(activeNote?.id === n.id
                ? { background: 'var(--accent)', color: 'oklch(10% 0 0)', border: 'none' }
                : {}),
            }}
            onClick={() => setActiveNoteId(n.id)}
          >
            <FileText size={12} />
            {n.title || 'İsimsiz'}
          </button>
        ))}
        <button className="btn-icon" onClick={handleCreateNote} title="Yeni Not" style={{ color: 'var(--accent)' }}>
          <Plus size={16} />
        </button>
      </div>

      {/* Editor Main Area */}
      {activeNote ? (
        <div className="notes-editor" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
          {/* Toolbar */}
          <div className="notes-toolbar" style={{ gap: 8, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
            <input
              className="input"
              style={{
                border: 'none', background: 'none', padding: '0',
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, flex: 1
              }}
              value={activeNote.title}
              onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
              placeholder="Not Başlığı"
            />

            <button
              className="btn btn-sm"
              style={{
                background: view === 'edit' ? 'var(--accent)' : 'var(--bg-hover)',
                color: view === 'edit' ? 'oklch(10% 0 0)' : 'var(--text-1)',
                fontWeight: 700, fontSize: 11, padding: '4px 12px', border: 'none',
                display: 'flex', alignItems: 'center', gap: 6
              }}
              onClick={() => setView(view === 'edit' ? 'preview' : 'edit')}
            >
              {view === 'edit' ? <><CheckCircle size={14} /> Görevlere Çevir</> : <><AlignLeft size={14} /> Düzenle</>}
            </button>

            {view === 'edit' && (
              <div style={{ display: 'flex', gap: 2, borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>
                <button className="btn-icon" title="Kalın" onClick={() => execCommand('bold')}><Bold size={14} /></button>
                <button className="btn-icon" title="İtalik" onClick={() => execCommand('italic')}><Italic size={14} /></button>
                <button className="btn-icon" title="Liste" onClick={() => execCommand('insertUnorderedList')}><List size={14} /></button>
                <span style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
                <button className="btn-icon" title="Resim Ekle" onClick={insertImage}><ImageIcon size={14} /></button>
                <button className="btn-icon" title="Tablo Ekle" onClick={insertTable}><Table size={14} /></button>
                <button className="btn-icon" style={{ color: '#0ea5e9' }} title="Çizim Yap" onClick={() => setShowDrawing(true)}><PenTool size={14} /></button>
              </div>
            )}

            <button
              className="btn-icon"
              style={{ color: 'var(--accent-sos)', marginLeft: 'auto' }}
              onClick={() => deleteNote(activeNote.id)}
              title="Notu Sil"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Content Area */}
          <div style={{ flex: 1, position: 'relative', overflowY: 'auto' }}>
            {view === 'preview' ? (
              <div className="notes-lines prose" style={{ padding: '16px 24px' }}>
                {parsedLines.length === 0 ? (
                  <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Görünüşe göre notlar boş...</p>
                ) : (
                  parsedLines.map((line, i) => (
                    <div key={i} className="note-line" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', marginBottom: 8, border: '1px solid var(--border-light)' }}>
                      <div className="note-line-text" style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: line.html }} />
                      
                      {line.text && (
                        convertingLine === line.html ? (
                          <div className="note-convert-form" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginLeft: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Projeye Ekle:</div>
                            <select className="input" style={{ fontSize: 12, padding: '6px 10px', maxWidth: 200 }} value={convertData.projectId || ''} onChange={(e) => setConvertData({ ...convertData, projectId: e.target.value ? Number(e.target.value) : null })}>
                              <option value="">Proje Seç</option>
                              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginTop: 4 }}>Kişi Seç (Birden fazla seçilebilir):</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {members.map(m => {
                                 const isSelected = convertData.memberIds.includes(m.id);
                                 return (
                                   <button 
                                     key={m.id}
                                     onClick={() => {
                                       setConvertData(prev => {
                                          const ids = prev.memberIds;
                                          if (ids.includes(m.id)) return { ...prev, memberIds: ids.filter(i => i !== m.id) };
                                          return { ...prev, memberIds: [...ids, m.id] };
                                       });
                                     }}
                                     style={{ 
                                       display: 'flex', alignItems: 'center', gap: 6, 
                                       padding: '6px 12px', borderRadius: 20, 
                                       background: isSelected ? 'var(--accent)' : 'var(--bg-hover)',
                                       color: isSelected ? 'oklch(10% 0 0)' : 'var(--text-1)',
                                       border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                                       transition: 'all 0.2s'
                                     }}
                                   >
                                      <img src={m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=random`} style={{width: 18, height: 18, borderRadius: '50%'}} alt={m.name} />
                                      {m.name}
                                   </button>
                                 )
                              })}
                            </div>
                            
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                              <button className="btn btn-primary btn-sm" style={{ fontSize: 12, padding: '6px 16px' }} onClick={() => handleConfirmConvert(line.html)}>Oluştur</button>
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, padding: '6px 16px' }} onClick={() => setConvertingLine(null)}>İptal</button>
                            </div>
                          </div>
                        ) : (
                          <div className="note-line-actions" style={{ marginLeft: 16 }}>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-2)', padding: '4px 10px', fontSize: 11 }} onClick={() => { setConvertingLine(line.html); setConvertData({ projectId: null, memberIds: currentMemberId ? [currentMemberId] : [] }); }}>
                              <ArrowRight size={12} style={{ marginRight: 4 }} /> Görev Yap
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div
                ref={editorRef}
                contentEditable
                className="prose"
                onInput={saveContent}
                data-placeholder="Notlarını buraya yaz... Resim, çizim veya tablo ekleyebilirsin!"
                style={{
                  minHeight: 'calc(100vh - 220px)',
                  padding: '24px 32px', fontSize: 15, lineHeight: 1.8,
                  fontFamily: 'var(--font-body)', outline: 'none', color: 'var(--text-1)'
                }}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state" style={{ padding: 60 }}>
          <div className="empty-icon">📝</div>
          <p className="text-muted" style={{ fontSize: 15 }}>Henüz not yok</p>
          <button className="btn btn-ghost" onClick={handleCreateNote}>
            <Plus size={16} /> İlk Notu Oluştur
          </button>
        </div>
      )}

      {showDrawing && <DrawingModal onClose={() => setShowDrawing(false)} onSave={handleSaveDrawing} />}
    </div>
  );
}
