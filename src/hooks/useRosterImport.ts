// State and actions for importing a roster into one class: pick → parse →
// preview/edit → save. The preview matches each row against the master list
// (new student, existing student, or name conflict) and saving either adds to
// the class or replaces its list. Screens never touch parsing or SQL directly.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';

import { getClass } from '../db/classes';
import { importToClass, nameKey, type ClassImportResult, type ImportMode } from '../db/classStudents';
import { listAllStudents, listClassStudents, type Student } from '../db/students';
import {
  LARGE_FILE_ROWS,
  cleanName,
  cleanRoll,
  findDuplicates,
  isRollNo,
  newRowKey,
  parseRoster,
  parseRosterAsync,
  textToRows,
  validateRoster,
} from '../import/parseRoster';
import { pickRosterFile } from '../import/pickFile';
import { ImportError, type ImportErrorCode, type RosterRow, type SkippedLine } from '../import/types';
import { successHaptic, tapHaptic, warningHaptic } from '../utils/haptics';
import { rollKey } from '../utils/roll';

export type ImportPhase =
  | { name: 'idle' }
  | { name: 'working'; message: string; progress: number | null }
  | { name: 'error'; message: string; code?: ImportErrorCode }
  | { name: 'paste' }
  | { name: 'preview' }
  | { name: 'saved'; result: ClassImportResult; mode: ImportMode };

/** How a preview row relates to the master student list. */
export type RowMatch =
  | { kind: 'new' }
  | { kind: 'existing'; studentId: number; inClass: boolean }
  | { kind: 'conflict'; studentId: number; inClass: boolean; existingName: string; useNewName: boolean };

export interface MatchSummary {
  new: number;
  existing: number;
  conflicts: number;
  alreadyInClass: number;
}

interface ClassSnapshot {
  className: string;
  master: Student[];
  members: Student[];
}

