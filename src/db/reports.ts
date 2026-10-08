// Reports: every absence in a class over a date range, optionally for one
// period, ready to group by date. Only absences are stored, so dates where
// everyone was present (or attendance wasn't taken) don't appear.

import type { SQLiteDatabase } from 'expo-sqlite';

import { rollOrder } from './students';

export interface AbsenceRecord {
  date: string;
  period: number;
  studentId: number;
  rollNo: string;
  name: string;
  /** False if the student has since been removed from the class. */
  inClass: boolean;
}

export async function listAbsencesInRange(
  db: SQLiteDatabase,
  classId: number,
  from: string,
  to: string,
  period: number | null
): Promise<AbsenceRecord[]> {
  const rows = await db.getAllAsync<{ date: string; period: number; student_id: number; roll_no: string; name: string; in_class: number }>(
    `SELECT s.date, s.period, st.id AS student_id, st.roll_no, st.name,
       EXISTS (SELECT 1 FROM class_students cs WHERE cs.class_id = s.class_id AND cs.student_id = st.id) AS in_class
     FROM attendance a
     JOIN sessions s ON s.id = a.session_id
     JOIN students st ON st.id = a.student_id
     WHERE s.class_id = $classId AND s.date BETWEEN $from AND $to
       AND ($period IS NULL OR s.period = $period)
     ORDER BY s.date DESC, s.period, ${rollOrder('st.roll_no')}`,
    { $classId: classId, $from: from, $to: to, $period: period }
  );
  return rows.map((r) => ({
    date: r.date,
    period: r.period,
    studentId: r.student_id,
    rollNo: r.roll_no,
    name: r.name,
    inClass: r.in_class === 1,
  }));
}
