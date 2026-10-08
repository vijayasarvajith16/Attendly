// Create, rename and delete classes/subjects, shared by the home screen and
// the class header. Deleting asks for confirmation and says exactly what is
// lost (that class's attendance); students always stay in the master list.

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { useToast } from '../components/Toast';
import { createClass, deleteClass, getClassDeletionImpact, kindLabel, renameClass, type ClassInfo, type ClassKind } from '../db/classes';
import { plural } from '../utils/format';
import { successHaptic, warningHaptic } from '../utils/haptics';

export function useClassActions() {
  const db = useSQLiteContext();
  const toast = useToast();

  /** Creates a class and returns its id. Throws ClassNameError for invalid names. */
  const create = useCallback(
    async (name: string, kind: ClassKind) => {
      const id = await createClass(db, name, kind);
      successHaptic();
      return id;
    },
    [db]
  );

  /** Throws ClassNameError for invalid names. */
  const rename = useCallback(
    async (classId: number, name: string) => {
      await renameClass(db, classId, name);
      successHaptic();
      toast.show('Name updated');
    },
    [db, toast]
  );

  const confirmDelete = useCallback(
    (cls: Pick<ClassInfo, 'id' | 'name' | 'kind'>, onDeleted: () => void) => {
      const noun = kindLabel(cls.kind);
      getClassDeletionImpact(db, cls.id)
        .then((impact) => {
          const history =
            impact.absences > 0
              ? `This permanently deletes ${plural(impact.absences, 'absence record')} for this ${noun}.`
              : `This ${noun} has no attendance records yet.`;
          Alert.alert(`Delete “${cls.name}”?`, `${history}\n\nIts ${plural(impact.students, 'student')} stay in All students.`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: `Delete ${noun}`,
              style: 'destructive',
              onPress: () => {
                deleteClass(db, cls.id)
                  .then(() => {
                    successHaptic();
                    toast.show(`Deleted “${cls.name}”`);
                    onDeleted();
                  })
                  .catch(() => {
                    warningHaptic();
                    Alert.alert('Not deleted', 'Something went wrong. Nothing was changed.');
                  });
              },
            },
          ]);
        })
        .catch(() => Alert.alert('Not available', 'Please try again.'));
    },
    [db, toast]
  );

  return { create, rename, confirmDelete };
}
