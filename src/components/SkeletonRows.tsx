// Placeholder rows shown while the roster loads. They fade in briefly instead
// of pulsing, so every animation stays under 250ms.

import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import { STUDENT_ROW_HEIGHT } from './StudentRow';

export function SkeletonRows({ count = 8 }: { count?: number }) {
  const { colors, spacing, radius, motion } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(motion.base)} accessibilityLabel="Loading students">
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[styles.row, { borderBottomColor: colors.border, paddingHorizontal: spacing.lg, gap: spacing.md }]}
        >
          <View style={[styles.block, { width: 40, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm }]} />
          <View style={[styles.block, { flex: 1, maxWidth: 120 + ((i * 37) % 90), backgroundColor: colors.surfaceAlt, borderRadius: radius.sm }]} />
          <View style={styles.flex} />
          <View style={[styles.circle, { backgroundColor: colors.surfaceAlt }]} />
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { height: STUDENT_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  block: { height: 14 },
  circle: { width: 32, height: 32, borderRadius: 16 },
});