async function fetchSnapshot(db: SQLiteDatabase, classId: number): Promise<ClassSnapshot> {
  const [info, master, members] = await Promise.all([getClass(db, classId), listAllStudents(db), listClassStudents(db, classId)]);
  return { className: info?.name ?? 'this class', master, members };
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function friendlyMessage(e: unknown): string {
  if (e instanceof ImportError) return e.message;
  return 'Something went wrong while reading the file. Please try again.';
}

export function useRosterImport(classId: number) {
  const db = useSQLiteContext();
  const [phase, setPhase] = useState<ImportPhase>({ name: 'idle' });
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [skipped, setSkipped] = useState<SkippedLine[]>([]);
  const [snapshot, setSnapshot] = useState<ClassSnapshot | null>(null);
  /** Row keys whose conflicting name should replace the stored name. */
  const [useNewNameKeys, setUseNewNameKeys] = useState<ReadonlySet<string>>(new Set());
  // Kept here (not in the paste box) so it survives "no students found" and can be fixed.
  const [pasteText, setPasteText] = useState('');

  const loadSnapshot = useCallback(async () => {
    setSnapshot(await fetchSnapshot(db, classId));
  }, [db, classId]);

  useEffect(() => {
    let cancelled = false;
    fetchSnapshot(db, classId)
      .then((s) => {
        if (!cancelled) setSnapshot(s);
      })
      .catch(() => undefined); // preview stays unavailable; saving is disabled without a snapshot
    return () => {
      cancelled = true;
    };
  }, [db, classId]);

  const problems = useMemo(() => validateRoster(rows), [rows]);
  const problemByKey = useMemo(() => new Map(problems.map((p) => [p.key, p.message])), [problems]);
  const duplicateGroups = useMemo(() => findDuplicates(rows), [rows]);
  const duplicateKeys = useMemo(() => new Set([...duplicateGroups.values()].flat()), [duplicateGroups]);

  // ---------- matching against the master list ----------

  const matches = useMemo(() => {
    const result = new Map<string, RowMatch>();
    if (!snapshot) return result;
    const byKey = new Map(snapshot.master.map((s) => [rollKey(s.rollNo), s]));
    const memberIds = new Set(snapshot.members.map((s) => s.id));
    for (const row of rows) {
      const student = byKey.get(rollKey(row.rollNo));
      if (!student) {
        result.set(row.key, { kind: 'new' });
      } else if (nameKey(student.name) === nameKey(cleanName(row.name))) {
        result.set(row.key, { kind: 'existing', studentId: student.id, inClass: memberIds.has(student.id) });
      } else {
        result.set(row.key, {
          kind: 'conflict',
          studentId: student.id,
          inClass: memberIds.has(student.id),
          existingName: student.name,
          useNewName: useNewNameKeys.has(row.key),
        });
      }
    }
    return result;
  }, [rows, snapshot, useNewNameKeys]);

  const summary = useMemo<MatchSummary>(() => {
    const s: MatchSummary = { new: 0, existing: 0, conflicts: 0, alreadyInClass: 0 };
    for (const match of matches.values()) {
      if (match.kind === 'new') s.new += 1;
      else {
        if (match.kind === 'existing') s.existing += 1;
        else s.conflicts += 1;
        if (match.inClass) s.alreadyInClass += 1;
      }
    }
    return s;
  }, [matches]);

  /** Current class members not in this list: "Replace class list" unlinks them. */
  const replaceRemovals = useMemo(() => {
    if (!snapshot) return [];
    const matched = new Set<number>();
    for (const match of matches.values()) if (match.kind !== 'new') matched.add(match.studentId);
    return snapshot.members.filter((s) => !matched.has(s.id));
  }, [matches, snapshot]);

  const toggleUseNewName = useCallback((key: string) => {
    tapHaptic();
    setUseNewNameKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ---------- reading input ----------

  /**
   * Parses extracted rows (from a file or pasted text) and opens the preview.
   * `displayName` labels the preview; `describedAs` is used inside messages.
   */
  const processRows = useCallback(
    async (sourceRows: string[][], displayName: string, describedAs: string) => {
      const large = sourceRows.length > LARGE_FILE_ROWS;
      const message = `Finding students in ${describedAs}…`;
      setPhase({ name: 'working', message, progress: large ? 0 : null });
      await nextFrame();

      const result = large
        ? await parseRosterAsync(sourceRows, (progress) => setPhase({ name: 'working', message, progress }))
        : parseRoster(sourceRows);

      if (result.rows.length === 0) {
        warningHaptic();
        const skippedNote = result.skipped.length > 0 ? ` ${result.skipped.length} lines could not be read.` : '';
        setPhase({
          name: 'error',
          message: `No students found in ${describedAs}.${skippedNote}\n\nEach line should start with a roll number followed by a name, for example "12, Asha Kumar".`,
        });
        return;
      }

      await loadSnapshot(); // match against the latest master list
      setFileName(displayName);
      setRows(result.rows);
      setSkipped(result.skipped);
      setUseNewNameKeys(new Set());
      setPhase({ name: 'preview' });
    },
    [loadSnapshot]
  );

  const pickFile = useCallback(async () => {
    try {
      const extracted = await pickRosterFile((name) => {
        setPhase({ name: 'working', message: `Reading ${name}…`, progress: null });
      });
      if (!extracted) return; // cancelled: stay where we were
      await processRows(extracted.rows, extracted.fileName, `"${extracted.fileName}"`);
    } catch (e) {
      warningHaptic();
      setPhase({ name: 'error', message: friendlyMessage(e), code: e instanceof ImportError ? e.code : undefined });
    }
  }, [processRows]);

  /** Opens the paste box (e.g. for a list copied out of a PDF). */
  const startPaste = useCallback(() => setPhase({ name: 'paste' }), []);

  const parsePastedText = useCallback(async () => {
    const text = pasteText;
    if (!text.trim()) {
      setPhase({ name: 'error', message: 'Nothing was pasted. Copy the student list first, then paste it into the box.' });
      return;
    }
    try {
      await processRows(textToRows(text), 'Pasted list', 'the pasted list');
    } catch (e) {
      warningHaptic();
      setPhase({ name: 'error', message: friendlyMessage(e) });
    }
  }, [pasteText, processRows]);

  // ---------- editing the preview ----------

  const updateName = useCallback((key: string, name: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, name } : r)));
  }, []);

  const updateRoll = useCallback((key: string, rollNo: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, rollNo: rollNo.trim() } : r)));
  }, []);

  const deleteRow = useCallback((key: string) => {
    tapHaptic();
    setRows((prev) => prev.filter((r) => r.key !== key));
  }, []);

  /** Keeps this row and deletes every other row with the same roll number. */
  const keepDuplicate = useCallback((key: string) => {
    tapHaptic();
    setRows((prev) => {
      const target = prev.find((r) => r.key === key);
      if (!target) return prev;
      const targetKey = rollKey(target.rollNo);
      return prev.filter((r) => r.key === key || rollKey(r.rollNo) !== targetKey);
    });
  }, []);

  /** Adds a student by hand. Returns an error message, or null on success. */
  const addRow = useCallback(
    (rollInput: string, nameInput: string): string | null => {
      const rollNo = cleanRoll(rollInput);
      const name = cleanName(nameInput);
      if (!isRollNo(rollNo)) return 'Enter a roll number (letters and digits, no spaces).';
      if (!name) return 'Enter the student’s name.';
      if (rows.some((r) => rollKey(r.rollNo) === rollKey(rollNo))) {
        return `Roll number ${rollNo} is already in the list.`;
      }
      tapHaptic();
      setRows((prev) => [{ key: newRowKey(), rollNo, name }, ...prev]);
      return null;
    },
    [rows]
  );

  // ---------- saving ----------

  const save = useCallback(
    async (mode: ImportMode): Promise<void> => {
      if (problems.length > 0 || rows.length === 0) return;
      setPhase({ name: 'working', message: mode === 'replace' ? 'Replacing class list…' : 'Adding to class…', progress: null });
      try {
        const entries = rows.map((r) => ({
          rollNo: cleanRoll(r.rollNo),
          name: cleanName(r.name),
          useNewName: useNewNameKeys.has(r.key),
        }));
        const result = await importToClass(db, classId, entries, mode);
        successHaptic();
        await loadSnapshot().catch(() => undefined);
        setPhase({ name: 'saved', result, mode });
      } catch {
        warningHaptic();
        setPhase({ name: 'preview' });
        throw new ImportError('The list could not be saved. Nothing was changed. Please try again.');
      }
    },
    [db, classId, problems.length, rows, useNewNameKeys, loadSnapshot]
  );

  const reset = useCallback(() => {
    setPasteText('');
    setRows([]);
    setSkipped([]);
    setFileName('');
    setUseNewNameKeys(new Set());
    setPhase({ name: 'idle' });
  }, []);

  return {
    phase,
    fileName,
    rows,
    skipped,
    className: snapshot?.className ?? null,
    classSize: snapshot?.members.length ?? 0,
    problems,
    problemByKey,
    duplicateKeys,
    duplicateGroupCount: duplicateGroups.size,
    matches,
    summary,
    replaceRemovals,
    canSave: rows.length > 0 && problems.length === 0 && snapshot !== null,
    pickFile,
    startPaste,
    pasteText,
    setPasteText,
    parsePastedText,
    updateName,
    updateRoll,
    deleteRow,
    keepDuplicate,
    toggleUseNewName,
    addRow,
    save,
    reset,
  };
}
