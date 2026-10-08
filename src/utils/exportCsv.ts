// Builds and shares CSV files (a session's absentees, or a class report over a
// date range), plus a short plain-text absentee summary for messaging apps.

import type { AbsentStudent } from '../db/attendance';
import type { AbsenceRecord } from '../db/reports';
import { formatDisplayDate } from './dates';
import { shareTextFile } from './shareFile';

/** Quotes a CSV cell, and neutralises leading = + - @ so spreadsheets never run it as a formula. */
function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  // BOM so Excel opens non-English names correctly.
  return `﻿${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** Filename-safe version of a class name: "Class 10-A" → "class-10-a". */
export function fileSlug(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'class';
}

// ---------- one session's absentees ----------

export function buildAbsenteeCsv(absentees: readonly AbsentStudent[], className: string, date: string, period: number): string {
  return toCsv([['Class', 'Date', 'Period', 'Roll No', 'Name'], ...absentees.map((s) => [className, date, period, s.rollNo, s.name])]);
}

export function absenteeFileName(className: string, date: string, period: number): string {
  return `absentees_${fileSlug(className)}_${date}_P${period}.csv`;
}

export async function shareAbsenteeCsv(absentees: readonly AbsentStudent[], className: string, date: string, period: number): Promise<void> {
  await shareTextFile({
    fileName: absenteeFileName(className, date, period),
    content: buildAbsenteeCsv(absentees, className, date, period),
    mimeType: 'text/csv',
    uti: 'public.comma-separated-values-text',
    dialogTitle: 'Share absentee list',
  });
}

/**
 * e.g. "Class 10-A – absentees, Thu, 8 Oct 2026, Period 3 (2 of 42):" then one
 * line per student. `total` is the class size, so "N of total" counts only
 * current class members.
 */
export function buildAbsenteeSummary(absentees: readonly AbsentStudent[], className: string, date: string, period: number, total: number): string {
  const inClass = absentees.filter((s) => s.inClass).length;
  const removed = absentees.length - inClass;
  const extra = removed > 0 ? `, plus ${removed} no longer in this class` : '';
  const head = `${className} – absentees, ${formatDisplayDate(date)}, Period ${period} (${inClass} of ${total}${extra})`;
  if (absentees.length === 0) return `${head}: none. Everyone is present.`;
  return `${head}:\n${absentees.map((s) => `${s.rollNo}  ${s.name}`).join('\n')}`;
}

// ---------- class report over a date range ----------

export function buildReportCsv(records: readonly AbsenceRecord[], className: string): string {
  return toCsv([['Class', 'Date', 'Period', 'Roll No', 'Name'], ...records.map((r) => [className, r.date, r.period, r.rollNo, r.name])]);
}

export function reportFileName(className: string, from: string, to: string, period: number | null): string {
  const periodPart = period === null ? '' : `_P${period}`;
  return `report_${fileSlug(className)}_${from}_to_${to}${periodPart}.csv`;
}

export async function shareReportCsv(
  records: readonly AbsenceRecord[],
  className: string,
  from: string,
  to: string,
  period: number | null
): Promise<void> {
  await shareTextFile({
    fileName: reportFileName(className, from, to, period),
    content: buildReportCsv(records, className),
    mimeType: 'text/csv',
    uti: 'public.comma-separated-values-text',
    dialogTitle: 'Share attendance report',
  });
}
