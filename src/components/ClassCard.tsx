// One class or subject on the home screen: name, student count and today's
// absentees. Tap to open; long-press (or the ⋯ button) for rename/delete.

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { ClassSummary } from '../db/classes';
import { useTheme } from '../theme/ThemeProvider';
import { MAX_FONT_SCALE } from '../theme/tokens';
import { plural } from '../utils/format';

interface ClassCardProps {
  item: ClassSummary;
  onOpen: (item: ClassSummary) => void;
  onMore: (item: ClassSummary) => void;
}

function ClassCardBase({ item, onOpen, onMore }: ClassCardProps) {
  const { colors, spacing, radius, typography, touchTarget } = useTheme();
  const isClass = item.kind === 'CLASS';

  return (
    <Pressable
      onPress={() => onOpen(item)}
      onLongPress={() => onMore(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${plural(item.studentCount, 'student')}, ${item.absentToday} absent today`}
      accessibilityHint="Opens attendance. Long press for more options."
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          paddingLeft: spacing.lg,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.sm,
          gap: spacing.md,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: isClass ? colors.primarySoft : colors.successSoft, borderRadius: radius.md }]}>
        <Ionicons name={isClass ? 'people' : 'book'} size={20} color={isClass ? colors.primary : colors.success} />
      </View>
      <View style={[styles.flex, { paddingVertical: spacing.md }]}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.subtitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
          {plural(item.studentCount, 'student')}
          {item.absentToday > 0 ? (
            <Text style={{ color: colors.danger }}>{` · ${item.absentToday} absent today`}</Text>
          ) : null}
        </Text>
      </View>
      <Pressable
        onPress={() => onMore(item)}
        accessibilityRole="button"
        accessibilityLabel={`More options for ${item.name}`}
        style={({ pressed }) => [styles.more, { width: touchTarget, height: touchTarget, opacity: pressed ? 0.4 : 1 }]}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

export const ClassCard = memo(ClassCardBase);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', minHeight: 72, borderWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  more: { alignItems: 'center', justifyContent: 'center' },
});
