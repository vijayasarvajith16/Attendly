// Dates in a visible calendar month that have any absences, for the dots in
// the date picker.

import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { endOfMonth, startOfMonth } from 'date-fns';

import { listDatesWithAbsences } from '../db/attendance';
import { toISODate } from '../utils/dates';

export function useDatesWithAbsences(month: Date, enabled: boolean): ReadonlySet<string> {
  const db = useSQLiteContext();
  const [dates, setDates] = useState<ReadonlySet<string>>(new Set());
  const from = toISODate(startOfMonth(month));
  const to = toISODate(endOfMonth(month));

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    listDatesWithAbsences(db, from, to)
      .then((result) => {
        if (!cancelled) setDates(result);
      })
      .catch(() => undefined); // dots are a nicety; never block the picker
    return () => {
      cancelled = true;
    };
  }, [db, from, to, enabled]);

  return dates;
}
