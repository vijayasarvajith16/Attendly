// Reads the configured number of periods per day, refreshing whenever the
// screen regains focus (e.g. after changing it in Settings). Returns null until
// known, so callers never clamp a period against a guessed maximum.

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { DEFAULT_PERIODS_PER_DAY, getPeriodsPerDay } from '../db/settings';

export function usePeriodsPerDay(): number | null {
  const db = useSQLiteContext();
  const [periods, setPeriods] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getPeriodsPerDay(db)
        .then((value) => {
          if (!cancelled) setPeriods(value);
        })
        .catch(() => undefined); // stay unknown; callers then show the requested period unclamped
      return () => {
        cancelled = true;
      };
    }, [db])
  );

  return periods;
}

/** The period to show: the requested one, clamped once the maximum is known. */
export function resolvePeriod(requested: number, periodsPerDay: number | null): number {
  return periodsPerDay === null ? requested : Math.min(requested, periodsPerDay);
}

/** How many period chips to draw while the setting may still be loading. */
export function chipCount(requested: number, periodsPerDay: number | null): number {
  return periodsPerDay ?? Math.max(DEFAULT_PERIODS_PER_DAY, requested);
}
