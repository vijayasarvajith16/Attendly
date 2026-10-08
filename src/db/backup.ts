// Full backup (export/validate/restore) and "clear all data". A backup is a
// versioned JSON snapshot of every table, keeping ids so absences stay linked
// to the right students and sessions. Restore and clear each run in a single
// transaction: they either fully succeed or change nothing.

import type { SQLiteDatabase } from 'expo-sqlite';

import { isISODate } from '../utils/dates';
import { serializeWrite } from './writeQueue';

export const BACKUP_FORMAT = 'attendly-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  students: { id: number; rollNo: string; name: string; active: boolean }[];
  sessions: { id: number; date: string; period: number }[];
  attendance: { sessionId: number; studentId: number; status: string }[];
  settings: Record<string, string>;
}

export interface DataCounts {
  students: number;
  absences: number;
  days: number;
}

/** Thrown for files that are not valid backups; the message is shown to the user. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

// ---------- read ----------

export async function getDataCounts(db: SQLiteDatabase): Promise<DataCounts> {
  const row = await db.getFirstAsync<{ students: number; absences: number; days: number }>(
    `SELECT
       (SELECT COUNT(*) FROM students WHERE active = 1) AS students,
       (SELECT COUNT(*) FROM attendance) AS absences,
       (SELECT COUNT(DISTINCT s.date) FROM sessions s WHERE EXISTS (SELECT 1 FROM attendance a WHERE a.session_id = s.id)) AS days`
  );
  return { students: row?.students ?? 0, absences: row?.absences ?? 0, days: row?.days ?? 0 };
}

export async function exportBackup(db: SQLiteDatabase): Promise<Backup> {
  const [students, sessions, attendance, settings] = await Promise.all([
    db.getAllAsync<{ id: number; roll_no: string; name: string; active: number }>('SELECT id, roll_no, name, active FROM students ORDER BY id'),
    db.getAllAsync<{ id: number; date: string; period: number }>('SELECT id, date, period FROM sessions ORDER BY id'),
    db.getAllAsync<{ session_id: number; student_id: number; status: string }>(
      'SELECT session_id, student_id, status FROM attendance ORDER BY session_id, student_id'
    ),
    db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings ORDER BY key'),
  ]);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    students: students.map((s) => ({ id: s.id, rollNo: s.roll_no, name: s.name, active: s.active === 1 })),
    sessions: sessions.map((s) => ({ id: s.id, date: s.date, period: s.period })),
    attendance: attendance.map((a) => ({ sessionId: a.session_id, studentId: a.student_id, status: a.status })),
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
  };
}

// ---------- validate ----------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function damaged(detail: string): never {
  throw new BackupError(`This backup file is damaged and can't be restored (${detail}). Your current data has not been changed.`);
}

function arrayField(data: Record<string, unknown>, field: string): unknown[] {
  const value = data[field];
  if (!Array.isArray(value)) damaged(`missing ${field}`);
  return value;
}

/** Checks that parsed JSON is a complete, internally consistent backup. */
export function validateBackup(data: unknown): Backup {
  if (!isRecord(data) || data.format !== BACKUP_FORMAT) {
    throw new BackupError("This file isn't an Attendly backup. Choose a file that was created with \"Export backup\".");
  }
  if (data.version !== BACKUP_VERSION) {
    throw new BackupError('This backup was made by a newer version of the app. Update the app, then try again.');
  }

  const studentIds = new Set<number>();
  const rollNos = new Set<string>();
  const students = arrayField(data, 'students').map((s, i) => {
    if (!isRecord(s) || !isId(s.id) || typeof s.rollNo !== 'string' || typeof s.name !== 'string' || typeof s.active !== 'boolean') {
      damaged(`student ${i + 1}`);
    }
    if (!s.rollNo.trim() || !s.name.trim()) damaged(`student ${i + 1} has no roll number or name`);
    if (studentIds.has(s.id) || rollNos.has(s.rollNo)) damaged(`roll number ${s.rollNo} appears twice`);
    studentIds.add(s.id);
    rollNos.add(s.rollNo);
    return { id: s.id, rollNo: s.rollNo, name: s.name, active: s.active };
  });

  const sessionIds = new Set<number>();
  const sessionKeys = new Set<string>();
  const sessions = arrayField(data, 'sessions').map((s, i) => {
    if (!isRecord(s) || !isId(s.id) || !isISODate(s.date) || !isId(s.period)) damaged(`session ${i + 1}`);
    const key = `${s.date}|${s.period}`;
    if (sessionIds.has(s.id) || sessionKeys.has(key)) damaged(`session ${s.date} period ${s.period} appears twice`);
    sessionIds.add(s.id);
    sessionKeys.add(key);
    return { id: s.id, date: s.date, period: s.period };
  });

  const pairs = new Set<string>();
  const attendance = arrayField(data, 'attendance').map((a, i) => {
    if (!isRecord(a) || !sessionIds.has(a.sessionId as number) || !studentIds.has(a.studentId as number)) {
      damaged(`attendance record ${i + 1}`);
    }
    const key = `${a.sessionId}|${a.studentId}`;
    if (pairs.has(key)) damaged(`attendance record ${i + 1} appears twice`);
    pairs.add(key);
    return { sessionId: a.sessionId as number, studentId: a.studentId as number, status: typeof a.status === 'string' ? a.status : 'ABSENT' };
  });

  const settings: Record<string, string> = {};
  if (isRecord(data.settings)) {
    for (const [key, value] of Object.entries(data.settings)) {
      if (typeof value === 'string') settings[key] = value;
    }
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    students,
    sessions,
    attendance,
    settings,
  };
}

