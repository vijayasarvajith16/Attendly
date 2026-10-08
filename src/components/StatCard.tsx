// Total / Present / Absent counts for the current session. Numbers animate
// in briefly when they change.

import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import { MAX_FONT_SCALE } from '../theme/tokens';

interface StatCardProps {
  total: number;
  present: number;
  absent: number;
}

export function StatCard({ total, present, absent }: StatCardProps) {
  const { colors, spacing, radius, typography, motion } = useTheme();

  const items = [
    { label: 'Total', value: total, color: colors.textPrimary },
    { label: 'Present', value: present, color: colors.success },
    { label: 'Absent', value: absent, color: colors.danger },
  ];

  return (
    <View
      accessible
      accessibilityLabel={`${total} students. ${present} present, ${absent} absent.`}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing.md }]}
    >
      {items.map((item, i) => (
        <View
          key={item.label}
          style={[styles.cell, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }]}
        >
          <Animated.Text
            key={item.value}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            entering={FadeIn.duration(motion.fast)}
            style={[typography.title, styles.number, { color: item.color }]}
          >
            {item.value}
          </Animated.Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.caption, { color: colors.textSecondary }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth },
  cell: { flex: 1, alignItems: 'center' },
  number: { fontVariant: ['tabular-nums'] },
});
