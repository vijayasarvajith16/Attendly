// Attendance queries, all scoped by class. Only absences are stored: a class
// member without a row for a session is present. Marking is idempotent, and
// each mark is written immediately.

import type { SQLiteDatabase } from 'expo-sqlite';

import { ensureSession, findSessionId } from './sessions';
import { rollOrder, toStudent, type Student } from './students';
import { serializeWrite } from './writeQueue';

export interface AbsentStudent extends Student {
  /** False if the student has since been removed from this class (history is kept). */
  inClass: boolean;
}

export function markAbsent(db: SQLiteDatabase, classId: number, date: string, period: number, studentId: number): Promise<void> {
  return serializeWrite(async () => {
    const sessionId = await ensureSession(db, classId, date, period);
    await db.runAsync(
      "INSERT INTO attendance (session_id, student_id, status) VALUES (?, ?, 'ABSENT') ON CONFLICT(session_id, student_id) DO NOTHING",
      sessionId,
      studentId
    );
  });
}

export function markPresent(db: SQLiteDatabase, classId: number, date: string, period: number, studentId: number): Promise<void> {
  return serializeWrite(async () => {
    const sessionId = await findSessionId(db, classId, date, period);
    if (sessionId === null) return;
    await db.runAsync('DELETE FROM attendance WHERE session_id = ? AND student_id = ?', sessionId, studentId);
  });
}

/**
 * Clears the session's absences for current class members ("Mark all
 * present"). Absences of students since removed from the class are history
 * and are kept. Returns how many were cleared.
 */
export function clearAbsences(db: SQLiteDatabase, classId: number, date: string, period: number): Promise<number> {
  return serializeWrite(async () => {
    const sessionId = await findSessionId(db, classId, date, period);
    if (sessionId === null) return 0;
    const result = await db.runAsync(
      'DELETE FROM attendance WHERE session_id = ? AND student_id IN (SELECT student_id FROM class_students WHERE class_id = ?)',
      sessionId,
      classId
    );
    return result.changes;
  });
}

export async function getAbsentStudentIds(db: SQLiteDatabase, classId: number, date: string, period: number): Promise<Set<number>> {
  const rows = await db.getAllAsync<{ student_id: number }>(
    `SELECT a.student_id FROM attendance a
     JOIN sessions s ON s.id = a.session_id
     WHERE s.class_id = ? AND s.date = ? AND s.period = ?`,
    classId,
    date,
    period
  );
  return new Set(rows.map((r) => r.student_id));
}

/** Absentees for a session in numeric roll order, including students since removed from the class. */
export async function listAbsentees(db: SQLiteDatabase, classId: number, date: string, period: number): Promise<AbsentStudent[]> {
  const rows = await db.getAllAsync<{ id: number; roll_no: string; name: string; in_class: number }>(
    `SELECT st.id, st.roll_no, st.name,
       EXISTS (SELECT 1 FROM class_students cs WHERE cs.class_id = s.class_id AND cs.student_id = st.id) AS in_class
     FROM attendance a
     JOIN sessions s ON s.id = a.session_id
     JOIN students st ON st.id = a.student_id
     WHERE s.class_id = ? AND s.date = ? AND s.period = ?
     ORDER BY ${rollOrder('st.roll_no')}`,
    classId,
    date,
    period
  );
  return rows.map((r) => ({ ...toStudent(r), inClass: r.in_class === 1 }));
}

/** Dates between `from` and `to` (inclusive) with at least one absence in this class. */
export async function listDatesWithAbsences(db: SQLiteDatabase, classId: number, from: string, to: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT DISTINCT s.date FROM sessions s
     WHERE s.class_id = ? AND s.date BETWEEN ? AND ?
       AND EXISTS (SELECT 1 FROM attendance a WHERE a.session_id = s.id)`,
    classId,
    from,
    to
  );
  return new Set(rows.map((r) => r.date));
}
