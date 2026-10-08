// Full backup (export/validate/restore) and "clear all data". A backup is a
// versioned JSON snapshot of every table, keeping ids so links stay intact.
// Version 1 backups (before classes) are converted on restore, the same way
// the v2 schema migration converts old data. Restore and clear each run in a
// single transaction: they either fully succeed or change nothing.

import type { SQLiteDatabase } from 'expo-sqlite';

import { isISODate } from '../utils/dates';
import type { ClassKind } from './classes';
import { MIGRATED_CLASS_NAME } from './schema';
import { serializeWrite } from './writeQueue';

export const BACKUP_FORMAT = 'attendly-backup';
export const BACKUP_VERSION = 2;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  classes: { id: number; name: string; kind: ClassKind; createdAt: string }[];
  students: { id: number; rollNo: string; name: string }[];
  classStudents: { classId: number; studentId: number }[];
  sessions: { id: number; classId: number; date: string; period: number }[];
  attendance: { sessionId: number; studentId: number; status: string }[];
  settings: Record<string, string>;
}

export interface DataCounts {
  classes: number;
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
  const row = await db.getFirstAsync<DataCounts>(
    `SELECT
       (SELECT COUNT(*) FROM classes) AS classes,
       (SELECT COUNT(*) FROM students) AS students,
       (SELECT COUNT(*) FROM attendance) AS absences,
       (SELECT COUNT(DISTINCT s.date) FROM sessions s WHERE EXISTS (SELECT 1 FROM attendance a WHERE a.session_id = s.id)) AS days`
  );
  return { classes: row?.classes ?? 0, students: row?.students ?? 0, absences: row?.absences ?? 0, days: row?.days ?? 0 };
}

export async function exportBackup(db: SQLiteDatabase): Promise<Backup> {
  const [classes, students, classStudents, sessions, attendance, settings] = await Promise.all([
    db.getAllAsync<{ id: number; name: string; kind: ClassKind; created_at: string }>('SELECT id, name, kind, created_at FROM classes ORDER BY id'),
    db.getAllAsync<{ id: number; roll_no: string; name: string }>('SELECT id, roll_no, name FROM students ORDER BY id'),
    db.getAllAsync<{ class_id: number; student_id: number }>('SELECT class_id, student_id FROM class_students ORDER BY class_id, student_id'),
    db.getAllAsync<{ id: number; class_id: number; date: string; period: number }>('SELECT id, class_id, date, period FROM sessions ORDER BY id'),
    db.getAllAsync<{ session_id: number; student_id: number; status: string }>(
      'SELECT session_id, student_id, status FROM attendance ORDER BY session_id, student_id'
    ),
    db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings ORDER BY key'),
  ]);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    classes: classes.map((c) => ({ id: c.id, name: c.name, kind: c.kind, createdAt: c.created_at })),
    students: students.map((s) => ({ id: s.id, rollNo: s.roll_no, name: s.name })),
    classStudents: classStudents.map((l) => ({ classId: l.class_id, studentId: l.student_id })),
    sessions: sessions.map((s) => ({ id: s.id, classId: s.class_id, date: s.date, period: s.period })),
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

function readSettings(data: Record<string, unknown>): Record<string, string> {
  const settings: Record<string, string> = {};
  if (isRecord(data.settings)) {
    for (const [key, value] of Object.entries(data.settings)) {
      if (typeof value === 'string') settings[key] = value;
    }
  }
  return settings;
}

/** Converts a version 1 backup (single roster, students.active) to the current shape. */
function upgradeV1(data: Record<string, unknown>): Record<string, unknown> {
  const students = arrayField(data, 'students');
  const sessions = arrayField(data, 'sessions');
  const hasData = students.length > 0 || sessions.length > 0;
  const classId = 1;
  return {
    ...data,
    version: BACKUP_VERSION,
    classes: hasData
      ? [{ id: classId, name: MIGRATED_CLASS_NAME, kind: 'CLASS', createdAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString() }]
      : [],
    students: students.map((s) => (isRecord(s) ? { id: s.id, rollNo: s.rollNo, name: s.name } : s)),
    classStudents: students.filter((s) => isRecord(s) && s.active === true).map((s) => ({ classId, studentId: (s as Record<string, unknown>).id })),
    sessions: sessions.map((s) => (isRecord(s) ? { ...s, classId } : s)),
  };
}

/** Checks that parsed JSON is a complete, internally consistent backup (v1 or v2). */
export function validateBackup(input: unknown): Backup {
  if (!isRecord(input) || input.format !== BACKUP_FORMAT) {
    throw new BackupError("This file isn't an Attendly backup. Choose a file that was created with \"Export backup\".");
  }
  if (input.version !== 1 && input.version !== BACKUP_VERSION) {
    throw new BackupError('This backup was made by a newer version of the app. Update the app, then try again.');
  }
  const data = input.version === 1 ? upgradeV1(input) : input;

  const classIds = new Set<number>();
  const classNames = new Set<string>();
  const classes = arrayField(data, 'classes').map((c, i) => {
    if (!isRecord(c) || !isId(c.id) || typeof c.name !== 'string' || !c.name.trim() || (c.kind !== 'CLASS' && c.kind !== 'SUBJECT')) {
      damaged(`class ${i + 1}`);
    }
    const nameKey = `${c.kind}|${c.name.trim().toLowerCase()}`;
    if (classIds.has(c.id) || classNames.has(nameKey)) damaged(`class "${c.name}" appears twice`);
    classIds.add(c.id);
    classNames.add(nameKey);
    return { id: c.id, name: c.name, kind: c.kind as ClassKind, createdAt: typeof c.createdAt === 'string' ? c.createdAt : '' };
  });

  const studentIds = new Set<number>();
  const rollNos = new Set<string>();
  const students = arrayField(data, 'students').map((s, i) => {
    if (!isRecord(s) || !isId(s.id) || typeof s.rollNo !== 'string' || typeof s.name !== 'string') damaged(`student ${i + 1}`);
    if (!s.rollNo.trim() || !s.name.trim()) damaged(`student ${i + 1} has no roll number or name`);
    if (studentIds.has(s.id) || rollNos.has(s.rollNo)) damaged(`roll number ${s.rollNo} appears twice`);
    studentIds.add(s.id);
    rollNos.add(s.rollNo);
    return { id: s.id, rollNo: s.rollNo, name: s.name };
  });

  const links = new Set<string>();
  const classStudents = arrayField(data, 'classStudents').map((l, i) => {
    if (!isRecord(l) || !classIds.has(l.classId as number) || !studentIds.has(l.studentId as number)) damaged(`class member ${i + 1}`);
    const key = `${l.classId}|${l.studentId}`;
    if (links.has(key)) damaged(`class member ${i + 1} appears twice`);
    links.add(key);
    return { classId: l.classId as number, studentId: l.studentId as number };
  });

  const sessionIds = new Set<number>();
  const sessionKeys = new Set<string>();
  const sessions = arrayField(data, 'sessions').map((s, i) => {
    if (!isRecord(s) || !isId(s.id) || !classIds.has(s.classId as number) || !isISODate(s.date) || !isId(s.period)) damaged(`session ${i + 1}`);
    const key = `${s.classId}|${s.date}|${s.period}`;
    if (sessionIds.has(s.id) || sessionKeys.has(key)) damaged(`session ${s.date} period ${s.period} appears twice`);
    sessionIds.add(s.id);
    sessionKeys.add(key);
    return { id: s.id, classId: s.classId as number, date: s.date, period: s.period };
  });

  const pairs = new Set<string>();
  const attendance = arrayField(data, 'attendance').map((a, i) => {
    if (!isRecord(a) || !sessionIds.has(a.sessionId as number) || !studentIds.has(a.studentId as number)) damaged(`attendance record ${i + 1}`);
    const key = `${a.sessionId}|${a.studentId}`;
    if (pairs.has(key)) damaged(`attendance record ${i + 1} appears twice`);
    pairs.add(key);
    return { sessionId: a.sessionId as number, studentId: a.studentId as number, status: typeof a.status === 'string' ? a.status : 'ABSENT' };
  });

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    classes,
    students,
    classStudents,
    sessions,
    attendance,
    settings: readSettings(data),
  };
}

