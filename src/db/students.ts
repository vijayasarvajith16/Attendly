// Master student list. Every student has one unique roll number and may belong
// to any number of classes (see classStudents.ts). Students are never deleted
// by roster changes, so attendance history always stays intact.

import type { SQLiteDatabase } from 'expo-sqlite';

import type { ClassKind } from './classes';

export interface Student {
  id: number;
  rollNo: string;
  name: string;
}

export interface StudentWithClasses extends Student {
  classes: { id: number; name: string; kind: ClassKind }[];
}

export interface StudentRow {
  id: number;
  roll_no: string;
  name: string;
}

/** ORDER BY clause for numeric roll order, so "2" < "10" and "007" sorts as 7. */
export function rollOrder(column = 'roll_no'): string {
  return `CAST(${column} AS INTEGER), ${column}`;
}

export function toStudent(row: StudentRow): Student {
  return { id: row.id, rollNo: row.roll_no, name: row.name };
}

export async function listAllStudents(db: SQLiteDatabase): Promise<Student[]> {
  const rows = await db.getAllAsync<StudentRow>(`SELECT id, roll_no, name FROM students ORDER BY ${rollOrder()}`);
  return rows.map(toStudent);
}

/** Students in one class, in numeric roll order. */
export async function listClassStudents(db: SQLiteDatabase, classId: number): Promise<Student[]> {
  const rows = await db.getAllAsync<StudentRow>(
    `SELECT st.id, st.roll_no, st.name FROM students st
     JOIN class_students cs ON cs.student_id = st.id
     WHERE cs.class_id = ?
     ORDER BY ${rollOrder('st.roll_no')}`,
    classId
  );
  return rows.map(toStudent);
}

/** The master list with each student's classes and subjects, for the All Students screen. */
export async function listAllStudentsWithClasses(db: SQLiteDatabase): Promise<StudentWithClasses[]> {
  const [students, links] = await Promise.all([
    listAllStudents(db),
    db.getAllAsync<{ student_id: number; id: number; name: string; kind: ClassKind }>(
      `SELECT cs.student_id, c.id, c.name, c.kind FROM class_students cs
       JOIN classes c ON c.id = cs.class_id
       ORDER BY c.kind, c.name COLLATE NOCASE`
    ),
  ]);
  const byStudent = new Map<number, StudentWithClasses['classes']>();
  for (const link of links) {
    const list = byStudent.get(link.student_id) ?? [];
    list.push({ id: link.id, name: link.name, kind: link.kind });
    byStudent.set(link.student_id, list);
  }
  return students.map((s) => ({ ...s, classes: byStudent.get(s.id) ?? [] }));
}

export async function countStudents(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM students');
  return row?.n ?? 0;
}
