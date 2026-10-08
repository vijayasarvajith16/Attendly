// Classes and subjects: create, rename, delete, and list them with counts.
// Deleting a class removes its sessions and absences (cascade) and its
// membership links; students always stay in the master list.

import type { SQLiteDatabase } from 'expo-sqlite';

import { serializeWrite } from './writeQueue';

export type ClassKind = 'CLASS' | 'SUBJECT';

export interface ClassInfo {
  id: number;
  name: string;
  kind: ClassKind;
  createdAt: string;
}

export interface ClassSummary extends ClassInfo {
  studentCount: number;
  /** Students absent in at least one period on the given day. */
  absentToday: number;
}

export const MAX_CLASS_NAME_LENGTH = 60;

/** Thrown for invalid names; the message is shown to the user. */
export class ClassNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClassNameError';
  }
}

interface ClassRow {
  id: number;
  name: string;
  kind: ClassKind;
  created_at: string;
}

function toClassInfo(row: ClassRow): ClassInfo {
  return { id: row.id, name: row.name, kind: row.kind, createdAt: row.created_at };
}

export function kindLabel(kind: ClassKind): string {
  return kind === 'CLASS' ? 'class' : 'subject';
}

export async function listClasses(db: SQLiteDatabase, kind: ClassKind, today: string): Promise<ClassSummary[]> {
  const rows = await db.getAllAsync<ClassRow & { student_count: number; absent_today: number }>(
    `SELECT c.id, c.name, c.kind, c.created_at,
       (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id) AS student_count,
       (SELECT COUNT(DISTINCT a.student_id) FROM attendance a
          JOIN sessions s ON s.id = a.session_id
          JOIN class_students cs ON cs.class_id = s.class_id AND cs.student_id = a.student_id
        WHERE s.class_id = c.id AND s.date = ?) AS absent_today
     FROM classes c
     WHERE c.kind = ?
     ORDER BY c.name COLLATE NOCASE`,
    today,
    kind
  );
  return rows.map((r) => ({ ...toClassInfo(r), studentCount: r.student_count, absentToday: r.absent_today }));
}

export async function countClasses(db: SQLiteDatabase): Promise<Record<ClassKind, number>> {
  const rows = await db.getAllAsync<{ kind: ClassKind; n: number }>('SELECT kind, COUNT(*) AS n FROM classes GROUP BY kind');
  const counts: Record<ClassKind, number> = { CLASS: 0, SUBJECT: 0 };
  for (const r of rows) counts[r.kind] = r.n;
  return counts;
}

export async function getClass(db: SQLiteDatabase, classId: number): Promise<ClassInfo | null> {
  const row = await db.getFirstAsync<ClassRow>('SELECT id, name, kind, created_at FROM classes WHERE id = ?', classId);
  return row ? toClassInfo(row) : null;
}

function cleanClassName(name: string): string {
  const cleaned = name.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!cleaned) throw new ClassNameError('Enter a name.');
  if (cleaned.length > MAX_CLASS_NAME_LENGTH) throw new ClassNameError(`Keep the name under ${MAX_CLASS_NAME_LENGTH} characters.`);
  return cleaned;
}

async function assertNameFree(db: SQLiteDatabase, name: string, kind: ClassKind, exceptId: number | null): Promise<void> {
  const clash = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM classes WHERE kind = ? AND name = ? COLLATE NOCASE AND id IS NOT ?',
    kind,
    name,
    exceptId
  );
  if (clash) throw new ClassNameError(`You already have a ${kindLabel(kind)} called "${name}".`);
}

/** Creates a class or subject and returns its id. Throws ClassNameError for empty or duplicate names. */
export function createClass(db: SQLiteDatabase, name: string, kind: ClassKind): Promise<number> {
  return serializeWrite(async () => {
    const cleaned = cleanClassName(name);
    await assertNameFree(db, cleaned, kind, null);
    const result = await db.runAsync('INSERT INTO classes (name, kind) VALUES (?, ?)', cleaned, kind);
    return result.lastInsertRowId;
  });
}

export function renameClass(db: SQLiteDatabase, classId: number, name: string): Promise<void> {
  return serializeWrite(async () => {
    const cleaned = cleanClassName(name);
    const current = await getClass(db, classId);
    if (!current) throw new ClassNameError('This class no longer exists.');
    await assertNameFree(db, cleaned, current.kind, classId);
    await db.runAsync('UPDATE classes SET name = ? WHERE id = ?', cleaned, classId);
  });
}

/** What deleting a class would remove, for the confirmation dialog. */
export async function getClassDeletionImpact(db: SQLiteDatabase, classId: number): Promise<{ students: number; absences: number }> {
  const row = await db.getFirstAsync<{ students: number; absences: number }>(
    `SELECT
       (SELECT COUNT(*) FROM class_students WHERE class_id = ?) AS students,
       (SELECT COUNT(*) FROM attendance a JOIN sessions s ON s.id = a.session_id WHERE s.class_id = ?) AS absences`,
    classId,
    classId
  );
  return { students: row?.students ?? 0, absences: row?.absences ?? 0 };
}

/** Deletes the class, its sessions and absences, and its membership links. Students stay in the master list. */
export function deleteClass(db: SQLiteDatabase, classId: number): Promise<void> {
  return serializeWrite(async () => {
    await db.runAsync('DELETE FROM classes WHERE id = ?', classId);
  });
}
