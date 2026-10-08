// All Students screen data: the master list with each student's classes.

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { listAllStudentsWithClasses, type StudentWithClasses } from '../db/students';

export function useAllStudents() {
  const db = useSQLiteContext();
  const [students, setStudents] = useState<StudentWithClasses[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    listAllStudentsWithClasses(db)
      .then((list) => {
        setStudents(list);
        setError(null);
      })
      .catch(() => setError('The student list could not be loaded.'));
  }, [db]);

  useFocusEffect(reload);

  return { students, error, reload };
}
