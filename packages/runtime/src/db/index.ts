import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  npm_package TEXT,
  install_command TEXT DEFAULT 'npx',
  status TEXT DEFAULT 'stopped',
  pid INTEGER,
  port INTEGER,
  config JSON,
  env_vars JSON,
  installed_at TEXT DEFAULT (datetime('now')),
  last_started_at TEXT
);

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  trigger JSON NOT NULL,
  steps JSON NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_run_at TEXT,
  run_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  status TEXT NOT NULL,
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  result JSON,
  error TEXT,
  steps_executed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  server_slug TEXT,
  encrypted_value BLOB NOT NULL,
  iv BLOB NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

let db: DatabaseSync | null = null;

export function getDb(dbPath?: string): DatabaseSync {
  if (db) return db;

  const dataDir = process.env.HIVE_DATA_DIR ?? process.cwd();
  const path = dbPath ?? join(dataDir, "hive-desktop.db");
  db = new DatabaseSync(path);

  // Enable WAL mode for better concurrent access
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  // Run schema
  db.exec(SCHEMA_SQL);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
