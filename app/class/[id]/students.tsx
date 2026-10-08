// Students tab: the class's members. Add one by hand, import a list, or remove
// a student from this class (unlink only: they stay in All students and their
// attendance history is kept).

import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AddStudentForm } from '../../../src/components/AddStudentForm';
import { BottomBar } from '../../../src/components/BottomBar';
import { Button } from '../../../src/components/Button';
import { EmptyState } from '../../../src/components/EmptyState';
import { SearchBar } from '../../../src/components/SearchBar';
import { Sheet } from '../../../src/components/Sheet';
import { useToast } from '../../../src/components/Toast';
import type { Student } from '../../../src/db/students';
import { useClassContext } from '../../../src/hooks/useClassContext';
import { AddStudentError, useClassStudents } from '../../../src/hooks/useClassStudents';
import { useStudentSearch } from '../../../src/hooks/useStudentSearch';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { MAX_FONT_SCALE } from '../../../src/theme/tokens';
import { plural } from '../../../src/utils/format';
import { warningHaptic } from '../../../src/utils/haptics';
import { pushOnce } from '../../../src/utils/navigation';

const ROW_HEIGHT = 56;

export default function StudentsTab() {
  const { colors, spacing, typography } = useTheme();
  const { classId, classInfo } = useClassContext();
  const className = classInfo?.name ?? 'this class';
  const toast = useToast();
  const { students, error, reload, add, remove } = useClassStudents(classId);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const visible = useStudentSearch(students, query);

  const openImport = useCallback(() => pushOnce({ pathname: '/import', params: { classId: String(classId) } }), [classId]);

  const addStudent = useCallback(
    async (rollNo: string, name: string): Promise<string | null> => {
      try {
        const result = await add(rollNo, name);
        switch (result.status) {
          case 'alreadyInClass':
            return `Roll ${result.rollNo} (${result.name}) is already in this class.`;
          case 'nameMismatch':
            return `Roll ${result.rollNo} is already saved as “${result.name}”. Type that name to add this student, or use a different roll number.`;
          case 'linked':
          case 'created':
            setAdding(false); // close the sheet so the confirmation is visible
            toast.show(result.status === 'created' ? `Added ${result.name}` : `Added ${result.name} (roll ${result.rollNo}, already in another class)`);
            return null;
        }
      } catch (e) {
        return e instanceof AddStudentError ? e.message : 'That student could not be added. Please try again.';
      }
    },
    [add, toast]
  );

  const confirmRemove = useCallback(
    (student: Student) => {
      Alert.alert(
        `Remove ${student.name} from ${className}?`,
        'They stay in All students, and their attendance history is kept.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              remove(student)
                .then(() => toast.show(`Removed ${student.name} from ${className}`))
                .catch(() => {
                  warningHaptic();
                  Alert.alert('Not removed', 'Something went wrong. Nothing was changed.');
                });
            },
          },
        ]
      );
    },
    [className, remove, toast]
  );

  const renderItem = useCallback(
    ({ item }: { item: Student }) => <MemberRow student={item} onRemove={confirmRemove} />,
    [confirmRemove]
  );

  const renderBody = () => {
    if (error) {
      return <EmptyState icon="alert-circle-outline" tone="error" title="Couldn't load students" message={error} actionLabel="Try again" onAction={reload} />;
    }
    if (!students) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (students.length === 0) {
      return (
        <EmptyState
          icon="people-outline"
          title="No students in this class yet"
          message="Import the class list from a file, or add students one by one."
          actionLabel="Import student list"
          onAction={openImport}
          secondaryActionLabel="Add a student"
          onSecondaryAction={() => setAdding(true)}
        />
      );
    }
    return (
      <>
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm }}>
          <SearchBar value={query} onChangeText={setQuery} />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{plural(students.length, 'student')}</Text>
        </View>
        <FlashList
          data={visible}
          renderItem={renderItem}
          keyExtractor={(s) => String(s.id)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <Text style={[typography.body, styles.centerText, { color: colors.textSecondary, padding: spacing.xl }]}>No students match “{query}”.</Text>
          }
        />
      </>
    );
  };

  return (
    <View style={[styles.flex, { paddingTop: spacing.lg }]}>
      <View style={styles.flex}>{renderBody()}</View>
      <BottomBar safeArea={false}>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Button label="Add student" icon="person-add-outline" variant="secondary" onPress={() => setAdding(true)} style={styles.flex} />
          <Button label="Import list" icon="cloud-upload-outline" onPress={openImport} style={styles.flex} />
        </View>
      </BottomBar>
      {adding ? (
        <Sheet title={`Add a student to ${className}`} onClose={() => setAdding(false)}>
          <AddStudentForm onAdd={addStudent} autoFocus />
        </Sheet>
      ) : null}
    </View>
  );
}

function MemberRow({ student, onRemove }: { student: Student; onRemove: (student: Student) => void }) {
  const { colors, spacing, typography, touchTarget } = useTheme();
  return (
    <View style={[styles.memberRow, { height: ROW_HEIGHT, paddingLeft: spacing.lg, gap: spacing.md, borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.subtitle, styles.roll, { color: colors.textPrimary }]} numberOfLines={1}>
        {student.rollNo}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.body, styles.flex, { color: colors.textPrimary }]} numberOfLines={1}>
        {student.name}
      </Text>
      <Pressable
        onPress={() => onRemove(student)}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${student.name} from this class`}
        style={({ pressed }) => [styles.removeButton, { width: touchTarget + 8, height: ROW_HEIGHT, opacity: pressed ? 0.4 : 1 }]}
      >
        <Ionicons name="person-remove-outline" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  memberRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  roll: { minWidth: 52, fontVariant: ['tabular-nums'] },
  removeButton: { alignItems: 'center', justifyContent: 'center' },
});
