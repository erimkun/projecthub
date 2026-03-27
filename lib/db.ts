import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'project-hub.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    -- Users (authentication)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#f59e0b',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatar TEXT,
      status TEXT DEFAULT 'available',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      assigned_to INTEGER REFERENCES members(id) ON DELETE SET NULL,
      helper_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      week_number INTEGER NOT NULL DEFAULT 1,
      year INTEGER NOT NULL DEFAULT 2024,
      is_rollover INTEGER DEFAULT 0,
      origin_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      source_week_number INTEGER,
      source_year INTEGER,
      pulled_into_current_week INTEGER DEFAULT 0,
      tags TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT DEFAULT 'Yeni Not',
      content TEXT NOT NULL DEFAULT '',
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS note_tasks (
      note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, task_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
      from_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT DEFAULT '',
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Seed default projects only (no mock users/members)
    INSERT OR IGNORE INTO projects (id, name, color) VALUES
      (1, 'Genel', '#f59e0b'),
      (2, 'Backend', '#6366f1'),
      (3, 'Frontend', '#10b981');
  `);

  // Backfill new columns for existing databases.
  ensureColumn(db, 'tasks', 'origin_task_id', 'INTEGER REFERENCES tasks(id) ON DELETE SET NULL');
  ensureColumn(db, 'tasks', 'source_week_number', 'INTEGER');
  ensureColumn(db, 'tasks', 'source_year', 'INTEGER');
  ensureColumn(db, 'tasks', 'pulled_into_current_week', 'INTEGER DEFAULT 0');
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export default getDb;
