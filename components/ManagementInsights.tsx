'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, TrendingUp, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppStore } from '@/lib/store';

type DashboardResponse = {
  filters?: {
    memberId: number | null;
    projectId: number | null;
    weekRange: number | null;
    startWeek: number | null;
    startYear: number | null;
    endWeek: number | null;
    endYear: number | null;
  };
  taskMetrics: {
    total: number;
    completed: number;
    pending: number;
    blocked: number;
    sos: number;
    helping: number;
    completionRate: number;
  };
  weeklyTrend: Array<{
    week: number;
    year: number;
    created: number;
    completed: number;
    pending: number;
    blocked: number;
    rolloverCount: number;
    completionRate: number;
  }>;
  topProjects: Array<{
    projectId: number;
    name: string;
    color: string;
    total: number;
    completed: number;
    completionRate: number;
  }>;
  memberWorkload: Array<{
    memberId: number;
    name: string;
    total: number;
    completed: number;
    pending: number;
    blocked: number;
    sos: number;
    completionRate: number;
  }>;
  scopedTasks: Array<{
    id: number;
    title: string;
    status: 'pending' | 'done' | 'sos' | 'helping' | 'blocked';
    week_number: number;
    year: number;
    project_id: number | null;
    project_name: string | null;
    assigned_to: number | null;
    assigned_name: string | null;
    is_rollover: number;
  }>;
};

const weekRanges = [4, 8, 12] as const;

function weekInputToParts(value: string): { week: number; year: number } | null {
  const match = value.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), week: Number(match[2]) };
}

