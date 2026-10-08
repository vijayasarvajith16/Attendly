// Home screen data: classes or subjects with counts. Reloads on focus so
// counts stay current after taking attendance. Changes go through useClassActions.

import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { countClasses, listClasses, type ClassKind, type ClassSummary } from '../db/classes';
import { todayISO } from '../utils/dates';

export function useClasses(kind: ClassKind) {
  const db = useSQLiteContext();
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [loadedKind, setLoadedKind] = useState<ClassKind | null>(null);
  const [counts, setCounts] = useState<Record<ClassKind, number>>({ CLASS: 0, SUBJECT: 0 });
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(() => {
    const request = ++requestId.current;
    Promise.all([listClasses(db, kind, todayISO()), countClasses(db)])
      .then(([list, totals]) => {
        if (request !== requestId.current) return;
        setClasses(list);
        setLoadedKind(kind);
        setCounts(totals);
        setError(null);
      })
      .catch(() => {
        if (request === requestId.current) setError('Your classes could not be loaded.');
      });
  }, [db, kind]);

  useFocusEffect(reload);

  return {
    /** null while loading or while switching between Classes and Subjects. */
    classes: loadedKind === kind ? classes : null,
    counts,
    error,
    reload,
  };
}
