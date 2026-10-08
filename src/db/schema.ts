// Database schema and migrations. initDatabase() runs once on app start
// (via SQLiteProvider's onInit) and brings the schema up to SCHEMA_VERSION.

import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'attendance.db';
export const SCHEMA_VERSION = 1;

// Students are soft-deleted (active = 0) when they drop off a re-imported
// roster, so their attendance history is never cascaded away.
const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roll_no TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  period INTEGER NOT NULL,
  UNIQUE(date, period)
);

CREATE TABLE IF NOT EXISTS attendance (
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ABSENT',
  PRIMARY KEY (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

/** Ordered migrations; index i upgrades the schema from version i to i + 1. */
const MIGRATIONS: readonly string[] = [MIGRATION_V1];

export async function getSchemaVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  // Connection-level pragmas: foreign_keys must be set on every open, and
  // journal_mode cannot change inside a transaction.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const current = await getSchemaVersion(db);
  if (current >= SCHEMA_VERSION) return;

  await db.withTransactionAsync(async () => {
    for (let version = current; version < SCHEMA_VERSION; version++) {
      await db.execAsync(MIGRATIONS[version]);
    }
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}