export default function ManagementInsights() {
  const { members, projects } = useAppStore();
  const [weekRange, setWeekRange] = useState<(typeof weekRanges)[number]>(8);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [startWeekInput, setStartWeekInput] = useState('');
  const [endWeekInput, setEndWeekInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        const effectiveWeekRange = compareMode ? Math.max(weekRange, 16) : weekRange;
        params.set('weekRange', String(effectiveWeekRange));
        if (selectedMemberId) params.set('memberId', String(selectedMemberId));
        if (selectedProjectId) params.set('projectId', String(selectedProjectId));

        const startParts = weekInputToParts(startWeekInput);
        const endParts = weekInputToParts(endWeekInput);
        if (startParts && endParts) {
          params.set('startWeek', String(startParts.week));
          params.set('startYear', String(startParts.year));
          params.set('endWeek', String(endParts.week));
          params.set('endYear', String(endParts.year));
        }

        const res = await fetch(`/api/analytics/dashboard?${params.toString()}`);
        if (!res.ok) throw new Error('Analitik verisi alınamadı');
        const body = await res.json() as DashboardResponse;
        if (mounted) setData(body);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Bilinmeyen hata');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [weekRange, compareMode, selectedMemberId, selectedProjectId, startWeekInput, endWeekInput]);

  const comparisonRows = useMemo(() => {
    if (!compareMode || !data || data.weeklyTrend.length < 4) return [];
    const source = data.weeklyTrend;
    const size = Math.min(8, Math.floor(source.length / 2));
    if (size < 2) return [];

    const current = source.slice(-size);
    const previous = source.slice(-(size * 2), -size);

    return current.map((row, index) => ({
      slot: index + 1,
      currentCreated: row.created,
      previousCreated: previous[index]?.created ?? 0,
      currentCompleted: row.completed,
      previousCompleted: previous[index]?.completed ?? 0,
    }));
  }, [compareMode, data]);

  return (
    <section className="management-insights">
      <div className="management-insights-header">
        <div>
          <h2>Ekip Yönetim Özeti</h2>
          <p>Görev yoğunluğu, tamamlanma eğilimi ve proje dağılımı</p>
        </div>
        <div className="management-range-switch">
          {weekRanges.map((range) => (
            <button
              key={range}
              type="button"
              className={`management-range-btn${range === weekRange ? ' active' : ''}`}
              onClick={() => setWeekRange(range)}
            >
              Son {range} Hafta
            </button>
          ))}
        </div>
      </div>

      <div className="management-filter-grid">
        <select
          className="input"
          value={selectedMemberId ?? ''}
          onChange={(e) => setSelectedMemberId(e.target.value ? Number(e.target.value) : null)}
          style={{ fontSize: 12, padding: '6px 8px' }}
        >
          <option value="">Tüm Üyeler</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>{member.name}</option>
          ))}
        </select>

        <select
          className="input"
          value={selectedProjectId ?? ''}
          onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
          style={{ fontSize: 12, padding: '6px 8px' }}
        >
          <option value="">Tüm Projeler</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>

        <input
          className="input"
          type="week"
          value={startWeekInput}
          onChange={(e) => setStartWeekInput(e.target.value)}
          style={{ fontSize: 12, padding: '6px 8px' }}
          title="Başlangıç haftası"
        />

        <input
          className="input"
          type="week"
          value={endWeekInput}
          onChange={(e) => setEndWeekInput(e.target.value)}
          style={{ fontSize: 12, padding: '6px 8px' }}
          title="Bitiş haftası"
        />

        <label className="management-compare-toggle">
          <input
            type="checkbox"
            checked={compareMode}
            onChange={(e) => setCompareMode(e.target.checked)}
          />
          Karşılaştırmalı dönem (önceki 8 vs son 8)
        </label>
      </div>

      {loading && (
        <div className="management-skeleton-grid">
          {[1, 2, 3, 4].map((id) => (
            <div key={id} className="skeleton-stat">
              <div className="skeleton skeleton-line short" />
              <div className="skeleton skeleton-line medium" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="empty-state" style={{ padding: '20px 0' }}>
          <p style={{ color: 'var(--accent-sos)' }}>Analitik yüklenemedi: {error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="management-kpi-grid">
            <div className="management-kpi-card">
              <div className="management-kpi-label"><Activity size={14} /> Toplam</div>
              <div className="management-kpi-value">{data.taskMetrics.total}</div>
            </div>
            <div className="management-kpi-card">
              <div className="management-kpi-label"><TrendingUp size={14} /> Tamamlanma</div>
              <div className="management-kpi-value">%{data.taskMetrics.completionRate}</div>
            </div>
            <div className="management-kpi-card">
              <div className="management-kpi-label"><BarChart3 size={14} /> SOS</div>
              <div className="management-kpi-value">{data.taskMetrics.sos}</div>
            </div>
            <div className="management-kpi-card">
              <div className="management-kpi-label"><Users size={14} /> Bloke</div>
              <div className="management-kpi-value">{data.taskMetrics.blocked}</div>
            </div>
          </div>

          {compareMode && comparisonRows.length > 0 && (
            <article className="management-panel" style={{ marginTop: 10 }}>
              <div className="management-panel-title">Karşılaştırmalı Dönem</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={comparisonRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="slot" tick={{ fill: 'var(--text-3)', fontSize: 11 }} tickFormatter={(value) => `${value}.Hafta`} />
                    <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="previousCreated" stroke="oklch(70% 0.03 260)" strokeWidth={2} dot={{ r: 2 }} name="Önceki dönem eklenen" />
                    <Line type="monotone" dataKey="currentCreated" stroke="oklch(72% 0.14 60)" strokeWidth={2} dot={{ r: 2 }} name="Son dönem eklenen" />
                    <Line type="monotone" dataKey="previousCompleted" stroke="oklch(70% 0.03 200)" strokeWidth={2} dot={{ r: 2 }} name="Önceki dönem tamamlanan" />
                    <Line type="monotone" dataKey="currentCompleted" stroke="oklch(72% 0.17 150)" strokeWidth={2} dot={{ r: 2 }} name="Son dönem tamamlanan" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          )}

          <div className="management-insights-grid">
            <article className="management-panel">
              <div className="management-panel-title">Haftalık Trend</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.weeklyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="week" tick={{ fill: 'var(--text-3)', fontSize: 11 }} tickFormatter={(value) => `H${value}`} />
                    <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      labelFormatter={(label) => `Hafta ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="created"
                      fill="oklch(72% 0.14 60)"
                      radius={[6, 6, 0, 0]}
                      name="Eklenen"
                      animationDuration={550}
                      onClick={(entry) => {
                        const payload = entry.payload as { year?: number; week?: number };
                        if (!payload?.year || !payload?.week) return;
                        const key = `${payload.year}-${payload.week}`;
                        setSelectedWeekKey((prev) => (prev === key ? null : key));
                      }}
                    />
                    <Bar
                      dataKey="completed"
                      fill="oklch(72% 0.17 150)"
                      radius={[6, 6, 0, 0]}
                      name="Tamamlanan"
                      animationDuration={650}
                      onClick={(entry) => {
                        const payload = entry.payload as { year?: number; week?: number };
                        if (!payload?.year || !payload?.week) return;
                        const key = `${payload.year}-${payload.week}`;
                        setSelectedWeekKey((prev) => (prev === key ? null : key));
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="management-panel">
              <div className="management-panel-title">Yoğun Üyeler</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.memberWorkload.slice(0, 6)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="oklch(75% 0.16 60)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Toplam"
                      animationDuration={650}
                      onClick={(entry) => {
                        const name = String(entry.name || '');
                        setSelectedMemberName((prev) => (prev === name ? null : name));
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="oklch(72% 0.17 150)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Tamamlanan"
                      animationDuration={750}
                      onClick={(entry) => {
                        const name = String(entry.name || '');
                        setSelectedMemberName((prev) => (prev === name ? null : name));
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="management-panel">
              <div className="management-panel-title">Öne Çıkan Projeler</div>
              <div className="management-project-list">
                {data.topProjects.map((project) => (
                  <button
                    key={project.projectId}
                    type="button"
                    className={`management-project-item${selectedProjectName === project.name ? ' active' : ''}`}
                    onClick={() => setSelectedProjectName((prev) => (prev === project.name ? null : project.name))}
                  >
                    <div className="management-project-dot" style={{ background: project.color }} />
                    <div className="management-project-main">
                      <strong>{project.name}</strong>
                      <span>{project.completed}/{project.total} tamamlandı</span>
                    </div>
                    <div className="management-project-rate">%{project.completionRate}</div>
                  </button>
                ))}
              </div>
            </article>
          </div>

          <article className="management-panel management-drilldown-panel">
            <div className="management-panel-title" style={{ marginBottom: 8 }}>
              Drill-down Görev Listesi
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
              {selectedWeekKey ? `Hafta: ${selectedWeekKey}` : 'Hafta: Tümü'} · {selectedMemberName ? `Üye: ${selectedMemberName}` : 'Üye: Tümü'} · {selectedProjectName ? `Proje: ${selectedProjectName}` : 'Proje: Tümü'}
            </div>

            <div className="management-drilldown-list">
              {data.scopedTasks
                .filter((task) => {
                  if (selectedWeekKey && `${task.year}-${task.week_number}` !== selectedWeekKey) return false;
                  if (selectedMemberName && (task.assigned_name || '') !== selectedMemberName) return false;
                  if (selectedProjectName && (task.project_name || '') !== selectedProjectName) return false;
                  return true;
                })
                .slice(0, 40)
                .map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="management-drilldown-item"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('ph-focus-task', {
                        detail: {
                          taskId: task.id,
                          memberId: task.assigned_to,
                          weekNumber: task.week_number,
                          year: task.year,
                        },
                      }));
                    }}
                  >
                    <div className="management-drilldown-main">
                      <strong>{task.title}</strong>
                      <span>H{task.week_number} · {task.year} · {task.project_name || 'Projesiz'} · @{task.assigned_name || 'Atanmamış'}</span>
                    </div>
                    <span className={`status-badge status-${task.status}`}>{task.status}</span>
                  </button>
                ))}
            </div>
          </article>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const params = new URLSearchParams();
                params.set('weekRange', String(weekRange));
                if (selectedMemberId) params.set('memberId', String(selectedMemberId));
                if (selectedProjectId) params.set('projectId', String(selectedProjectId));
                const startParts = weekInputToParts(startWeekInput);
                const endParts = weekInputToParts(endWeekInput);
                if (startParts && endParts) {
                  params.set('startWeek', String(startParts.week));
                  params.set('startYear', String(startParts.year));
                  params.set('endWeek', String(endParts.week));
                  params.set('endYear', String(endParts.year));
                }
                window.open(`/api/analytics/dashboard/export?${params.toString()}`, '_blank');
              }}
            >
              Analitik Raporu XLSX İndir
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const params = new URLSearchParams();
                params.set('weekRange', String(weekRange));
                if (selectedMemberId) params.set('memberId', String(selectedMemberId));
                if (selectedProjectId) params.set('projectId', String(selectedProjectId));
                const startParts = weekInputToParts(startWeekInput);
                const endParts = weekInputToParts(endWeekInput);
                if (startParts && endParts) {
                  params.set('startWeek', String(startParts.week));
                  params.set('startYear', String(startParts.year));
                  params.set('endWeek', String(endParts.week));
                  params.set('endYear', String(endParts.year));
                }
                window.open(`/api/analytics/dashboard/export/pdf?${params.toString()}`, '_blank');
              }}
            >
              Analitik Raporu PDF İndir
            </button>
          </div>
        </>
      )}
    </section>
  );
}
