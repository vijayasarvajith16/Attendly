// Absentees for one (class, date, period) session plus the class size, with an
// un-mark action. Reloads on focus and whenever the date or period changes.

import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { listAbsentees, markPresent, type AbsentStudent } from '../db/attendance';
import { listClassStudents } from '../db/students';
import { afterPendingWrites } from '../db/writeQueue';
import { tapHaptic } from '../utils/haptics';

interface Loaded {
  key: string;
  absentees: AbsentStudent[];
  total: number;
}

export function useAbsentees(classId: number, date: string, period: number) {
  const db = useSQLiteContext();
  const key = `${classId}|${date}|${period}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(() => {
    const request = ++requestId.current;
    afterPendingWrites(() => Promise.all([listAbsentees(db, classId, date, period), listClassStudents(db, classId)]))
      .then(([absentees, members]) => {
        if (request !== requestId.current) return;
        setLoaded({ key: `${classId}|${date}|${period}`, absentees, total: members.length });
        setError(null);
      })
      .catch(() => {
        if (request === requestId.current) setError('The absentee list could not be loaded.');
      });
  }, [db, classId, date, period]);

  useFocusEffect(load);

  /** Marks a student present again. Throws if the change could not be saved. */
  const unmark = useCallback(
    async (student: AbsentStudent) => {
      tapHaptic();
      const drop = (list: Loaded | null) =>
        list && list.key === key ? { ...list, absentees: list.absentees.filter((s) => s.id !== student.id) } : list;
      setLoaded(drop);
      try {
        await markPresent(db, classId, date, period, student.id);
      } catch (e) {
        load(); // restore the true state
        throw e;
      }
    },
    [db, classId, date, period, key, load]
  );

  const current = loaded?.key === key ? loaded : null;
  return {
    absentees: current?.absentees ?? null,
    total: current?.total ?? loaded?.total ?? 0,
    loading: current === null && error === null,
    error,
    unmark,
    reload: load,
  };
}
