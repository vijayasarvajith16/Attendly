// Previous/next day chevrons around the selected date; tapping the date opens
// the calendar picker.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../theme/ThemeProvider';
import { MAX_FONT_SCALE } from '../theme/tokens';
import { formatDisplayDate, shiftISODate, todayISO } from '../utils/dates';
import { tapHaptic } from '../utils/haptics';
import { CalendarModal } from './CalendarModal';

interface DateStepperProps {
  value: string;
  /** Class whose absences are dotted in the calendar picker. */
  classId: number | null;
  onChange: (date: string) => void;
}

export function DateStepper({ value, classId, onChange }: DateStepperProps) {
  const { colors, spacing, radius, typography, touchTarget } = useTheme();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const isToday = value === todayISO();

  const step = (days: number) => {
    tapHaptic();
    onChange(shiftISODate(value, days));
  };

  const chevron = (direction: -1 | 1) => (
    <Pressable
      onPress={() => step(direction)}
      accessibilityRole="button"
      accessibilityLabel={direction < 0 ? 'Previous day' : 'Next day'}
      style={({ pressed }) => [
        styles.chevron,
        { width: touchTarget, height: touchTarget, borderRadius: radius.md, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' },
      ]}
    >
      <Ionicons name={direction < 0 ? 'chevron-back' : 'chevron-forward'} size={24} color={colors.textPrimary} />
    </Pressable>
  );

  return (
    <View style={[styles.row, { gap: spacing.xs }]}>
      {chevron(-1)}
      <Pressable
        onPress={() => setCalendarOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Date: ${formatDisplayDate(value)}${isToday ? ', today' : ''}. Tap to choose a date.`}
        style={({ pressed }) => [
          styles.dateButton,
          { minHeight: touchTarget, borderRadius: radius.md, backgroundColor: pressed ? colors.surfaceAlt : colors.background, gap: spacing.sm },
        ]}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.bodyStrong, { color: colors.textPrimary }]} numberOfLines={1}>
          {formatDisplayDate(value)}
        </Text>
        {isToday ? (
          <View style={[styles.todayPill, { backgroundColor: colors.primarySoft, borderRadius: radius.pill }]}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.caption, { color: colors.primary }]}>Today</Text>
          </View>
        ) : null}
      </Pressable>
      {chevron(1)}

      {calendarOpen ? (
        <CalendarModal visible classId={classId} value={value} onSelect={onChange} onClose={() => setCalendarOpen(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  chevron: { alignItems: 'center', justifyContent: 'center' },
  dateButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  todayPill: { paddingHorizontal: 8, paddingVertical: 2 },
});
