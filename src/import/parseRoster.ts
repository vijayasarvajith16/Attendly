// Turns extracted file rows into roster rows ({ rollNo, name }) plus a list of
// skipped lines. Handles header rows ("Roll No, Name"), serial-number columns,
// and free-text lines like "12. Asha", "007: James", "21CS045 - Priya".

import { rollKey } from '../utils/roll';
import type { ParseResult, RosterRow } from './types';

const MAX_ROLL_LENGTH = 20;
const MAX_NAME_LENGTH = 100;
const CHUNK_SIZE = 500;

/** Rows above this count are parsed in chunks with progress updates. */
export const LARGE_FILE_ROWS = 1000;

let manualKeyCounter = 0;

export function newRowKey(): string {
  manualKeyCounter += 1;
  return `manual-${Date.now()}-${manualKeyCounter}`;
}

// ---------- token helpers ----------

/** Strips list punctuation around a roll number: "12." → "12", "(7)" → "7". */
export function cleanRoll(value: string): string {
  return value.trim().replace(/^[(#[]+/, '').replace(/[.):\]]+$/, '').trim();
}

/** A roll number is one word of letters/digits/-/_// that contains at least one digit. */
export function isRollNo(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_ROLL_LENGTH &&
    /^[A-Za-z0-9][A-Za-z0-9\-/_]*$/.test(value) &&
    /\d/.test(value)
  );
}

function hasLetter(value: string): boolean {
  return /\p{L}/u.test(value);
}

export function cleanName(value: string): string {
  return value
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,:;|\-–—]+|[\s.,:;|\-–—]+$/g, '')
    .slice(0, MAX_NAME_LENGTH)
    .trim();
}

function isNameCell(value: string): boolean {
  return hasLetter(value) && !isRollNo(cleanRoll(value));
}

// ---------- header detection ----------

interface ColumnMap {
  rollCol: number;
  nameCols: number[];
}

const ROLL_HEADER = /\b(roll|reg(istration|ister)?|admission|adm|enrol(l)?(ment)?|student\s*id|id)\b/i;
const SERIAL_HEADER = /^(s|sl|sr)\.?\s*(no|num|number)\.?$|^#$|^serial/i;
// Whole word only, so names like "Namesh" aren't mistaken for a header.
const NAME_HEADER = /(^|[^a-z])names?([^a-z]|$)/i;

function looksLikeHeader(cells: string[]): boolean {
  const text = cells.join(' ');
  const hasRollValue = cells.some((c) => isRollNo(cleanRoll(c)));
  return !hasRollValue && NAME_HEADER.test(text) && (ROLL_HEADER.test(text) || cells.length >= 2);
}

function detectColumns(cells: string[]): ColumnMap | null {
  const lower = cells.map((c) => c.trim().toLowerCase());
  const rollCol =
    lower.findIndex((c) => /roll/.test(c)) >= 0
      ? lower.findIndex((c) => /roll/.test(c))
      : lower.findIndex((c) => ROLL_HEADER.test(c) && !SERIAL_HEADER.test(c));
  if (rollCol < 0) return null;

  const first = lower.findIndex((c) => /first\s*name/.test(c));
  const last = lower.findIndex((c) => /(last\s*name|surname)/.test(c));
  if (first >= 0 && last >= 0) return { rollCol, nameCols: [first, last] };

  const nameCol = lower.findIndex((c, i) => i !== rollCol && NAME_HEADER.test(c));
  return nameCol >= 0 ? { rollCol, nameCols: [nameCol] } : null;
}

// ---------- row parsing ----------

type RowOutcome = { rollNo: string; name: string } | { skip: string } | 'ignore';

function fromColumns(cells: string[], map: ColumnMap): { rollNo: string; name: string } | null {
  const rollNo = cleanRoll(cells[map.rollCol] ?? '');
  const name = cleanName(map.nameCols.map((i) => cells[i] ?? '').filter(Boolean).join(' '));
  return isRollNo(rollNo) && hasLetter(name) ? { rollNo, name } : null;
}

/**
 * Multi-cell row: the name is the first cell with letters; the roll number is
 * the last roll-like cell before it (so a leading serial-number column is skipped).
 */
function fromCells(cells: string[]): { rollNo: string; name: string } | null {
  const nameIndex = cells.findIndex(isNameCell);
  if (nameIndex <= 0) return null;
  for (let i = nameIndex - 1; i >= 0; i--) {
    const rollNo = cleanRoll(cells[i]);
    if (isRollNo(rollNo)) return { rollNo, name: cleanName(cells[nameIndex]) };
  }
  return null;
}

