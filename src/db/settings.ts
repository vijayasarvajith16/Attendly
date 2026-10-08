// App settings stored as key/value rows in SQLite (no AsyncStorage needed).

import type { SQLiteDatabase } from 'expo-sqlite';

import { serializeWrite } from './writeQueue';

export const DEFAULT_PERIODS_PER_DAY = 8;
export const MIN_PERIODS_PER_DAY = 1;
export const MAX_PERIODS_PER_DAY = 12;

const PERIODS_KEY = 'periods_per_day';

export function clampPeriods(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PERIODS_PER_DAY;
  return Math.min(MAX_PERIODS_PER_DAY, Math.max(MIN_PERIODS_PER_DAY, Math.round(value)));
}

export async function getPeriodsPerDay(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', PERIODS_KEY);
  return row ? clampPeriods(Number(row.value)) : DEFAULT_PERIODS_PER_DAY;
}

export async function setPeriodsPerDay(db: SQLiteDatabase, periods: number): Promise<number> {
  const value = clampPeriods(periods);
  await serializeWrite(() =>
    db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      PERIODS_KEY,
      String(value)
    )
  );
  return value;
}
