// Bottom-sheet month calendar for picking a date. Days that already have
// absences show a small red dot. Built with date-fns so it themes like the app.
// Mount it only while open, so it always starts on the selected date's month.

import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

import { useDatesWithAbsences } from '../hooks/useDatesWithAbsences';
import { useTheme } from '../theme/ThemeProvider';
import { MAX_FONT_SCALE } from '../theme/tokens';
import { parseISODate, toISODate, todayISO } from '../utils/dates';
import { tapHaptic } from '../utils/haptics';

interface CalendarModalProps {
  visible: boolean;
  /** Class whose absences are dotted on the calendar; null for no dots. */
  classId: number | null;
  value: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarModal({ visible, classId, value, onSelect, onClose }: CalendarModalProps) {
  const { colors, spacing, radius, typography, touchTarget, motion } = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => startOfMonth(parseISODate(value) ?? new Date()));
  const marked = useDatesWithAbsences(classId, month, visible);
  const today = todayISO();

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) }),
    [month]
  );

  const pick = (date: string) => {
    tapHaptic();
    onSelect(date);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(motion.fast)} style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}>
        <Pressable style={styles.flex} onPress={onClose} accessibilityLabel="Close calendar" />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.duration(motion.base)}
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: spacing.lg,
            paddingBottom: spacing.lg + insets.bottom,
            gap: spacing.md,
          },
        ]}
      >
        <View style={styles.header}>
          <MonthButton icon="chevron-back" label="Previous month" onPress={() => setMonth((m) => addMonths(m, -1))} />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.subtitle, styles.flex, styles.centerText, { color: colors.textPrimary }]}>
            {format(month, 'MMMM yyyy')}
          </Text>
          <MonthButton icon="chevron-forward" label="Next month" onPress={() => setMonth((m) => addMonths(m, 1))} />
        </View>

        <View style={styles.grid}>
          {WEEKDAYS.map((d, i) => (
            <View key={`${d}-${i}`} style={styles.cell}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.caption, { color: colors.textMuted }]}>{d}</Text>
            </View>
          ))}
          {days.map((day) => {
            const iso = toISODate(day);
            const inMonth = isSameMonth(day, month);
            const selected = iso === value;
            const isToday = iso === today;
            return (
              <View key={iso} style={styles.cell}>
                <Pressable
                  onPress={() => pick(iso)}
                  accessibilityRole="button"
                  accessibilityLabel={`${format(day, 'EEEE d MMMM yyyy')}${marked.has(iso) ? ', has absences' : ''}`}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.day,
                    {
                      height: touchTarget,
                      borderRadius: radius.md,
                      backgroundColor: selected ? colors.primary : pressed ? colors.surfaceAlt : 'transparent',
                      borderColor: isToday && !selected ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  <Text
                    maxFontSizeMultiplier={MAX_FONT_SCALE}
                    style={[
                      typography.bodyStrong,
                      { color: selected ? colors.onPrimary : inMonth ? colors.textPrimary : colors.textMuted },
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                  {marked.has(iso) ? (
                    <View style={[styles.dot, { backgroundColor: selected ? colors.onPrimary : colors.danger }]} />
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={[styles.header, { gap: spacing.sm }]}>
          <Pressable
            onPress={() => pick(today)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.footerButton, { minHeight: touchTarget, borderRadius: radius.md, backgroundColor: colors.primarySoft, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.bodyStrong, { color: colors.primary }]}>Today</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.footerButton, { minHeight: touchTarget, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.bodyStrong, { color: colors.textPrimary }]}>Close</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

function MonthButton({ icon, label, onPress }: { icon: 'chevron-back' | 'chevron-forward'; label: string; onPress: () => void }) {
  const { colors, touchTarget } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.monthButton, { width: touchTarget, height: touchTarget, opacity: pressed ? 0.5 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerText: { textAlign: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  header: { flexDirection: 'row', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', paddingVertical: 1, paddingHorizontal: 1 },
  day: { width: '100%', maxWidth: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  dot: { position: 'absolute', bottom: 6, width: 5, height: 5, borderRadius: 3 },
  monthButton: { alignItems: 'center', justifyContent: 'center' },
  footerButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
