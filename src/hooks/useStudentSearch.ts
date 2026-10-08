// Filters a student list by roll number or name, ignoring case and accents.

import { useMemo } from 'react';

import type { Student } from '../db/students';
import { searchKey } from '../utils/format';

export function useStudentSearch<T extends Student>(students: T[] | null, query: string): T[] {
  const indexed = useMemo(
    () => (students ?? []).map((s) => ({ student: s, key: `${searchKey(s.rollNo)} ${searchKey(s.name)}` })),
    [students]
  );
  return useMemo(() => {
    const q = searchKey(query);
    if (!q) return indexed.map((i) => i.student);
    return indexed.filter((i) => i.key.includes(q)).map((i) => i.student);
  }, [indexed, query]);
}
