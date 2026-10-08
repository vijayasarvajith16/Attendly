// Builds and shares the absentee list as CSV, plus a short plain-text summary
// for pasting into a message.

import type { Student } from '../db/students';
import { formatDisplayDate } from './dates';
import { shareTextFile } from './shareFile';

/** Quotes a CSV cell, and neutralises leading = + - @ so spreadsheets never run it as a formula. */
function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildAbsenteeCsv(absentees: readonly Student[], date: string, period: number): string {
  const lines = [
    ['Date', 'Period', 'Roll No', 'Name'],
    ...absentees.map((s) => [date, period, s.rollNo, s.name]),
  ].map((row) => row.map(csvCell).join(','));
  // BOM so Excel opens non-English names correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function absenteeFileName(date: string, period: number): string {
  return `absentees_${date}_P${period}.csv`;
}

export async function shareAbsenteeCsv(absentees: readonly Student[], date: string, period: number): Promise<void> {
  await shareTextFile({
    fileName: absenteeFileName(date, period),
    content: buildAbsenteeCsv(absentees, date, period),
    mimeType: 'text/csv',
    uti: 'public.comma-separated-values-text',
    dialogTitle: 'Share absentee list',
  });
}

/**
 * e.g. "Absentees – Thu, 8 Oct 2026, Period 3 (2 of 42):" then one line per student.
 * `total` is the current roster size, so "N of total" counts only current students.
 */
export function buildAbsenteeSummary(absentees: readonly Student[], date: string, period: number, total: number): string {
  const onRoster = absentees.filter((s) => s.active).length;
  const removed = absentees.length - onRoster;
  const extra = removed > 0 ? `, plus ${removed} no longer on the roster` : '';
  const head = `Absentees – ${formatDisplayDate(date)}, Period ${period} (${onRoster} of ${total}${extra})`;
  if (absentees.length === 0) return `${head}: none. Everyone is present.`;
  return `${head}:\n${absentees.map((s) => `${s.rollNo}  ${s.name}`).join('\n')}`;
}
