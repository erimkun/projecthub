import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcryptjs';

type DbRow = Record<string, unknown>;

type RunResult = {
  changes: number;
  lastInsertRowid: number | null;
};

type Statement = {
  run: (...params: unknown[]) => Promise<RunResult>;
  get: (...params: unknown[]) => Promise<DbRow | undefined>;
  all: (...params: unknown[]) => Promise<DbRow[]>;
};

type QueryTarget = Pool | PoolClient;

type DbHandle = {
  prepare: (sql: string) => Statement;
  transaction: <T>(fn: (tx: DbHandle) => Promise<T> | T) => () => Promise<T>;
  exec: (sql: string) => Promise<void>;
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

let initPromise: Promise<void> | null = null;

function normalizeSql(sql: string): string {
  return sql
    .replace(/datetime\('now'\)/gi, 'NOW()')
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
}

function toPgPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function extractInsertTable(sql: string): string | null {
  const match = sql.match(/^\s*INSERT\s+INTO\s+(["\w.]+)/i);
  if (!match) return null;
  return match[1].replace(/"/g, '').toLowerCase();
}

function buildSql(sql: string): string {
  let normalized = normalizeSql(sql);
  normalized = toPgPlaceholders(normalized);

  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql)) {
    normalized = `${normalized} ON CONFLICT DO NOTHING`;
    return normalized;
  }

  if (/^\s*INSERT\s+/i.test(sql) && !/RETURNING\s+/i.test(normalized)) {
    const table = extractInsertTable(normalized);
    if (table && !['app_settings', 'note_tasks'].includes(table)) {
      normalized = `${normalized} RETURNING id`;
    }
  }

  return normalized;
}

async function query(target: QueryTarget, sql: string, params: unknown[] = []): Promise<DbRow[]> {
  const result = await target.query(buildSql(sql), params);
  return result.rows as DbRow[];
}

function createHandle(target: QueryTarget): DbHandle {
  return {
    prepare(sql: string): Statement {
      return {
        async run(...params: unknown[]) {
          const rows = await query(target, sql, params);
          const first = rows[0];
          const lastInsertRowid = first && typeof first.id !== 'undefined' ? Number(first.id) : null;
          return { changes: rows.length, lastInsertRowid };
        },
        async get(...params: unknown[]) {
          const rows = await query(target, sql, params);
          return rows[0];
        },
        async all(...params: unknown[]) {
          return query(target, sql, params);
        },
      };
    },
    transaction<T>(fn: (tx: DbHandle) => Promise<T> | T) {
      return async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const txHandle = createHandle(client);
          const result = await fn(txHandle);
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      };
    },
    async exec(sql: string) {
      await target.query(sql);
    },
  };
}

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#f59e0b',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      approved INTEGER NOT NULL DEFAULT 0,
      is_superadmin INTEGER NOT NULL DEFAULT 0,
      approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      blocked_reason TEXT,
      parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      assigned_to INTEGER REFERENCES members(id) ON DELETE SET NULL,
      helper_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      week_number INTEGER NOT NULL DEFAULT 1,
      year INTEGER NOT NULL DEFAULT 2024,
      is_rollover INTEGER NOT NULL DEFAULT 0,
      origin_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      source_week_number INTEGER,
      source_year INTEGER,
      pulled_into_current_week INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Yeni Not',
      content TEXT NOT NULL DEFAULT '',
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS note_tasks (
      note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, task_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      to_member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
      from_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      read INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      week_number INTEGER NOT NULL,
      year INTEGER NOT NULL,
      criticals TEXT NOT NULL DEFAULT '',
      decisions TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (week_number, year)
    );

    CREATE TABLE IF NOT EXISTS meeting_actions (
      id SERIAL PRIMARY KEY,
      meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      action_text TEXT NOT NULL,
      assigned_to INTEGER REFERENCES members(id) ON DELETE SET NULL,
      assigned_member_ids TEXT NOT NULL DEFAULT '',
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      due_week_number INTEGER,
      due_year INTEGER,
      due_date TEXT,
      task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      detail TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

  `);

  await pool.query(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE;

    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS approved INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_superadmin INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

    ALTER TABLE meeting_actions
    ADD COLUMN IF NOT EXISTS assigned_member_ids TEXT NOT NULL DEFAULT '';

    ALTER TABLE meeting_actions
    ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_meetings_week_year ON meetings(year, week_number);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_users_approval ON users(approved, is_superadmin);
  `);

  const superadmin = await pool.query('SELECT id FROM users WHERE username = $1', ['superadmin']);
  if (superadmin.rows.length === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, member_id, approved, is_superadmin, approved_at)
       VALUES ($1, $2, NULL, 1, 1, NOW())`,
      ['superadmin', hash]
    );
  }
}

async function getDb(): Promise<DbHandle> {
  if (!initPromise) {
    initPromise = initSchema();
  }

  await initPromise;
  return createHandle(pool);
}

export default getDb;