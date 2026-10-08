// State and actions for the roster import flow: pick → parse → preview/edit →
// save. Screens render from this hook and never touch parsing or SQL directly.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { countActiveStudents, findActiveStudentsNotIn, saveRoster, type Student } from '../db/students';
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
  | { name: 'saved'; count: number; removed: number };

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function friendlyMessage(e: unknown): string {
  if (e instanceof ImportError) return e.message;
  return 'Something went wrong while reading the file. Please try again.';
}

export function useRosterImport() {
  const db = useSQLiteContext();
  const [phase, setPhase] = useState<ImportPhase>({ name: 'idle' });
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [skipped, setSkipped] = useState<SkippedLine[]>([]);
  const [existingCount, setExistingCount] = useState<number | null>(null);
  // Kept here (not in the paste box) so it survives "no students found" and can be fixed.
  const [pasteText, setPasteText] = useState('');

  useEffect(() => {
    countActiveStudents(db)
      .then(setExistingCount)
      .catch(() => setExistingCount(null));
  }, [db]);

  const problems = useMemo(() => validateRoster(rows), [rows]);
  const problemByKey = useMemo(() => new Map(problems.map((p) => [p.key, p.message])), [problems]);
  const duplicateGroups = useMemo(() => findDuplicates(rows), [rows]);
  const duplicateKeys = useMemo(() => new Set([...duplicateGroups.values()].flat()), [duplicateGroups]);

  /**
   * Parses extracted rows (from a file or pasted text) and opens the preview.
   * `displayName` labels the preview; `describedAs` is used inside messages.
   */
  const processRows = useCallback(async (sourceRows: string[][], displayName: string, describedAs: string) => {
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
        message: `No students found in ${describedAs}.${skippedNote}

Each line should start with a roll number followed by a name, for example "12, Asha Kumar".`,
      });
      return;
    }

    setFileName(displayName);
    setRows(result.rows);
    setSkipped(result.skipped);
    setPhase({ name: 'preview' });
  }, []);

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

  const parsePastedText = useCallback(
    async () => {
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
    },
    [pasteText, processRows]
  );

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

  /** Students on the saved roster who are missing from this file. */
  const findRemovals = useCallback(
    (): Promise<Student[]> =>
      findActiveStudentsNotIn(
        db,
        rows.map((r) => cleanRoll(r.rollNo))
      ),
    [db, rows]
  );

  const save = useCallback(
    async (removeMissing: boolean): Promise<void> => {
      if (problems.length > 0 || rows.length === 0) return;
      setPhase({ name: 'working', message: 'Saving roster…', progress: null });
      try {
        const entries = rows.map((r) => ({ rollNo: cleanRoll(r.rollNo), name: cleanName(r.name) }));
        const result = await saveRoster(db, entries, { deactivateMissing: removeMissing });
        successHaptic();
        setExistingCount(await countActiveStudents(db));
        setPhase({ name: 'saved', count: result.saved, removed: result.deactivated });
      } catch {
        warningHaptic();
        setPhase({ name: 'preview' });
        throw new ImportError('The roster could not be saved. Nothing was changed. Please try again.');
      }
    },
    [db, problems.length, rows]
  );

  const reset = useCallback(() => {
    setPasteText('');
    setRows([]);
    setSkipped([]);
    setFileName('');
    setPhase({ name: 'idle' });
  }, []);

  return {
    phase,
    fileName,
    rows,
    skipped,
    existingCount,
    problems,
    problemByKey,
    duplicateKeys,
    duplicateGroupCount: duplicateGroups.size,
    canSave: rows.length > 0 && problems.length === 0,
    pickFile,
    startPaste,
    pasteText,
    setPasteText,
    parsePastedText,
    updateName,
    updateRoll,
    deleteRow,
    keepDuplicate,
    addRow,
    findRemovals,
    save,
    reset,
  };
}
