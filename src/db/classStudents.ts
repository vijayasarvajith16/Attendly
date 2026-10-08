// Class membership: importing a roster into a class (add or replace), adding
// one student by hand, and removing a student from a class. These only change
// students and class_students links; attendance history is never touched.

import type { SQLiteDatabase } from 'expo-sqlite';

import { rollKey } from '../utils/roll';
import type { StudentRow } from './students';
import { serializeWrite } from './writeQueue';

export type ImportMode = 'add' | 'replace';

export interface ClassImportEntry {
  rollNo: string;
  name: string;
  /** For an existing student whose name differs: true to overwrite the stored name. */
  useNewName: boolean;
}

export interface ClassImportResult {
  /** Students created in the master list. */
  created: number;
  /** Students newly linked to the class (new or existing). */
  linked: number;
  /** Existing students whose name was updated. */
  renamed: number;
  /** Students unlinked from the class by "Replace class list". */
  unlinked: number;
}

/** Comparable form of a name: case, spacing and Unicode form don't count as differences. */
export function nameKey(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

/**
 * Imports a roster into a class in one transaction.
 * - New roll numbers create master students; existing ones (matched by
 *   rollKey, so "7" = "007") keep their roll text and, unless `useNewName`,
 *   their name.
 * - Every entry is linked to the class.
 * - "replace" also unlinks class members missing from the entries. Students
 *   and their attendance are never deleted.
 */
export function importToClass(
  db: SQLiteDatabase,
  classId: number,
  entries: readonly ClassImportEntry[],
  mode: ImportMode
): Promise<ClassImportResult> {
  return serializeWrite(async () => {
    const result: ClassImportResult = { created: 0, linked: 0, renamed: 0, unlinked: 0 };

    await db.withTransactionAsync(async () => {
      const existing = await db.getAllAsync<StudentRow>('SELECT id, roll_no, name FROM students');
      const byText = new Map(existing.map((row) => [row.roll_no, row]));
      const byKey = new Map(existing.map((row) => [rollKey(row.roll_no), row]));
      const keep = new Set<number>();

      for (const entry of entries) {
        let student = byText.get(entry.rollNo) ?? byKey.get(rollKey(entry.rollNo));
        if (student) {
          if (entry.useNewName && nameKey(student.name) !== nameKey(entry.name)) {
            await db.runAsync('UPDATE students SET name = ? WHERE id = ?', entry.name, student.id);
            student = { ...student, name: entry.name };
            result.renamed += 1;
          }
        } else {
          const inserted = await db.runAsync('INSERT INTO students (roll_no, name) VALUES (?, ?)', entry.rollNo, entry.name);
          student = { id: inserted.lastInsertRowId, roll_no: entry.rollNo, name: entry.name };
          result.created += 1;
        }
        byText.set(student.roll_no, student);
        byKey.set(rollKey(student.roll_no), student);

        if (keep.has(student.id)) continue; // two entries resolved to the same student
        keep.add(student.id);
        const link = await db.runAsync(
          'INSERT INTO class_students (class_id, student_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
          classId,
          student.id
        );
        result.linked += link.changes;
      }

      if (mode === 'replace') {
        const members = await db.getAllAsync<{ student_id: number }>('SELECT student_id FROM class_students WHERE class_id = ?', classId);
        for (const { student_id } of members) {
          if (keep.has(student_id)) continue;
          await db.runAsync('DELETE FROM class_students WHERE class_id = ? AND student_id = ?', classId, student_id);
          result.unlinked += 1;
        }
      }
    });

    return result;
  });
}

export interface AddToClassResult {
  /**
   * created: new student added to the master list and the class.
   * linked: an existing student (same roll and name) was added to the class.
   * alreadyInClass: nothing changed.
   * nameMismatch: the roll number belongs to a student with a different name; nothing changed.
   */
  status: 'created' | 'linked' | 'alreadyInClass' | 'nameMismatch';
  studentId: number;
  /** Roll number and name as stored (may differ from what was typed, e.g. "007" vs "7"). */
  rollNo: string;
  name: string;
}

/**
 * Adds one student to a class, creating them in the master list if the roll
 * number is new. An existing roll number is only linked when the name matches,
 * so a typo never silently adds a different student. Runs in one transaction.
 */
export function addStudentToClass(db: SQLiteDatabase, classId: number, rollNo: string, name: string): Promise<AddToClassResult> {
  return serializeWrite(async () => {
    let result: AddToClassResult | null = null;
    await db.withTransactionAsync(async () => {
      const all = await db.getAllAsync<StudentRow>('SELECT id, roll_no, name FROM students');
      const match = all.find((s) => s.roll_no === rollNo) ?? all.find((s) => rollKey(s.roll_no) === rollKey(rollNo));
      if (match) {
        const stored = { studentId: match.id, rollNo: match.roll_no, name: match.name };
        const inClass = await db.getFirstAsync('SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?', classId, match.id);
        if (inClass) {
          result = { status: 'alreadyInClass', ...stored };
        } else if (nameKey(match.name) !== nameKey(name)) {
          result = { status: 'nameMismatch', ...stored };
        } else {
          await db.runAsync('INSERT INTO class_students (class_id, student_id) VALUES (?, ?)', classId, match.id);
          result = { status: 'linked', ...stored };
        }
        return;
      }
      const studentId = (await db.runAsync('INSERT INTO students (roll_no, name) VALUES (?, ?)', rollNo, name)).lastInsertRowId;
      await db.runAsync('INSERT INTO class_students (class_id, student_id) VALUES (?, ?)', classId, studentId);
      result = { status: 'created', studentId, rollNo, name };
    });
    if (!result) throw new Error('addStudentToClass finished without a result');
    return result;
  });
}

/** Unlinks a student from one class. The student and all attendance history are kept. */
export function removeStudentFromClass(db: SQLiteDatabase, classId: number, studentId: number): Promise<void> {
  return serializeWrite(async () => {
    await db.runAsync('DELETE FROM class_students WHERE class_id = ? AND student_id = ?', classId, studentId);
  });
}