export function countBackup(backup: Backup): DataCounts {
  const absentSessions = new Set(backup.attendance.map((a) => a.sessionId));
  const days = new Set(backup.sessions.filter((s) => absentSessions.has(s.id)).map((s) => s.date));
  return { classes: backup.classes.length, students: backup.students.length, absences: backup.attendance.length, days: days.size };
}

// ---------- write ----------

async function deleteEverything(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    DELETE FROM attendance;
    DELETE FROM sessions;
    DELETE FROM class_students;
    DELETE FROM classes;
    DELETE FROM students;
    DELETE FROM settings;
    DELETE FROM sqlite_sequence WHERE name IN ('students', 'sessions', 'classes');
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
      await insertAll(db, 'INSERT INTO classes (id, name, kind, created_at) VALUES ($id, $name, $kind, $createdAt)', backup.classes, (c) => ({
        $id: c.id,
        $name: c.name,
        $kind: c.kind,
        $createdAt: c.createdAt || new Date().toISOString(),
      }));
      await insertAll(db, 'INSERT INTO students (id, roll_no, name) VALUES ($id, $rollNo, $name)', backup.students, (s) => ({
        $id: s.id,
        $rollNo: s.rollNo,
        $name: s.name,
      }));
      await insertAll(db, 'INSERT INTO class_students (class_id, student_id) VALUES ($classId, $studentId)', backup.classStudents, (l) => ({
        $classId: l.classId,
        $studentId: l.studentId,
      }));
      await insertAll(db, 'INSERT INTO sessions (id, class_id, date, period) VALUES ($id, $classId, $date, $period)', backup.sessions, (s) => ({
        $id: s.id,
        $classId: s.classId,
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

/** Permanently deletes all classes, students, attendance and settings. */
export function clearAllData(db: SQLiteDatabase): Promise<void> {
  return serializeWrite(() => db.withTransactionAsync(() => deleteEverything(db)));
}
