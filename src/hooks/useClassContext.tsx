// Shared state for one class's tabs: the class itself, and the selected date
// and period (shared by Attendance and Absentees, so switching tabs keeps the
// same session). The date follows "today" until the user picks another day.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { getClass, type ClassInfo } from '../db/classes';
import { chipCount, resolvePeriod, usePeriodsPerDay } from './usePeriodsPerDay';
import { useToday } from './useToday';

export interface ClassContextValue {
  classId: number;
  /** null while loading; undefined if the class no longer exists. */
  classInfo: ClassInfo | null | undefined;
  /** True if the class could not be read (not the same as deleted). */
  classError: boolean;
  reloadClass: () => void;
  date: string;
  setDate: (date: string) => void;
  period: number;
  setPeriod: (period: number) => void;
  periodChipCount: number;
}

const ClassContext = createContext<ClassContextValue | null>(null);

export function useClassContext(): ClassContextValue {
  const value = useContext(ClassContext);
  if (!value) throw new Error('useClassContext must be used inside <ClassProvider>');
  return value;
}

export function ClassProvider({ classId, children }: { classId: number; children: ReactNode }) {
  const db = useSQLiteContext();
  const [classInfo, setClassInfo] = useState<ClassInfo | null | undefined>(null);
  const [classError, setClassError] = useState(false);

  const reloadClass = useCallback(() => {
    getClass(db, classId)
      .then((info) => {
        setClassInfo(info ?? undefined);
        setClassError(false);
      })
      .catch(() => setClassError(true));
  }, [db, classId]);
  useFocusEffect(reloadClass);

  // null means "follow today", so a register left open overnight moves to the new day.
  const today = useToday();
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const date = pickedDate ?? today;
  const setDate = useCallback((next: string) => setPickedDate(next === today ? null : next), [today]);

  const periodsPerDay = usePeriodsPerDay();
  const [selectedPeriod, setPeriod] = useState(1);
  const period = resolvePeriod(selectedPeriod, periodsPerDay);
  const periodChipCount = chipCount(selectedPeriod, periodsPerDay);

  const value = useMemo<ClassContextValue>(
    () => ({ classId, classInfo, classError, reloadClass, date, setDate, period, setPeriod, periodChipCount }),
    [classId, classInfo, classError, reloadClass, date, setDate, period, periodChipCount]
  );

  return <ClassContext.Provider value={value}>{children}</ClassContext.Provider>;
}
