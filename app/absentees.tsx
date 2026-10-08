// Absentee list for a date and period (from query params, changeable here),
// in numeric roll order, with "Mark present" and CSV / text sharing.

import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { AbsenteeRow } from '../src/components/AbsenteeRow';
import { BottomBar } from '../src/components/BottomBar';
import { Button } from '../src/components/Button';
import { DateStepper } from '../src/components/DateStepper';
import { EmptyState } from '../src/components/EmptyState';
import { PeriodSelector } from '../src/components/PeriodSelector';
import { MAX_PERIODS_PER_DAY } from '../src/db/settings';
import type { Student } from '../src/db/students';
import { useAbsentees } from '../src/hooks/useAbsentees';
import { chipCount, resolvePeriod, usePeriodsPerDay } from '../src/hooks/usePeriodsPerDay';
import { useTheme } from '../src/theme/ThemeProvider';
import { pushOnce } from '../src/utils/navigation';
import { formatDisplayDate, isISODate, todayISO } from '../src/utils/dates';
import { buildAbsenteeSummary, shareAbsenteeCsv } from '../src/utils/exportCsv';
import { plural } from '../src/utils/format';
import { successHaptic, warningHaptic } from '../src/utils/haptics';
import { ShareUnavailableError } from '../src/utils/shareFile';

function parsePeriodParam(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_PERIODS_PER_DAY) : 1;
}

export default function AbsenteesScreen() {
  const { colors, spacing, radius, typography, motion } = useTheme();
  const params = useLocalSearchParams<{ date?: string; period?: string }>();
  const [date, setDate] = useState(() => (isISODate(params.date) ? params.date : todayISO()));
  const [selectedPeriod, setSelectedPeriod] = useState(() => parsePeriodParam(params.period));
  const [exporting, setExporting] = useState(false);

  const periodsPerDay = usePeriodsPerDay();
  const period = resolvePeriod(selectedPeriod, periodsPerDay);
  const { absentees, total, loading, error, unmark, reload } = useAbsentees(date, period);
  const count = absentees?.length ?? 0;
  // "N of total" counts only students on the current roster; removed students are listed separately.
  const rosterCount = absentees?.filter((s) => s.active).length ?? 0;
  const removedCount = count - rosterCount;

  const confirmMarkPresent = useCallback(
    (student: Student) => {
      Alert.alert('Mark present?', `${student.rollNo} · ${student.name} will be removed from the absentee list.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark present',
          onPress: () => {
            unmark(student).catch(() => {
              warningHaptic();
              Alert.alert('Not saved', 'That change could not be saved. Please try again.');
            });
          },
        },
      ]);
    },
    [unmark]
  );

  const exportCsv = useCallback(async () => {
    if (!absentees || absentees.length === 0) return;
    setExporting(true);
    try {
      await shareAbsenteeCsv(absentees, date, period);
      successHaptic();
    } catch (e) {
      warningHaptic();
      Alert.alert(
        'Export failed',
        e instanceof ShareUnavailableError ? e.message : 'The CSV file could not be created. Please try again.'
      );
    } finally {
      setExporting(false);
    }
  }, [absentees, date, period]);

  const shareText = useCallback(() => {
    if (!absentees) return;
    Share.share({ message: buildAbsenteeSummary(absentees, date, period, total) }).catch(() => undefined);
  }, [absentees, date, period, total]);

  const title = absentees ? `Absentees: ${rosterCount} of ${total}` : 'Absentees';

  const renderBody = () => {
    if (error) {
      return <EmptyState icon="alert-circle-outline" tone="error" title="Couldn't load absentees" message={error} actionLabel="Try again" onAction={reload} />;
    }
    if (loading || !absentees) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (total === 0 && absentees.length === 0) {
      return (
        <EmptyState
          icon="people-outline"
          title="No students yet"
          message="Import your class list to start taking attendance."
          actionLabel="Import student list"
          onAction={() => pushOnce('/import')}
        />
      );
    }
    if (absentees.length === 0) {
      return (
        <EmptyState
          icon="happy-outline"
          tone="positive"
          title="No absentees"
          message={`Everyone is present for period ${period} on ${formatDisplayDate(date)}.`}
        />
      );
    }
    return (
      <Animated.FlatList
        data={absentees}
        keyExtractor={(s) => String(s.id)}
        itemLayoutAnimation={LinearTransition.duration(motion.base)}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.lg }}
        renderItem={({ item }) => (
          <Animated.View entering={FadeIn.duration(motion.fast)} exiting={FadeOut.duration(motion.fast)}>
            <AbsenteeRow student={item} onMarkPresent={confirmMarkPresent} />
          </Animated.View>
        )}
      />
    );
  };

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title }} />

      <View
        style={[
          styles.summary,
          { backgroundColor: colors.surface, borderBottomColor: colors.border, padding: spacing.lg, gap: spacing.md },
        ]}
      >
        <View style={[styles.countBadge, { backgroundColor: rosterCount > 0 ? colors.dangerSoft : colors.successSoft, borderRadius: radius.md }]}>
          <Text style={[typography.title, { color: rosterCount > 0 ? colors.danger : colors.success }]}>{absentees ? rosterCount : '–'}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
            {absentees ? `${rosterCount} of ${total} absent` : 'Loading…'}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {formatDisplayDate(date)} · Period {period}
          </Text>
          {removedCount > 0 ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              + {plural(removedCount, 'student')} no longer on the roster
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.flex}>{renderBody()}</View>

      <BottomBar>
        <DateStepper value={date} onChange={setDate} />
        <PeriodSelector count={chipCount(selectedPeriod, periodsPerDay)} value={period} onChange={setSelectedPeriod} />
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Pressable
            onPress={shareText}
            disabled={!absentees}
            accessibilityRole="button"
            accessibilityLabel="Share as text message"
            style={({ pressed }) => [
              styles.iconButton,
              { borderColor: colors.border, borderRadius: radius.md, backgroundColor: pressed ? colors.surfaceAlt : colors.surface },
            ]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
          </Pressable>
          <Button
            label="Export CSV"
            icon="share-outline"
            onPress={() => void exportCsv()}
            disabled={count === 0}
            loading={exporting}
            style={styles.flex}
          />
        </View>
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  countBadge: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
