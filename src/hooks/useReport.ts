// Reports tab data: a class's absences for a date range (optionally one
// period), grouped by date, newest first.

import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { listAbsencesInRange, type AbsenceRecord } from '../db/reports';
import { afterPendingWrites } from '../db/writeQueue';

export interface ReportPeriodGroup {
  period: number;
  absentees: AbsenceRecord[];
}

export interface ReportDay {
  date: string;
  absences: number;
  periods: ReportPeriodGroup[];
}

export interface ReportSummary {
  absences: number;
  days: number;
  students: number;
}

export function groupByDate(records: readonly AbsenceRecord[]): ReportDay[] {
  const days: ReportDay[] = [];
  for (const record of records) {
    let day = days.at(-1);
    if (!day || day.date !== record.date) {
      day = { date: record.date, absences: 0, periods: [] };
      days.push(day);
    }
    let group = day.periods.at(-1);
    if (!group || group.period !== record.period) {
      group = { period: record.period, absentees: [] };
      day.periods.push(group);
    }
    group.absentees.push(record);
    day.absences += 1;
  }
  return days;
}

export function useReport(classId: number, from: string, to: string, period: number | null) {
  const db = useSQLiteContext();
  const key = `${classId}|${from}|${to}|${period ?? 'all'}`;
  const [loaded, setLoaded] = useState<{ key: string; records: AbsenceRecord[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(() => {
    const request = ++requestId.current;
    afterPendingWrites(() => listAbsencesInRange(db, classId, from, to, period))
      .then((records) => {
        if (request !== requestId.current) return;
        setLoaded({ key: `${classId}|${from}|${to}|${period ?? 'all'}`, records });
        setError(null);
      })
      .catch(() => {
        if (request === requestId.current) setError('The report could not be loaded.');
      });
  }, [db, classId, from, to, period]);

  useFocusEffect(reload);

  const records = loaded?.key === key ? loaded.records : null;
  const days = useMemo(() => (records ? groupByDate(records) : null), [records]);
  const summary = useMemo<ReportSummary | null>(
    () =>
      records
        ? { absences: records.length, days: new Set(records.map((r) => r.date)).size, students: new Set(records.map((r) => r.studentId)).size }
        : null,
    [records]
  );

  return { records, days, summary, error, reload };
}
