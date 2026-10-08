// Reports tab: the class's absences over a date range (presets or custom),
// optionally for one period, grouped by date, with CSV export.

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { addDays, format, startOfMonth, startOfWeek } from 'date-fns';

import { BottomBar } from '../../../src/components/BottomBar';
import { Button } from '../../../src/components/Button';
import { CalendarModal } from '../../../src/components/CalendarModal';
import { ChipRow, type ChipOption } from '../../../src/components/ChipRow';
import { EmptyState } from '../../../src/components/EmptyState';
import { useToast } from '../../../src/components/Toast';
import { useClassContext } from '../../../src/hooks/useClassContext';
import { useReport, type ReportPeriodGroup } from '../../../src/hooks/useReport';
import { useToday } from '../../../src/hooks/useToday';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { MAX_FONT_SCALE } from '../../../src/theme/tokens';
import { formatDisplayDate, parseISODate, shiftISODate, toISODate } from '../../../src/utils/dates';
import { shareReportCsv } from '../../../src/utils/exportCsv';
import { plural } from '../../../src/utils/format';
import { successHaptic, warningHaptic } from '../../../src/utils/haptics';
import { ShareUnavailableError } from '../../../src/utils/shareFile';

type Preset = 'week' | 'month' | 'last30' | 'custom';

const PRESETS: readonly ChipOption<Preset>[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
];

/** 0 stands for "all periods" in the chip row. */
const ALL_PERIODS = 0;

function presetRange(preset: Exclude<Preset, 'custom'>, today: string): { from: string; to: string } {
  const now = parseISODate(today) ?? new Date();
  switch (preset) {
    case 'week':
      return { from: toISODate(startOfWeek(now, { weekStartsOn: 1 })), to: today };
    case 'month':
      return { from: toISODate(startOfMonth(now)), to: today };
    case 'last30':
      return { from: toISODate(addDays(now, -29)), to: today };
  }
}

function shortDate(iso: string): string {
  const d = parseISODate(iso);
  return d ? format(d, 'd MMM yyyy') : iso;
}

export default function ReportsTab() {
  const { colors, spacing, radius, typography } = useTheme();
  const { classId, classInfo, periodChipCount } = useClassContext();
  const toast = useToast();
  const today = useToday();

  const [preset, setPreset] = useState<Preset>('month');
  const [custom, setCustom] = useState(() => ({ from: shiftISODate(today, -6), to: today }));
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const [periodFilter, setPeriodFilter] = useState(ALL_PERIODS);
  const [exporting, setExporting] = useState(false);

  const range = preset === 'custom' ? custom : presetRange(preset, today);
  const period = periodFilter === ALL_PERIODS ? null : periodFilter;
  const { records, days, summary, error, reload } = useReport(classId, range.from, range.to, period);

  const periodOptions = useMemo<ChipOption<number>[]>(
    () => [{ value: ALL_PERIODS, label: 'All periods' }, ...Array.from({ length: periodChipCount }, (_, i) => ({ value: i + 1, label: `P${i + 1}` }))],
    [periodChipCount]
  );

  const setCustomDate = useCallback((which: 'from' | 'to', value: string) => {
    setCustom((prev) => {
      const next = { ...prev, [which]: value };
      return next.from <= next.to ? next : { from: next.to, to: next.from }; // keep from ≤ to
    });
  }, []);

  const exportCsv = useCallback(async () => {
    if (!records || records.length === 0) return;
    setExporting(true);
    try {
      await shareReportCsv(records, classInfo?.name ?? 'Class', range.from, range.to, period);
      successHaptic();
      toast.show('Report exported');
    } catch (e) {
      warningHaptic();
      Alert.alert('Export failed', e instanceof ShareUnavailableError ? e.message : 'The CSV file could not be created. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [records, classInfo, range.from, range.to, period, toast]);

  const sections = useMemo(() => (days ?? []).map((d) => ({ key: d.date, date: d.date, absences: d.absences, data: d.periods })), [days]);

  const renderBody = () => {
    if (error) {
      return <EmptyState icon="alert-circle-outline" tone="error" title="Couldn't load the report" message={error} actionLabel="Try again" onAction={reload} />;
    }
    if (!days) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (days.length === 0) {
      return (
        <EmptyState
          icon="happy-outline"
          tone="positive"
          title="No absences in this range"
          message="Only absences are saved, so days when everyone was present don't appear here."
        />
      );
    }
    return (
      <SectionList
        sections={sections}
        keyExtractor={(group) => `${group.period}`}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }]}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.bodyStrong, styles.flex, { color: colors.textPrimary }]}>
              {formatDisplayDate(section.date)}
            </Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.caption, { color: colors.danger }]}>
              {plural(section.absences, 'absence')}
            </Text>
          </View>
        )}
        renderItem={({ item }) => <PeriodCard group={item} />}
      />
    );
  };

  return (
    <View style={styles.flex}>
      <View style={{ paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm }}>
        <ChipRow options={PRESETS} value={preset} onChange={setPreset} accessibilityLabel="Date range" />
        {preset === 'custom' ? (
          <View style={[styles.row, { gap: spacing.sm }]}>
            {(['from', 'to'] as const).map((which) => (
              <Pressable
                key={which}
                onPress={() => setPicking(which)}
                accessibilityRole="button"
                accessibilityLabel={`${which === 'from' ? 'From' : 'To'} ${formatDisplayDate(custom[which])}. Tap to change.`}
                style={({ pressed }) => [
                  styles.dateButton,
                  { borderColor: colors.border, borderRadius: radius.md, backgroundColor: pressed ? colors.surfaceAlt : colors.surface, paddingHorizontal: spacing.md, gap: spacing.sm },
                ]}
              >
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>{which === 'from' ? 'From' : 'To'}</Text>
                <Text style={[typography.bodyStrong, { color: colors.textPrimary }]} numberOfLines={1}>
                  {shortDate(custom[which])}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <ChipRow options={periodOptions} value={periodFilter} onChange={setPeriodFilter} accessibilityLabel="Period filter" />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {shortDate(range.from)} – {shortDate(range.to)}
          {summary ? ` · ${plural(summary.absences, 'absence')} · ${plural(summary.students, 'student')} · ${plural(summary.days, 'day')}` : ''}
        </Text>
      </View>

      <View style={[styles.flex, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>{renderBody()}</View>

      <BottomBar safeArea={false}>
        <Button
          label="Export CSV"
          icon="share-outline"
          onPress={() => void exportCsv()}
          disabled={!records || records.length === 0}
          loading={exporting}
          fullWidth
        />
      </BottomBar>

      {picking ? (
        <CalendarModal
          visible
          classId={classId}
          value={custom[picking]}
          onSelect={(value) => setCustomDate(picking, value)}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </View>
  );
}

function PeriodCard({ group }: { group: ReportPeriodGroup }) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.md, gap: spacing.xs },
      ]}
    >
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.caption, { color: colors.textSecondary }]}>
        Period {group.period} · {group.absentees.length} absent
      </Text>
      {group.absentees.map((a) => (
        <View key={a.studentId} style={[styles.row, { gap: spacing.md }]}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.bodyStrong, styles.roll, { color: colors.danger }]}>
            {a.rollNo}
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.body, styles.flex, { color: colors.textPrimary }]} numberOfLines={1}>
            {a.name}
            {!a.inClass ? <Text style={[typography.caption, { color: colors.textMuted }]}> · no longer in class</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
  dateButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  card: { borderWidth: StyleSheet.hairlineWidth },
  roll: { minWidth: 48, fontVariant: ['tabular-nums'] },
});
