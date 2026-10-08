// Main attendance screen: pick a date and period, then swipe students left
// (or tap) to mark them absent. Every change is saved immediately.

import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import Ionicons from '@expo/vector-icons/Ionicons';

import { BottomBar } from '../src/components/BottomBar';
import { Button } from '../src/components/Button';
import { DateStepper } from '../src/components/DateStepper';
import { EmptyState } from '../src/components/EmptyState';
import { PeriodSelector } from '../src/components/PeriodSelector';
import { SearchBar } from '../src/components/SearchBar';
import { SkeletonRows } from '../src/components/SkeletonRows';
import { StatCard } from '../src/components/StatCard';
import { StudentRow } from '../src/components/StudentRow';
import type { Student } from '../src/db/students';
import { chipCount, resolvePeriod, usePeriodsPerDay } from '../src/hooks/usePeriodsPerDay';
import { useSession } from '../src/hooks/useSession';
import { useToday } from '../src/hooks/useToday';
import { useTheme } from '../src/theme/ThemeProvider';
import { pushOnce } from '../src/utils/navigation';
import { formatDisplayDate, formatShortDate } from '../src/utils/dates';
import { plural, searchKey } from '../src/utils/format';

function useStudentSearch(students: Student[] | null, query: string): Student[] {
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

export default function AttendanceScreen() {
  const { colors, spacing, typography } = useTheme();
  // null means "follow today", so a register left open overnight moves to the new day.
  const today = useToday();
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const date = pickedDate ?? today;
  const changeDate = useCallback((next: string) => setPickedDate(next === today ? null : next), [today]);
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [query, setQuery] = useState('');

  const periodsPerDay = usePeriodsPerDay();
  const period = resolvePeriod(selectedPeriod, periodsPerDay); // never beyond the configured maximum
  const session = useSession(date, period);
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

  const openAbsentees = useCallback(() => {
    pushOnce({ pathname: '/absentees', params: { date, period: String(period) } });
  }, [date, period]);

  const { absentIds, marksLoading, toggle, setAbsent } = session;
  const renderItem = useCallback(
    ({ item }: { item: Student }) => (
      <StudentRow student={item} absent={absentIds.has(item.id)} disabled={marksLoading} onToggle={toggle} onSetAbsent={setAbsent} />
    ),
    [absentIds, marksLoading, toggle, setAbsent]
  );

  const title = `${formatShortDate(date)} · P${period}`;

  if (session.error) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <EmptyState icon="alert-circle-outline" tone="error" title="Couldn't load the register" message={session.error} actionLabel="Try again" onAction={session.reload} />
      </>
    );
  }

  if (session.students && session.students.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Attendance' }} />
        <EmptyState
          icon="people-outline"
          title="No students yet"
          message="Import your class list from a CSV or Excel file to start taking attendance."
          actionLabel="Import student list"
          onAction={() => pushOnce('/import')}
        />
      </>
    );
  }

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title }} />

      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm }}>
        <StatCard total={session.stats.total} present={session.stats.present} absent={session.stats.absent} />
        <SearchBar value={query} onChangeText={setQuery} />
        <View style={[styles.hint, { gap: spacing.xs }]}>
          <Ionicons name="arrow-back" size={14} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.textMuted }]}>Swipe left to mark absent · tap a row to switch</Text>
        </View>
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

      <BottomBar>
        <DateStepper value={date} onChange={changeDate} />
        <PeriodSelector count={chipCount(selectedPeriod, periodsPerDay)} value={period} onChange={setSelectedPeriod} />
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Pressable
            onPress={confirmMarkAllPresent}
            disabled={session.stats.absent === 0}
            accessibilityRole="button"
            accessibilityLabel="Mark all present"
            style={({ pressed }) => [
              styles.iconButton,
              {
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                opacity: session.stats.absent === 0 ? 0.4 : 1,
              },
            ]}
          >
            <Ionicons name="checkmark-done" size={22} color={colors.success} />
          </Pressable>
          <Button
            label={session.stats.absent > 0 ? `Absentees (${session.stats.absent})` : 'Absentees'}
            icon="list"
            onPress={openAbsentees}
            style={styles.flex}
          />
        </View>
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  centerText: { textAlign: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
