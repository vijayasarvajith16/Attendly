// Attendance tab: for the class's selected date and period, swipe students
// left (or tap) to mark them absent. Every change is saved immediately.

import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import Ionicons from '@expo/vector-icons/Ionicons';

import { BottomBar } from '../../../src/components/BottomBar';
import { DateStepper } from '../../../src/components/DateStepper';
import { EmptyState } from '../../../src/components/EmptyState';
import { PeriodSelector } from '../../../src/components/PeriodSelector';
import { SearchBar } from '../../../src/components/SearchBar';
import { SkeletonRows } from '../../../src/components/SkeletonRows';
import { StatCard } from '../../../src/components/StatCard';
import { StudentRow } from '../../../src/components/StudentRow';
import type { Student } from '../../../src/db/students';
import { useClassContext } from '../../../src/hooks/useClassContext';
import { useSession } from '../../../src/hooks/useSession';
import { useStudentSearch } from '../../../src/hooks/useStudentSearch';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { formatDisplayDate, formatShortDate } from '../../../src/utils/dates';
import { plural } from '../../../src/utils/format';
import { pushOnce } from '../../../src/utils/navigation';

export default function AttendanceTab() {
  const { colors, spacing, typography, touchTarget, radius } = useTheme();
  const { classId, date, setDate, period, setPeriod, periodChipCount } = useClassContext();
  const [query, setQuery] = useState('');
  const session = useSession(classId, date, period);
  const visible = useStudentSearch(session.students, query);

  const confirmMarkAllPresent = useCallback(() => {
    Alert.alert(
      'Mark everyone present?',
      `This clears ${plural(session.stats.absent, 'absence')} for period ${period} on ${formatDisplayDate(date)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark all present', style: 'destructive', onPress: () => void session.markAllPresent() },
      ]
    );
  }, [session, period, date]);

  const { absentIds, marksLoading, toggle, setAbsent } = session;
  const renderItem = useCallback(
    ({ item }: { item: Student }) => (
      <StudentRow student={item} absent={absentIds.has(item.id)} disabled={marksLoading} onToggle={toggle} onSetAbsent={setAbsent} />
    ),
    [absentIds, marksLoading, toggle, setAbsent]
  );

  if (session.error) {
    return <EmptyState icon="alert-circle-outline" tone="error" title="Couldn't load the register" message={session.error} actionLabel="Try again" onAction={session.reload} />;
  }

  if (session.students && session.students.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title="No students in this class yet"
        message="Import the class list from a CSV, Excel or Word file, or add students one by one."
        actionLabel="Import student list"
        onAction={() => pushOnce({ pathname: '/import', params: { classId: String(classId) } })}
        secondaryActionLabel="Add students by hand"
        onSecondaryAction={() => router.navigate({ pathname: '/class/[id]/students', params: { id: String(classId) } })}
      />
    );
  }

  const noAbsences = session.stats.absent === 0;

  return (
    <View style={styles.flex}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm }}>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Text style={[typography.subtitle, styles.flex, { color: colors.textPrimary }]} numberOfLines={1}>
            {formatShortDate(date)} · Period {period}
          </Text>
          <Pressable
            onPress={confirmMarkAllPresent}
            disabled={noAbsences}
            accessibilityRole="button"
            accessibilityLabel="Mark all present"
            style={({ pressed }) => [
              styles.iconButton,
              {
                width: touchTarget,
                height: touchTarget,
                borderRadius: radius.md,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                opacity: noAbsences ? 0.4 : 1,
              },
            ]}
          >
            <Ionicons name="checkmark-done" size={22} color={colors.success} />
          </Pressable>
        </View>
        <StatCard total={session.stats.total} present={session.stats.present} absent={session.stats.absent} />
        <SearchBar value={query} onChangeText={setQuery} />
        {noAbsences ? (
          <View style={[styles.hint, { gap: spacing.xs }]}>
            <Ionicons name="arrow-back" size={14} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textMuted }]}>Swipe left to mark absent · tap a row to switch</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.flex, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
        {session.students === null ? (
          <SkeletonRows />
        ) : (
          <FlashList
            data={visible}
            renderItem={renderItem}
            keyExtractor={(s) => String(s.id)}
            extraData={absentIds}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={
              <Text style={[typography.body, styles.centerText, { color: colors.textSecondary, padding: spacing.xl }]}>
                No students match “{query}”.
              </Text>
            }
          />
        )}
      </View>

      <BottomBar safeArea={false}>
        <DateStepper value={date} classId={classId} onChange={setDate} />
        <PeriodSelector count={periodChipCount} value={period} onChange={setPeriod} />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  centerText: { textAlign: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconButton: { borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