// "<roll><separator><name>", separator being . , : ) - – or whitespace/tab.
const LINE_PATTERN = /^\s*[(#]?([A-Za-z0-9][A-Za-z0-9\-/_]*)\s*(?:[.,:)\-–—]\s*|\s+)(.+)$/u;

function fromLine(line: string): { rollNo: string; name: string } | null {
  // Tab, pipe or semicolon separated lines are really table rows.
  if (/[\t|;]/.test(line)) {
    const cells = line.split(/[\t|;]/).map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 2) return fromCells(cells);
  }

  const match = LINE_PATTERN.exec(line);
  if (!match || !isRollNo(match[1])) return null;
  let rollNo = match[1];
  let rest = match[2];

  // "1. 21CS045 Asha": a serial number followed by the real roll number.
  const inner = LINE_PATTERN.exec(rest);
  if (inner && isRollNo(inner[1]) && hasLetter(inner[2])) {
    rollNo = inner[1];
    rest = inner[2];
  }

  const name = cleanName(rest);
  return hasLetter(name) ? { rollNo, name } : null;
}

function parseRow(rawCells: string[], columns: ColumnMap | null): RowOutcome {
  const cells = rawCells.map((c) => String(c ?? '').trim());
  const nonEmpty = cells.filter(Boolean);
  if (nonEmpty.length === 0) return 'ignore';

  // With a header, trust its columns: never guess a serial number as the roll.
  if (columns && nonEmpty.length >= 2) {
    return fromColumns(cells, columns) ?? { skip: 'Roll number or name is missing' };
  }

  const parsed = nonEmpty.length >= 2 ? fromCells(nonEmpty) : fromLine(nonEmpty[0]);
  if (parsed) return parsed;

  if (looksLikeHeader(nonEmpty)) return 'ignore';
  if (!/\d/.test(nonEmpty.join(' '))) return { skip: 'No roll number' };
  return { skip: 'Expected a roll number followed by a name' };
}

// ---------- public API ----------

interface Cursor {
  columns: ColumnMap | null;
  seenData: boolean;
}

function parseInto(rows: string[][], start: number, end: number, cursor: Cursor, out: ParseResult): void {
  for (let i = start; i < end; i++) {
    const cells = rows[i];
    const nonEmpty = cells.map((c) => String(c ?? '').trim()).filter(Boolean);

    // A header row before any data sets the column mapping (e.g. "S.No | Roll No | Name").
    if (!cursor.seenData && nonEmpty.length > 0 && looksLikeHeader(nonEmpty)) {
      cursor.columns = detectColumns(cells.map((c) => String(c ?? '')));
      continue;
    }

    const outcome = parseRow(cells, cursor.columns);
    if (outcome === 'ignore') continue;
    if ('skip' in outcome) {
      out.skipped.push({ line: i + 1, text: nonEmpty.join('  ').slice(0, 120), reason: outcome.skip });
      continue;
    }
    cursor.seenData = true;
    out.rows.push({ key: `row-${i + 1}`, rollNo: outcome.rollNo, name: outcome.name, sourceLine: i + 1 });
  }
}

export function parseRoster(rows: string[][]): ParseResult {
  const out: ParseResult = { rows: [], skipped: [] };
  parseInto(rows, 0, rows.length, { columns: null, seenData: false }, out);
  return out;
}

/** Same as parseRoster, but yields to the UI between chunks and reports progress (0..1). */
export async function parseRosterAsync(rows: string[][], onProgress?: (fraction: number) => void): Promise<ParseResult> {
  const out: ParseResult = { rows: [], skipped: [] };
  const cursor: Cursor = { columns: null, seenData: false };
  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    parseInto(rows, start, Math.min(rows.length, start + CHUNK_SIZE), cursor, out);
    onProgress?.(Math.min(1, (start + CHUNK_SIZE) / rows.length));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return out;
}

/** Splits plain text into single-cell rows, one per line. */
export function textToRows(text: string): string[][] {
  return text
    .replace(/^﻿/, '')
    .split(/\r\n|\r|\n/)
    .map((line) => [line]);
}

// ---------- validation ----------

/** Groups of row keys that share a roll number (only groups with 2+ rows). */
export function findDuplicates(rows: readonly RosterRow[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const key = rollKey(row.rollNo);
    groups.set(key, [...(groups.get(key) ?? []), row.key]);
  }
  for (const [key, keys] of groups) {
    if (keys.length < 2) groups.delete(key);
  }
  return groups;
}

export interface RosterProblem {
  key: string;
  message: string;
}

/** Everything that must be fixed before the roster can be saved. */
export function validateRoster(rows: readonly RosterRow[]): RosterProblem[] {
  const problems: RosterProblem[] = [];
  for (const row of rows) {
    if (!isRollNo(cleanRoll(row.rollNo))) problems.push({ key: row.key, message: 'Invalid roll number' });
    else if (!cleanName(row.name)) problems.push({ key: row.key, message: 'Name is empty' });
  }
  for (const keys of findDuplicates(rows).values()) {
    for (const key of keys) problems.push({ key, message: 'Duplicate roll number' });
  }
  return problems;
}
