// Students tab data: a class's members, adding one student by hand, and
// removing a student from the class (unlink only; history is kept).

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { addStudentToClass, removeStudentFromClass, type AddToClassResult } from '../db/classStudents';
import { listClassStudents, type Student } from '../db/students';
import { cleanName, cleanRoll, isRollNo } from '../import/parseRoster';
import { tapHaptic } from '../utils/haptics';

/** Thrown for invalid input to `add`; the message is shown next to the form. */
export class AddStudentError extends Error {}

export function useClassStudents(classId: number) {
  const db = useSQLiteContext();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    listClassStudents(db, classId)
      .then((list) => {
        setStudents(list);
        setError(null);
      })
      .catch(() => setError('The student list could not be loaded.'));
  }, [db, classId]);

  useFocusEffect(reload);

  /** Adds (or links an existing) student. Throws AddStudentError for invalid input. */
  const add = useCallback(
    async (rollInput: string, nameInput: string): Promise<AddToClassResult> => {
      const rollNo = cleanRoll(rollInput);
      const name = cleanName(nameInput);
      if (!isRollNo(rollNo)) throw new AddStudentError('Enter a roll number (letters and digits, no spaces).');
      if (!name) throw new AddStudentError('Enter the student’s name.');
      const result = await addStudentToClass(db, classId, rollNo, name);
      tapHaptic();
      reload();
      return result;
    },
    [db, classId, reload]
  );

  const remove = useCallback(
    async (student: Student) => {
      setStudents((prev) => prev?.filter((s) => s.id !== student.id) ?? prev);
      try {
        await removeStudentFromClass(db, classId, student.id);
        tapHaptic();
      } finally {
        reload();
      }
    },
    [db, classId, reload]
  );

  return { students, error, reload, add, remove };
}
