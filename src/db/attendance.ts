// Attendance queries. Only absences are stored: a student without a row for a
// session is present. Marking is idempotent, and each mark is written immediately.

import type { SQLiteDatabase } from 'expo-sqlite';

import { ensureSession, findSessionId } from './sessions';
import { rollOrder, toStudent, type Student } from './students';
import { serializeWrite } from './writeQueue';

export function markAbsent(db: SQLiteDatabase, date: string, period: number, studentId: number): Promise<void> {
  return serializeWrite(async () => {
    const sessionId = await ensureSession(db, date, period);
    await db.runAsync(
      "INSERT INTO attendance (session_id, student_id, status) VALUES (?, ?, 'ABSENT') ON CONFLICT(session_id, student_id) DO NOTHING",
      sessionId,
      studentId
    );
  });
}

export function markPresent(db: SQLiteDatabase, date: string, period: number, studentId: number): Promise<void> {
  return serializeWrite(async () => {
    const sessionId = await findSessionId(db, date, period);
    if (sessionId === null) return;
    await db.runAsync('DELETE FROM attendance WHERE session_id = ? AND student_id = ?', sessionId, studentId);
  });
}

/**
 * Clears the session's absences for students on the current roster ("Mark all
 * present"). Absences of students since removed from the roster are history and
 * are kept. Returns how many were cleared.
 */
export function clearAbsences(db: SQLiteDatabase, date: string, period: number): Promise<number> {
  return serializeWrite(async () => {
    const sessionId = await findSessionId(db, date, period);
    if (sessionId === null) return 0;
    const result = await db.runAsync(
      'DELETE FROM attendance WHERE session_id = ? AND student_id IN (SELECT id FROM students WHERE active = 1)',
      sessionId
    );
    return result.changes;
  });
}

export async function getAbsentStudentIds(db: SQLiteDatabase, date: string, period: number): Promise<Set<number>> {
  const rows = await db.getAllAsync<{ student_id: number }>(
    `SELECT a.student_id FROM attendance a
     JOIN sessions s ON s.id = a.session_id
     WHERE s.date = ? AND s.period = ?`,
    date,
    period
  );
  return new Set(rows.map((r) => r.student_id));
}

/**
 * Absentees for a session in numeric roll order. Includes students who have
 * since been removed from the roster, so past records stay accurate.
 */
export async function listAbsentees(db: SQLiteDatabase, date: string, period: number): Promise<Student[]> {
  const rows = await db.getAllAsync<{ id: number; roll_no: string; name: string; active: number }>(
    `SELECT st.id, st.roll_no, st.name, st.active FROM attendance a
     JOIN sessions s ON s.id = a.session_id
     JOIN students st ON st.id = a.student_id
     WHERE s.date = ? AND s.period = ?
     ORDER BY ${rollOrder('st.roll_no')}`,
    date,
    period
  );
  return rows.map(toStudent);
}

/** Dates between `from` and `to` (inclusive, 'YYYY-MM-DD') that have at least one absence. */
export async function listDatesWithAbsences(db: SQLiteDatabase, from: string, to: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT DISTINCT s.date FROM sessions s
     WHERE s.date BETWEEN ? AND ?
       AND EXISTS (SELECT 1 FROM attendance a WHERE a.session_id = s.id)`,
    from,
    to
  );
  return new Set(rows.map((r) => r.date));
}
