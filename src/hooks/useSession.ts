// Loads the roster and the absences for one (date, period) session, and marks
// students absent/present. Updates are optimistic (the UI changes instantly)
// and each change is written to SQLite immediately; failures roll back.

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { clearAbsences, getAbsentStudentIds, markAbsent, markPresent } from '../db/attendance';
import { listActiveStudents, type Student } from '../db/students';
import { afterPendingWrites } from '../db/writeQueue';
import { tapHaptic, warningHaptic } from '../utils/haptics';

interface Marks {
  /** Which session these marks belong to, so stale marks are never shown for a new date/period. */
  key: string;
  absent: Set<number>;
}

const NO_ABSENCES: ReadonlySet<number> = new Set();

function sessionKey(date: string, period: number): string {
  return `${date}|${period}`;
}

function withMark(ids: ReadonlySet<number>, id: number, absent: boolean): Set<number> {
  const next = new Set(ids);
  if (absent) next.add(id);
  else next.delete(id);
  return next;
}

function reportWriteError(): void {
  warningHaptic();
  Alert.alert('Not saved', 'That change could not be saved. Please try again.');
}

export interface SessionState {
  students: Student[] | null;
  absentIds: ReadonlySet<number>;
  /** True until the marks for the current date/period have loaded. */
  marksLoading: boolean;
  error: string | null;
  stats: { total: number; present: number; absent: number };
  isAbsent: (studentId: number) => boolean;
  setAbsent: (studentId: number, absent: boolean) => void;
  toggle: (studentId: number) => void;
  markAllPresent: () => Promise<void>;
  reload: () => void;
}

export function useSession(date: string, period: number): SessionState {
  const db = useSQLiteContext();
  const key = sessionKey(date, period);

  const [students, setStudents] = useState<Student[] | null>(null);
  const [marks, setMarks] = useState<Marks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  /** Bumped by every mark, so a load that started before a tap never overwrites it. */
  const writeGeneration = useRef(0);

  const absentIds = marks?.key === key ? marks.absent : NO_ABSENCES;
  // Latest marks for event handlers; also updated eagerly by setAbsent so two
  // actions in the same frame see each other.
  const absentRef = useRef(absentIds);
  const keyRef = useRef(key);
  useLayoutEffect(() => {
    absentRef.current = absentIds;
    keyRef.current = key;
  }, [absentIds, key]);

  const load = useCallback(() => {
    const request = ++requestId.current;
    const read = () => {
      const generation = writeGeneration.current;
      // Read after queued writes, so the result includes every mark made so far.
      afterPendingWrites(() => Promise.all([listActiveStudents(db), getAbsentStudentIds(db, date, period)]))
        .then(([roster, absent]) => {
          if (request !== requestId.current) return; // a newer load or date/period superseded this one
          if (generation !== writeGeneration.current) {
            read(); // a mark happened while reading; read again so it isn't undone
            return;
          }
          setStudents(roster);
          setMarks({ key: sessionKey(date, period), absent });
          setError(null);
        })
        .catch(() => {
          if (request === requestId.current) setError('The class register could not be loaded.');
        });
    };
    read();
  }, [db, date, period]);

  // Runs on focus (so imports and absentee edits show up) and on every date/period change.
  useFocusEffect(load);

  const setAbsent = useCallback(
    (studentId: number, absent: boolean) => {
      if (absentRef.current.has(studentId) === absent) return; // idempotent
      tapHaptic();
      writeGeneration.current += 1;
      const update = (value: boolean) => {
        // A rollback can arrive after the user switched date/period; only touch the current session.
        if (keyRef.current === key) absentRef.current = withMark(absentRef.current, studentId, value);
        setMarks((prev) => (prev && prev.key === key ? { key, absent: withMark(prev.absent, studentId, value) } : prev));
      };

      update(absent);
      const write = absent ? markAbsent(db, date, period, studentId) : markPresent(db, date, period, studentId);
      write.catch(() => {
        update(!absent);
        reportWriteError();
      });
    },
    [db, date, period, key]
  );

  const toggle = useCallback(
    (studentId: number) => setAbsent(studentId, !absentRef.current.has(studentId)),
    [setAbsent]
  );

  const markAllPresent = useCallback(async () => {
    writeGeneration.current += 1;
    const previous = absentRef.current;
    absentRef.current = new Set();
    setMarks({ key, absent: new Set() });
    try {
      await clearAbsences(db, date, period);
      tapHaptic();
    } catch {
      if (keyRef.current === key) absentRef.current = previous;
      setMarks((prev) => (prev && prev.key === key ? { key, absent: new Set(previous) } : prev));
      reportWriteError();
    }
  }, [db, date, period, key]);

  const stats = useMemo(() => {
    const total = students?.length ?? 0;
    const absent = students ? students.filter((s) => absentIds.has(s.id)).length : 0;
    return { total, absent, present: total - absent };
  }, [students, absentIds]);

  const isAbsent = useCallback((studentId: number) => absentRef.current.has(studentId), []);

  return {
    students,
    absentIds,
    marksLoading: marks?.key !== key,
    error,
    stats,
    isAbsent,
    setAbsent,
    toggle,
    markAllPresent,
    reload: load,
  };
}
