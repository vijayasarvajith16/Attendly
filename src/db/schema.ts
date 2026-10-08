// Database schema and migrations. initDatabase() runs once on app start
// (via SQLiteProvider's onInit) and brings the schema up to SCHEMA_VERSION,
// tracked with PRAGMA user_version.
//
// v1: single roster (students.active), sessions keyed by (date, period).
// v2: classes and subjects. students is the master list; class_students links
//     students to classes (many-to-many); sessions are scoped by class_id.

import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'attendance.db';
export const SCHEMA_VERSION = 2;

/** Name of the class that pre-v2 data is moved into. */
export const MIGRATED_CLASS_NAME = 'My class';

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

// Runs with foreign_keys OFF inside a transaction (SQLite's table-rebuild
// procedure), so sessions can be rebuilt without touching attendance rows.
const MIGRATION_V2 = `
CREATE TABLE classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('CLASS', 'SUBJECT')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX idx_classes_kind_name ON classes(kind, name COLLATE NOCASE);

CREATE TABLE class_students (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, student_id)
);
CREATE INDEX idx_class_students_student ON class_students(student_id);

-- Existing data (if any) moves into one default class.
INSERT INTO classes (name, kind)
  SELECT '${MIGRATED_CLASS_NAME}', 'CLASS'
  WHERE EXISTS (SELECT 1 FROM students) OR EXISTS (SELECT 1 FROM sessions);

INSERT INTO class_students (class_id, student_id)
  SELECT (SELECT MIN(id) FROM classes), id FROM students WHERE active = 1;

CREATE TABLE sessions_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  period INTEGER NOT NULL,
  UNIQUE(class_id, date, period)
);
INSERT INTO sessions_v2 (id, class_id, date, period)
  SELECT id, (SELECT MIN(id) FROM classes), date, period FROM sessions;
DROP TABLE sessions;
ALTER TABLE sessions_v2 RENAME TO sessions;

-- Membership now lives in class_students; students is the master list.
ALTER TABLE students DROP COLUMN active;
`;

/** Ordered migrations; index i upgrades the schema from version i to i + 1. */
const MIGRATIONS: readonly string[] = [MIGRATION_V1, MIGRATION_V2];

export async function getSchemaVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  // journal_mode cannot change inside a transaction.
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const current = await getSchemaVersion(db);
  if (current < SCHEMA_VERSION) {
    // foreign_keys must be OFF while tables are rebuilt, and can only be
    // toggled outside a transaction. Integrity is checked before committing.
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    try {
      await db.withTransactionAsync(async () => {
        for (let version = current; version < SCHEMA_VERSION; version++) {
          await db.execAsync(MIGRATIONS[version]);
        }
        const broken = await db.getAllAsync('PRAGMA foreign_key_check');
        if (broken.length > 0) throw new Error('Database upgrade found inconsistent data; nothing was changed.');
        await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      });
    } finally {
      await db.execAsync('PRAGMA foreign_keys = ON;');
    }
  } else {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}
