'use client';

import { create } from 'zustand';
import type { Task, Member, Project, Note, Notification, ViewMode } from './types';
import { getWeekNumber } from './parser';

const nowWeek = getWeekNumber();

interface AppStore {
  // View state
  view: ViewMode;
  setView: (v: ViewMode) => void;

  // Current user (simple: first member by default)
  currentMemberId: number | null;
  setCurrentMemberId: (id: number) => void;

  activeNoteId: number | null;
  setActiveNoteId: (id: number | null) => void;

  selectedWeek: number;
  selectedYear: number;
  setSelectedWeekYear: (week: number, year: number) => void;

  // Data
  tasks: Task[];
  members: Member[];
  projects: Project[];
  notes: Note[];
  notifications: Notification[];

  // Loading
  loading: boolean;

  // Actions
  fetchAll: () => Promise<void>;
  fetchTasks: (params?: Record<string, string>) => Promise<void>;
  fetchMembers: () => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchNotes: () => Promise<void>;
  fetchNotifications: (memberId?: number) => Promise<void>;

  createTask: (data: Partial<Task>) => Promise<Task | null>;
  updateTask: (id: number, data: Partial<Task> & { sos_from?: number; sos_to?: number; task_title?: string }) => Promise<Task | null>;
  deleteTask: (id: number) => Promise<void>;

  createMember: (data: Partial<Member>) => Promise<Member | null>;
  updateMemberStatus: (id: number, status: Member['status']) => Promise<void>;
  updateMember: (id: number, data: Partial<Member>) => Promise<void>;

  createProject: (data: Partial<Project>) => Promise<Project | null>;

  createNote: (data: Partial<Note>) => Promise<Note | null>;
  updateNote: (id: number, data: Partial<Note>) => Promise<Note | null>;
  deleteNote: (id: number) => Promise<void>;
  convertNoteLineToTask: (noteId: number, data: { title: string; project_id?: number; assigned_tos?: number[] }) => Promise<Task[] | null>;

  triggerRollover: () => Promise<{ rolledOver: number; archived: number } | null>;
  triggerAutoRollover: () => Promise<{ rolledOver: number; archived: number; skipped?: boolean } | null>;

  markNotificationsRead: (memberId: number) => Promise<void>;

  // Rollover animation
  showRolloverBanner: boolean;
  rolloverCount: number;
  setRolloverBanner: (show: boolean, count?: number) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  view: 'personal',
  setView: (v) => set({ view: v }),

  currentMemberId: null,
  setCurrentMemberId: (id) => set({ currentMemberId: id }),

  activeNoteId: null,
  setActiveNoteId: (id) => set({ activeNoteId: id }),

  selectedWeek: nowWeek.week,
  selectedYear: nowWeek.year,
  setSelectedWeekYear: (week, year) => set({ selectedWeek: week, selectedYear: year }),

  tasks: [],
  members: [],
  projects: [],
  notes: [],
  notifications: [],
  loading: false,
  showRolloverBanner: false,
  rolloverCount: 0,

  setRolloverBanner: (show, count = 0) => set({ showRolloverBanner: show, rolloverCount: count }),

  fetchAll: async () => {
    set({ loading: true });
    await Promise.all([
      get().fetchTasks(),
      get().fetchMembers(),
      get().fetchProjects(),
      get().fetchNotes(),
    ]);
    set({ loading: false });
  },

  fetchTasks: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/tasks${qs ? `?${qs}` : ''}`);
    const tasks = await res.json();
    set({ tasks });
  },

  fetchMembers: async () => {
    const res = await fetch('/api/members');
    const members = await res.json();
    set({ members });
    // Auto-set current member if not set
    if (!get().currentMemberId && members.length > 0) {
      set({ currentMemberId: members[0].id });
    }
  },

  fetchProjects: async () => {
    const res = await fetch('/api/projects');
    const projects = await res.json();
    set({ projects });
  },

  fetchNotes: async () => {
    const res = await fetch('/api/notes');
    const notes = await res.json();
    set({ notes });
  },

  fetchNotifications: async (memberId) => {
    const url = memberId ? `/api/notifications?memberId=${memberId}` : '/api/notifications';
    const res = await fetch(url);
    const notifications = await res.json();
    set({ notifications });
  },

  createTask: async (data) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const task = await res.json();
    set((s) => ({ tasks: [task, ...s.tasks] }));
    return task;
  },

  updateTask: async (id, data) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const updated = await res.json();
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
    return updated;
  },

  deleteTask: async (id) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },

  createMember: async (data) => {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const member = await res.json();
    set((s) => ({ members: [...s.members, member] }));
    return member;
  },

  updateMemberStatus: async (id, status) => {
    const res = await fetch('/api/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const updated = await res.json();
    set((s) => ({ members: s.members.map((m) => (m.id === id ? updated : m)) }));
  },

  updateMember: async (id, data) => {
    const res = await fetch('/api/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    });
    const updated = await res.json();
    set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...updated } : m)) }));
  },

  createProject: async (data) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const project = await res.json();
    set((s) => ({ projects: [...s.projects, project] }));
    return project;
  },

  createNote: async (data) => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const note = await res.json();
    set((s) => ({ notes: [note, ...s.notes] }));
    return note;
  },

  updateNote: async (id, data) => {
    const res = await fetch(`/api/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const updated = await res.json();
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...updated } : n)) }));
    return updated;
  },

  deleteNote: async (id) => {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
  },

  convertNoteLineToTask: async (noteId, data) => {
    const res = await fetch(`/api/notes/${noteId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const tasks = await res.json();
    set((s) => ({ tasks: [...tasks, ...s.tasks] }));
    return tasks;
  },

  triggerRollover: async () => {
    const res = await fetch('/api/rollover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'manual' }),
    });
    if (!res.ok) return null;
    const result = await res.json();
    await get().fetchTasks();
    get().setRolloverBanner(true, result.rolledOver);
    return result;
  },

  triggerAutoRollover: async () => {
    const res = await fetch('/api/rollover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'auto' }),
    });
    if (!res.ok) return null;

    const result = await res.json();
    if (result.skipped) return result;

    await get().fetchTasks();
    get().setRolloverBanner(true, result.rolledOver);
    return result;
  },

  markNotificationsRead: async (memberId) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true, memberId }),
    });
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.to_member_id === memberId ? { ...n, read: 1 } : n
      ),
    }));
  },
}));
