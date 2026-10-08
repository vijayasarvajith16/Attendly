// Absentees for one (date, period) session plus the roster size, with an
// un-mark action. Reloads on focus and whenever the date or period changes.

import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { listAbsentees, markPresent } from '../db/attendance';
import { countActiveStudents, type Student } from '../db/students';
import { tapHaptic } from '../utils/haptics';

interface Loaded {
  key: string;
  absentees: Student[];
  total: number;
}

export function useAbsentees(date: string, period: number) {
  const db = useSQLiteContext();
  const key = `${date}|${period}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(() => {
    const request = ++requestId.current;
    Promise.all([listAbsentees(db, date, period), countActiveStudents(db)])
      .then(([absentees, total]) => {
        if (request !== requestId.current) return;
        setLoaded({ key: `${date}|${period}`, absentees, total });
        setError(null);
      })
      .catch(() => {
        if (request === requestId.current) setError('The absentee list could not be loaded.');
      });
  }, [db, date, period]);

  useFocusEffect(load);

  /** Marks a student present again. Throws if the change could not be saved. */
  const unmark = useCallback(
    async (student: Student) => {
      tapHaptic();
      const drop = (list: Loaded | null) =>
        list && list.key === key ? { ...list, absentees: list.absentees.filter((s) => s.id !== student.id) } : list;
      setLoaded(drop);
      try {
        await markPresent(db, date, period, student.id);
      } catch (e) {
        load(); // restore the true state
        throw e;
      }
    },
    [db, date, period, key, load]
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
