// Settings: periods per day, JSON backup export/restore, clear all data
// (double confirmation), and app info.

import { useCallback, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { format, isValid } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../src/components/Button';
import { BackupError, countBackup, type DataCounts } from '../src/db/backup';
import { MAX_PERIODS_PER_DAY, MIN_PERIODS_PER_DAY } from '../src/db/settings';
import { useSettings } from '../src/hooks/useSettings';
import { useTheme } from '../src/theme/ThemeProvider';
import { plural } from '../src/utils/format';
import { warningHaptic } from '../src/utils/haptics';
import { ShareUnavailableError } from '../src/utils/shareFile';

function describeCounts(c: DataCounts): string {
  return `${plural(c.students, 'student')} · ${plural(c.absences, 'absence')} over ${plural(c.days, 'day')}`;
}

function formatExportedAt(iso: string): string {
  const date = new Date(iso);
  return isValid(date) ? format(date, 'd MMM yyyy, h:mm a') : 'an unknown date';
}

function showError(title: string, e: unknown, fallback: string): void {
  warningHaptic();
  const message = e instanceof BackupError || e instanceof ShareUnavailableError ? e.message : fallback;
  Alert.alert(title, message);
}

export default function SettingsScreen() {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const { counts, busy } = settings;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const exportBackup = useCallback(async () => {
    try {
      await settings.exportToFile();
    } catch (e) {
      showError('Backup failed', e, 'The backup file could not be created. Please try again.');
    }
  }, [settings]);

  const restoreBackup = useCallback(async () => {
    let backup;
    try {
      backup = await settings.chooseBackup();
    } catch (e) {
      showError("Can't restore this file", e, 'The file could not be read. Your current data has not been changed.');
      return;
    }
    if (!backup) return;

    const incoming = countBackup(backup);
    const current = counts ? `\n\nEverything currently on this phone (${describeCounts(counts)}) will be replaced.` : '';
    Alert.alert(
      'Replace all data?',
      `Backup from ${formatExportedAt(backup.exportedAt)}:\n${describeCounts(incoming)}.${current}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => {
            settings
              .restore(backup)
              .then(() => Alert.alert('Backup restored', `${plural(incoming.students, 'student')} and ${plural(incoming.absences, 'absence')} restored.`))
              .catch((e: unknown) => showError('Restore failed', e, 'Nothing was changed. Please try again.'));
          },
        },
      ]
    );
  }, [settings, counts]);

  const clearEverything = useCallback(() => {
    const finalConfirm = () =>
      Alert.alert('Delete everything?', "This can't be undone.", [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            settings
              .clearAll()
              .then(() => Alert.alert('All data cleared', 'The app is now empty. Import a student list to start again.'))
              .catch((e: unknown) => showError('Could not clear data', e, 'Nothing was deleted. Please try again.'));
          },
        },
      ]);

    Alert.alert(
      'Clear all data?',
      `This permanently deletes ${counts ? describeCounts(counts) : 'all students and attendance'} and your settings from this phone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export backup first', onPress: () => void exportBackup() },
        { text: 'Continue', style: 'destructive', onPress: finalConfirm },
      ]
    );
  }, [settings, counts, exportBackup]);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.lg + insets.bottom, gap: spacing.xl }}>
      <Section title="CLASS">
        <View style={[styles.row, { gap: spacing.md }]}>
          <View style={styles.flex}>
            <Text style={[typography.bodyStrong, { color: colors.textPrimary }]}>Periods per day</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>Period chips on the attendance screen</Text>
          </View>
          <PeriodStepper
            value={settings.periods}
            onStep={(delta) => {
              settings.stepPeriods(delta).catch((e: unknown) => showError('Not saved', e, 'The setting could not be saved. Please try again.'));
            }}
          />
        </View>
      </Section>

      <Section title="BACKUP">
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Ionicons name="server-outline" size={18} color={colors.textSecondary} />
          <Text style={[typography.body, styles.flex, { color: colors.textPrimary }]}>
            {counts ? describeCounts(counts) : settings.countsFailed ? "Couldn't count your data" : 'Counting…'}
          </Text>
        </View>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Save a backup to Google Drive, email or Files. Restore it after reinstalling the app or on a new phone.
        </Text>
        <Button label="Export backup" icon="share-outline" onPress={() => void exportBackup()} loading={busy === 'export'} disabled={busy !== null} fullWidth />
        <Button
          label="Restore from backup"
          icon="refresh"
          variant="secondary"
          onPress={() => void restoreBackup()}
          loading={busy === 'restore'}
          disabled={busy !== null}
          fullWidth
        />
      </Section>

      <Section title="DANGER ZONE">
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Deletes every student, all attendance and your settings from this phone.
        </Text>
        <Button label="Clear all data" icon="trash-outline" variant="danger" onPress={clearEverything} loading={busy === 'clear'} disabled={busy !== null} fullWidth />
      </Section>

      <View style={[styles.about, { gap: spacing.xs }]}>
        <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
        <Text style={[typography.caption, styles.centerText, { color: colors.textSecondary }]}>Attendly · version {version}</Text>
        <Text style={[typography.caption, styles.centerText, { color: colors.textMuted }]}>
          Your data is stored on this device only. Nothing is sent over the internet.
        </Text>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }]}>
        {children}
      </View>
    </View>
  );
}

function PeriodStepper({ value, onStep }: { value: number; onStep: (delta: -1 | 1) => void }) {
  const { colors, radius, typography, touchTarget } = useTheme();

  const stepButton = (delta: -1 | 1) => {
    const disabled = delta < 0 ? value <= MIN_PERIODS_PER_DAY : value >= MAX_PERIODS_PER_DAY;
    return (
      <Pressable
        onPress={() => onStep(delta)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={delta < 0 ? 'Fewer periods' : 'More periods'}
        style={({ pressed }) => [
          styles.stepButton,
          {
            width: touchTarget,
            height: touchTarget,
            borderRadius: radius.md,
            backgroundColor: pressed ? colors.primarySoft : colors.surfaceAlt,
            opacity: disabled ? 0.35 : 1,
          },
        ]}
      >
        <Ionicons name={delta < 0 ? 'remove' : 'add'} size={22} color={colors.primary} />
      </Pressable>
    );
  };

  return (
    <View style={styles.row} accessibilityLabel={`${value} periods per day`}>
      {stepButton(-1)}
      <Text style={[typography.title, styles.stepValue, { color: colors.textPrimary }]}>{value}</Text>
      {stepButton(1)}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth },
  about: { alignItems: 'center', paddingBottom: 16 },
  centerText: { textAlign: 'center' },
  stepButton: { alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 44, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