export function countBackup(backup: Backup): DataCounts {
  const absentSessions = new Set(backup.attendance.map((a) => a.sessionId));
  const days = new Set(backup.sessions.filter((s) => absentSessions.has(s.id)).map((s) => s.date));
  return { students: backup.students.filter((s) => s.active).length, absences: backup.attendance.length, days: days.size };
}

// ---------- write ----------

async function deleteEverything(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    DELETE FROM attendance;
    DELETE FROM sessions;
    DELETE FROM students;
    DELETE FROM settings;
    DELETE FROM sqlite_sequence WHERE name IN ('students', 'sessions');
  `);
}

async function insertAll<T>(db: SQLiteDatabase, sql: string, rows: readonly T[], params: (row: T) => Record<string, string | number>): Promise<void> {
  const statement = await db.prepareAsync(sql);
  try {
    for (const row of rows) await statement.executeAsync(params(row));
  } finally {
    await statement.finalizeAsync();
  }
}

/** Replaces all data with the backup's contents. All-or-nothing. */
export function restoreBackup(db: SQLiteDatabase, backup: Backup): Promise<void> {
  return serializeWrite(() =>
    db.withTransactionAsync(async () => {
      await deleteEverything(db);
      await insertAll(db, 'INSERT INTO students (id, roll_no, name, active) VALUES ($id, $rollNo, $name, $active)', backup.students, (s) => ({
        $id: s.id,
        $rollNo: s.rollNo,
        $name: s.name,
        $active: s.active ? 1 : 0,
      }));
      await insertAll(db, 'INSERT INTO sessions (id, date, period) VALUES ($id, $date, $period)', backup.sessions, (s) => ({
        $id: s.id,
        $date: s.date,
        $period: s.period,
      }));
      await insertAll(
        db,
        'INSERT INTO attendance (session_id, student_id, status) VALUES ($sessionId, $studentId, $status)',
        backup.attendance,
        (a) => ({ $sessionId: a.sessionId, $studentId: a.studentId, $status: a.status })
      );
      await insertAll(db, 'INSERT INTO settings (key, value) VALUES ($key, $value)', Object.entries(backup.settings), ([key, value]) => ({
        $key: key,
        $value: value,
      }));
    })
  );
}

/** Permanently deletes all students, attendance and settings. */
export function clearAllData(db: SQLiteDatabase): Promise<void> {
  return serializeWrite(() => db.withTransactionAsync(() => deleteEverything(db)));
}
