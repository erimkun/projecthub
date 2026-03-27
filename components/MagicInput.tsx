'use client';

import { useState, useRef, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { parseMagicInput } from '@/lib/parser';
import { useAppStore } from '@/lib/store';

export default function MagicInput() {
  const [value, setValue] = useState('');
  const [showAuto, setShowAuto] = useState(false);
  const [autoType, setAutoType] = useState<'mention' | 'tag' | null>(null);
  const [autoQuery, setAutoQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { members, projects, createTask, currentMemberId, fetchTasks } = useAppStore();

  // Detect @ or # typed
  useEffect(() => {
    const lastAt = value.lastIndexOf('@');
    const lastHash = value.lastIndexOf('#');
    const pos = Math.max(lastAt, lastHash);
    if (pos === -1 || value[pos - 1] === ' ' || pos === 0 || value[pos - 1] === undefined) {
      const afterAt = lastAt >= 0 ? value.slice(lastAt + 1) : '';
      const afterHash = lastHash >= 0 ? value.slice(lastHash + 1) : '';
      if (lastAt > lastHash && !afterAt.includes(' ')) {
        setAutoType('mention'); setAutoQuery(afterAt); setShowAuto(true);
      } else if (lastHash > lastAt && !afterHash.includes(' ')) {
        setAutoType('tag'); setAutoQuery(afterHash); setShowAuto(true);
      } else {
        setShowAuto(false);
      }
    } else {
      setShowAuto(false);
    }
  }, [value]);

  const handleSelect = (item: string) => {
    if (autoType === 'mention') {
      const lastAt = value.lastIndexOf('@');
      setValue(value.slice(0, lastAt + 1) + item + ' ');
    } else {
      const lastHash = value.lastIndexOf('#');
      setValue(value.slice(0, lastHash + 1) + item + ' ');
    }
    setShowAuto(false);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    const parsed = parseMagicInput(value);
    if (!parsed.text) return;

    // Find matching member for first @mention
    const mentionedMember = parsed.mentions[0]
      ? members.find((m) => m.name.toLowerCase().includes(parsed.mentions[0]))
      : null;

    // Find matching project for first #tag
    const taggedProject = parsed.tags[0]
      ? projects.find((p) => p.name.toLowerCase().includes(parsed.tags[0]))
      : null;

    await createTask({
      title: parsed.text,
      assigned_to: mentionedMember?.id || currentMemberId || undefined,
      project_id: taggedProject?.id || undefined,
      tags: parsed.tags.join(','),
    });

    setValue('');
    setShowAuto(false);
    fetchTasks();
  };

  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().startsWith(autoQuery.toLowerCase())
  );
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().startsWith(autoQuery.toLowerCase())
  );

  // Colorize @mentions and #tags in preview
  const renderInputPreview = (text: string) =>
    text.split(/(@\w+|#\w+)/g).map((part, i) =>
      part.startsWith('@') ? <span key={i} className="mention">{part}</span> :
      part.startsWith('#') ? <span key={i} className="hashtag">{part}</span> :
      part
    );

  return (
    <form onSubmit={handleSubmit} className="magic-input-wrap" style={{ flex: 1 }}>
      <Zap size={14} className="magic-input-icon" />
      <input
        ref={inputRef}
        className="magic-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') setShowAuto(false); }}
        placeholder="@kişi #proje görevi yaz ve Enter'a bas..."
        autoComplete="off"
        spellCheck={false}
        id="magic-input"
      />
      {showAuto && (
        <div className="magic-autocomplete" role="listbox">
          {autoType === 'mention' && filteredMembers.length > 0 && (
            <>
              <div className="magic-autocomplete-section">Ekip Üyeleri</div>
              {filteredMembers.map((m) => (
                <div key={m.id} className="magic-autocomplete-item" onClick={() => handleSelect(m.name)} role="option">
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-hover)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                    {m.name[0]}
                  </span>
                  {m.name}
                </div>
              ))}
            </>
          )}
          {autoType === 'tag' && filteredProjects.length > 0 && (
            <>
              <div className="magic-autocomplete-section">Projeler</div>
              {filteredProjects.map((p) => (
                <div key={p.id} className="magic-autocomplete-item" onClick={() => handleSelect(p.name)} role="option">
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
                  {p.name}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </form>
  );
}
