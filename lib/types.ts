export type TaskStatus = 'pending' | 'done' | 'sos' | 'helping';
export type MemberStatus = 'available' | 'busy' | 'sos' | 'helping';
export type NotificationType = 'sos' | 'mention' | 'help_offered';
export type ViewMode = 'personal' | 'team' | 'notes';

export interface Project {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Member {
  id: number;
  name: string;
  avatar?: string;
  status: MemberStatus;
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  body: string;
  status: TaskStatus;
  project_id?: number;
  assigned_to?: number;
  helper_id?: number | null;
  week_number: number;
  year: number;
  is_rollover: number;
  origin_task_id?: number | null;
  source_week_number?: number | null;
  source_year?: number | null;
  pulled_into_current_week?: number;
  tags: string;
  created_at: string;
  // Joined fields
  project_name?: string;
  project_color?: string;
  assigned_name?: string;
  helper_name?: string;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  project_id?: number;
  created_at: string;
  updated_at: string;
  project_name?: string;
  linked_tasks?: number[];
}

export interface Notification {
  id: number;
  to_member_id: number;
  from_member_id?: number;
  task_id?: number;
  type: NotificationType;
  message: string;
  read: number;
  created_at: string;
  from_name?: string;
  task_title?: string;
}

export interface ParsedInput {
  text: string;
  mentions: string[];   // @kişi
  tags: string[];       // #etiket
  projectRef?: string;
}

export interface RolloverResult {
  rolledOver: number;
  archived: number;
  newWeek: number;
  newYear: number;
  skipped?: boolean;
  reason?: string;
}
