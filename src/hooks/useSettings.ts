// State and actions for the Settings screen: periods per day, data counts,
// backup export/restore and clear-all. Confirmation dialogs live in the screen.

import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { clearAllData, exportBackup, getDataCounts, restoreBackup, type Backup, type DataCounts } from '../db/backup';
import { clampPeriods, DEFAULT_PERIODS_PER_DAY, getPeriodsPerDay, setPeriodsPerDay } from '../db/settings';
import { pickBackupFile, shareBackup } from '../utils/backupFile';
import { successHaptic, tapHaptic } from '../utils/haptics';

export type BusyAction = 'export' | 'restore' | 'clear' | null;

export function useSettings() {
  const db = useSQLiteContext();
  const [periods, setPeriods] = useState(DEFAULT_PERIODS_PER_DAY);
  const [counts, setCounts] = useState<DataCounts | null>(null);
  const [countsFailed, setCountsFailed] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  // Latest periods value, so quick repeated taps build on each other.
  const periodsRef = useRef(DEFAULT_PERIODS_PER_DAY);

  const showPeriods = useCallback((value: number) => {
    periodsRef.current = value;
    setPeriods(value);
  }, []);

  const refresh = useCallback(() => {
    getPeriodsPerDay(db).then(showPeriods).catch(() => undefined);
    getDataCounts(db)
      .then((c) => {
        setCounts(c);
        setCountsFailed(false);
      })
      .catch(() => setCountsFailed(true));
  }, [db, showPeriods]);

  useFocusEffect(refresh);

  /** Steps periods per day by ±1: shown at once, saved in order. Throws if the save fails. */
  const stepPeriods = useCallback(
    async (delta: -1 | 1) => {
      const next = clampPeriods(periodsRef.current + delta);
      if (next === periodsRef.current) return;
      tapHaptic();
      showPeriods(next);
      try {
        await setPeriodsPerDay(db, next);
      } catch (e) {
        refresh(); // show what is really stored
        throw e;
      }
    },
    [db, refresh, showPeriods]
  );

  const runBusy = useCallback(async <T,>(action: Exclude<BusyAction, null>, task: () => Promise<T>): Promise<T> => {
    setBusy(action);
    try {
      return await task();
    } finally {
      setBusy(null);
    }
  }, []);

  const exportToFile = useCallback(
    () =>
      runBusy('export', async () => {
        await shareBackup(await exportBackup(db));
        successHaptic();
      }),
    [db, runBusy]
  );

  /** Picks and validates a backup file without changing anything. */
  const chooseBackup = useCallback((): Promise<Backup | null> => runBusy('restore', pickBackupFile), [runBusy]);

  const restore = useCallback(
    (backup: Backup) =>
      runBusy('restore', async () => {
        await restoreBackup(db, backup);
        successHaptic();
        refresh();
      }),
    [db, refresh, runBusy]
  );

  const clearAll = useCallback(
    () =>
      runBusy('clear', async () => {
        await clearAllData(db);
        successHaptic();
        refresh();
      }),
    [db, refresh, runBusy]
  );

  return { periods, counts, countsFailed, busy, stepPeriods, exportToFile, chooseBackup, restore, clearAll };
}
