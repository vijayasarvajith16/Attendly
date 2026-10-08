// Session queries. A session is one (class, date, period); it is created
// lazily the first time a student is marked absent in it.

import type { SQLiteDatabase } from 'expo-sqlite';

export async function findSessionId(db: SQLiteDatabase, classId: number, date: string, period: number): Promise<number | null> {
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM sessions WHERE class_id = ? AND date = ? AND period = ?',
    classId,
    date,
    period
  );
  return row?.id ?? null;
}

/** Returns the session id for (class, date, period), creating the session if needed. */
export async function ensureSession(db: SQLiteDatabase, classId: number, date: string, period: number): Promise<number> {
  await db.runAsync(
    'INSERT INTO sessions (class_id, date, period) VALUES (?, ?, ?) ON CONFLICT(class_id, date, period) DO NOTHING',
    classId,
    date,
    period
  );
  const id = await findSessionId(db, classId, date, period);
  if (id === null) throw new Error(`Could not create session for class ${classId} on ${date} period ${period}`);
  return id;
}
