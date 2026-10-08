// Date helpers. Sessions are keyed by local calendar dates as 'YYYY-MM-DD'
// strings, so a date never shifts because of timezone conversion.

import { addDays, format, isValid, parse } from 'date-fns';

const ISO_FORMAT = 'yyyy-MM-dd';

export function toISODate(date: Date): string {
  return format(date, ISO_FORMAT);
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Parses 'YYYY-MM-DD' as a local date; returns null if invalid. */
export function parseISODate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = parse(value, ISO_FORMAT, new Date());
  return isValid(date) ? date : null;
}

export function isISODate(value: unknown): value is string {
  return typeof value === 'string' && parseISODate(value) !== null;
}

export function shiftISODate(value: string, days: number): string {
  const date = parseISODate(value) ?? new Date();
  return toISODate(addDays(date, days));
}

/** e.g. "Thu, 8 Oct 2026" */
export function formatDisplayDate(value: string): string {
  const date = parseISODate(value);
  return date ? format(date, 'EEE, d MMM yyyy') : value;
}

/** e.g. "Thu, 8 Oct" */
export function formatShortDate(value: string): string {
  const date = parseISODate(value);
  return date ? format(date, 'EEE, d MMM') : value;
}
