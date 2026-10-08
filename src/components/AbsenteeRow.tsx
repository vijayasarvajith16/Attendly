// One absentee: roll number, name, and a "Mark present" action.

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { Student } from '../db/students';
import { useTheme } from '../theme/ThemeProvider';
import { MAX_FONT_SCALE } from '../theme/tokens';

interface AbsenteeRowProps {
  student: Student;
  onMarkPresent: (student: Student) => void;
}

function AbsenteeRowBase({ student, onMarkPresent }: AbsenteeRowProps) {
  const { colors, spacing, radius, typography, touchTarget } = useTheme();

  return (
    <View
      style={[
        styles.row,
        {
          minHeight: 64,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingLeft: spacing.md,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.sm,
          gap: spacing.md,
        },
      ]}
    >
      <View style={[styles.rollPill, { backgroundColor: colors.dangerSoft, borderRadius: radius.sm }]}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.subtitle, styles.rollText, { color: colors.danger }]} numberOfLines={1}>
          {student.rollNo}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.body, { color: colors.textPrimary }]} numberOfLines={1}>
          {student.name}
        </Text>
        {!student.active ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.caption, { color: colors.textMuted }]}>No longer on the roster</Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => onMarkPresent(student)}
        accessibilityRole="button"
        accessibilityLabel={`Mark ${student.name}, roll ${student.rollNo}, present`}
        style={({ pressed }) => [
          styles.action,
          { minHeight: touchTarget, paddingHorizontal: spacing.md, gap: spacing.xs, opacity: pressed ? 0.5 : 1 },
        ]}
      >
        <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.caption, { color: colors.success }]}>Mark present</Text>
      </Pressable>
    </View>
  );
}

export const AbsenteeRow = memo(AbsenteeRowBase);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  rollPill: { minWidth: 52, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center' },
  rollText: { fontVariant: ['tabular-nums'] },
  action: { flexDirection: 'row', alignItems: 'center' },
});
