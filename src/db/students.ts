// Student queries: list the roster, upsert by roll number, and soft-delete
// students who are no longer on the roster (keeping their attendance history).

import type { SQLiteDatabase } from 'expo-sqlite';

import { rollKey } from '../utils/roll';
import { serializeWrite } from './writeQueue';

export interface Student {
  id: number;
  rollNo: string;
  name: string;
  active: boolean;
}

export interface RosterEntry {
  rollNo: string;
  name: string;
}

interface StudentRow {
  id: number;
  roll_no: string;
  name: string;
  active: number;
}

/** ORDER BY clause for numeric roll order, so "2" < "10" and "007" sorts as 7. */
export function rollOrder(column = 'roll_no'): string {
  return `CAST(${column} AS INTEGER), ${column}`;
}

export function toStudent(row: StudentRow): Student {
  return { id: row.id, rollNo: row.roll_no, name: row.name, active: row.active === 1 };
}

export async function listActiveStudents(db: SQLiteDatabase): Promise<Student[]> {
  const rows = await db.getAllAsync<StudentRow>(
    `SELECT id, roll_no, name, active FROM students WHERE active = 1 ORDER BY ${rollOrder()}`
  );
  return rows.map(toStudent);
}

export async function countActiveStudents(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM students WHERE active = 1');
  return row?.n ?? 0;
}

/** Active students whose roll numbers are not in `rollNos` (candidates for removal on re-import). */
export async function findActiveStudentsNotIn(db: SQLiteDatabase, rollNos: readonly string[]): Promise<Student[]> {
  const keep = new Set(rollNos.map(rollKey));
  const active = await listActiveStudents(db);
  return active.filter((s) => !keep.has(rollKey(s.rollNo)));
}

/**
 * Inserts new students and updates existing ones, matched by roll number where
 * "7" and "007" are the same student (see rollKey). Matched students take the
 * roll number and name as written in the new file and are reactivated. When
 * `deactivateMissing` is true, active students not in `entries` are soft-deleted.
 * Runs in one transaction, so a failure changes nothing.
 */
export async function saveRoster(
  db: SQLiteDatabase,
  entries: readonly RosterEntry[],
  options: { deactivateMissing: boolean }
): Promise<{ saved: number; deactivated: number }> {
  let deactivated = 0;

  await serializeWrite(() => db.withTransactionAsync(async () => {
    const existing = await db.getAllAsync<StudentRow>('SELECT id, roll_no, name, active FROM students');
    const byText = new Map(existing.map((row) => [row.roll_no, row]));
    const byKey = new Map<string, StudentRow>();
    for (const row of existing) {
      const current = byKey.get(rollKey(row.roll_no));
      if (!current || row.active > current.active) byKey.set(rollKey(row.roll_no), row);
    }

    const seen = new Set<number>();
    for (const entry of entries) {
      // Prefer an exact text match so the UNIQUE(roll_no) constraint can't be hit.
      const match = byText.get(entry.rollNo) ?? byKey.get(rollKey(entry.rollNo));
      if (match) {
        await db.runAsync(
          'UPDATE students SET roll_no = ?, name = ?, active = 1 WHERE id = ?',
          entry.rollNo,
          entry.name,
          match.id
        );
        seen.add(match.id);
        const updated = { ...match, roll_no: entry.rollNo, name: entry.name, active: 1 };
        byText.delete(match.roll_no);
        byText.set(entry.rollNo, updated);
        byKey.set(rollKey(entry.rollNo), updated);
      } else {
        const result = await db.runAsync('INSERT INTO students (roll_no, name, active) VALUES (?, ?, 1)', entry.rollNo, entry.name);
        seen.add(result.lastInsertRowId);
        const inserted = { id: result.lastInsertRowId, roll_no: entry.rollNo, name: entry.name, active: 1 };
        byText.set(entry.rollNo, inserted);
        byKey.set(rollKey(entry.rollNo), inserted);
      }
    }

    if (options.deactivateMissing) {
      const missing = existing.filter((row) => row.active === 1 && !seen.has(row.id));
      for (const row of missing) {
        await db.runAsync('UPDATE students SET active = 0 WHERE id = ?', row.id);
      }
      deactivated = missing.length;
    }
  }));

  return { saved: entries.length, deactivated };
}
