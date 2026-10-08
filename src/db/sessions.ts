// Session queries. A session is one (date, period) pair; it is created lazily
// the first time a student is marked absent in it.

import type { SQLiteDatabase } from 'expo-sqlite';

export async function findSessionId(db: SQLiteDatabase, date: string, period: number): Promise<number | null> {
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM sessions WHERE date = ? AND period = ?',
    date,
    period
  );
  return row?.id ?? null;
}

/** Returns the session id for (date, period), creating the session if needed. */
export async function ensureSession(db: SQLiteDatabase, date: string, period: number): Promise<number> {
  await db.runAsync('INSERT INTO sessions (date, period) VALUES (?, ?) ON CONFLICT(date, period) DO NOTHING', date, period);
  const id = await findSessionId(db, date, period);
  if (id === null) throw new Error(`Could not create session for ${date} period ${period}`);
  return id;
}
