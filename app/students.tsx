// All Students: the master list (every roll number ever imported), with chips
// for each class and subject the student belongs to. Tap a chip to open it.

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Ionicons from '@expo/vector-icons/Ionicons';

import { EmptyState } from '../src/components/EmptyState';
import { SearchBar } from '../src/components/SearchBar';
import type { StudentWithClasses } from '../src/db/students';
import { useAllStudents } from '../src/hooks/useAllStudents';
import { useStudentSearch } from '../src/hooks/useStudentSearch';
import { useTheme } from '../src/theme/ThemeProvider';
import { MAX_FONT_SCALE } from '../src/theme/tokens';
import { plural } from '../src/utils/format';
import { pushOnce } from '../src/utils/navigation';

function openClass(classId: number) {
  pushOnce({ pathname: '/class/[id]', params: { id: String(classId) } });
}

export default function AllStudentsScreen() {
  const { colors, spacing, typography } = useTheme();
  const { students, error, reload } = useAllStudents();
  const [query, setQuery] = useState('');
  const visible = useStudentSearch(students, query);

  const renderItem = useCallback(({ item }: { item: StudentWithClasses }) => <StudentCard student={item} />, []);

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
        title="No students yet"
        message="Students appear here once you import a list into a class or subject."
      />
    );
  }

  const unassigned = students.filter((s) => s.classes.length === 0).length;

  return (
    <View style={styles.flex}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm }}>
        <SearchBar value={query} onChangeText={setQuery} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {plural(students.length, 'student')}
          {unassigned > 0 ? ` · ${unassigned} not in any class` : ''}
        </Text>
      </View>
      <FlashList
        data={visible}
        renderItem={renderItem}
        keyExtractor={(s) => String(s.id)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListEmptyComponent={
          <Text style={[typography.body, styles.centerText, { color: colors.textSecondary, padding: spacing.xl }]}>No students match “{query}”.</Text>
        }
      />
    </View>
  );
}

function StudentCard({ student }: { student: StudentWithClasses }) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View style={[styles.card, { borderBottomColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm }]}>
      <View style={[styles.row, { gap: spacing.md }]}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.subtitle, styles.roll, { color: colors.textPrimary }]}>
          {student.rollNo}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.body, styles.flex, { color: colors.textPrimary }]} numberOfLines={1}>
          {student.name}
        </Text>
      </View>
      <View style={[styles.chips, { gap: spacing.xs }]}>
        {student.classes.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>Not in any class</Text>
        ) : (
          student.classes.map((c) => {
            const isClass = c.kind === 'CLASS';
            return (
              <Pressable
                key={c.id}
                onPress={() => openClass(c.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${c.name}`}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: isClass ? colors.primarySoft : colors.successSoft, borderRadius: radius.pill, opacity: pressed ? 0.6 : 1, gap: 4 },
                ]}
              >
                <Ionicons name={isClass ? 'people' : 'book'} size={12} color={isClass ? colors.primary : colors.success} />
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.caption, { color: isClass ? colors.primary : colors.success }]}>
                  {c.name}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  card: { borderBottomWidth: StyleSheet.hairlineWidth },
  roll: { minWidth: 52, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingLeft: 64 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 },
});
