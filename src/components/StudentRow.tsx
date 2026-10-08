// One student in the roster. Swipe left to reveal "Absent" (or "Present" if
// already absent) and release to apply; tap to toggle. Haptics fire when the
// swipe crosses the threshold and when the mark is applied.

import { memo, useLayoutEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { Student } from '../db/students';
import { useTheme } from '../theme/ThemeProvider';
import { MAX_FONT_SCALE } from '../theme/tokens';
import { selectionHaptic } from '../utils/haptics';

export const STUDENT_ROW_HEIGHT = 64;
const ACTION_WIDTH = 104;
const SWIPE_THRESHOLD = 72;

interface StudentRowProps {
  student: Student;
  absent: boolean;
  disabled?: boolean;
  onToggle: (studentId: number) => void;
  onSetAbsent: (studentId: number, absent: boolean) => void;
}

function SwipeAction({ translation, absent }: { translation: SharedValue<number>; absent: boolean }) {
  const { colors, typography } = useTheme();

  // Tick once each time the drag crosses the threshold.
  useAnimatedReaction(
    () => translation.value <= -SWIPE_THRESHOLD,
    (crossed, previous) => {
      if (crossed && previous === false) scheduleOnRN(selectionHaptic);
    }
  );

  const contentStyle = useAnimatedStyle(() => {
    const p = interpolate(-translation.value, [0, SWIPE_THRESHOLD], [0.6, 1], 'clamp');
    return { opacity: p, transform: [{ scale: p }] };
  });

  const bg = absent ? colors.success : colors.danger;
  const fg = absent ? colors.onSuccess : colors.onDanger;

  return (
    <View style={[styles.action, { backgroundColor: bg }]}>
      <Animated.View style={[styles.actionContent, contentStyle]}>
        <Ionicons name={absent ? 'checkmark-circle' : 'close-circle'} size={22} color={fg} />
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.caption, { color: fg }]}>{absent ? 'Present' : 'Absent'}</Text>
      </Animated.View>
    </View>
  );
}

function StudentRowBase({ student, absent, disabled = false, onToggle, onSetAbsent }: StudentRowProps) {
  const { colors, spacing, radius, typography, motion } = useTheme();
  const swipeRef = useRef<SwipeableMethods>(null);

  // Animate only real state changes; snap when FlashList recycles the row for another student.
  const progress = useSharedValue(absent ? 1 : 0);
  const pop = useSharedValue(1);
  const shown = useRef({ id: student.id, absent });
  useLayoutEffect(() => {
    const target = absent ? 1 : 0;
    if (shown.current.id === student.id && shown.current.absent !== absent) {
      progress.value = withTiming(target, { duration: motion.base });
      pop.value = withSequence(withTiming(1.25, { duration: 90 }), withTiming(1, { duration: 120 }));
    } else {
      progress.value = target;
    }
    shown.current = { id: student.id, absent };
  }, [absent, student.id, progress, pop, motion.base]);

  const surface = colors.surface;
  const dangerSoft = colors.dangerSoft;
  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [surface, dangerSoft]),
  }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const status = absent ? 'absent' : 'present';

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      enabled={!disabled}
      friction={1.4}
      rightThreshold={SWIPE_THRESHOLD}
      overshootRight={false}
      dragOffsetFromRightEdge={12}
      renderRightActions={(_progress, translation) => <SwipeAction translation={translation} absent={absent} />}
      onSwipeableWillOpen={() => {
        onSetAbsent(student.id, !absent);
        swipeRef.current?.close();
      }}
    >
      <Pressable
        onPress={() => onToggle(student.id)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Roll ${student.rollNo}, ${student.name}, ${status}`}
        accessibilityHint={absent ? 'Double tap to mark present' : 'Double tap to mark absent'}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={() => onToggle(student.id)}
      >
        {({ pressed }) => (
          <Animated.View
            style={[
              styles.row,
              rowStyle,
              { borderBottomColor: colors.border, paddingHorizontal: spacing.lg, gap: spacing.md, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.subtitle, styles.roll, { color: absent ? colors.danger : colors.textPrimary }]} numberOfLines={1}>
              {student.rollNo}
            </Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.body, styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
              {student.name}
            </Text>
            <Animated.View
              style={[
                styles.badge,
                badgeStyle,
                { borderRadius: radius.pill, backgroundColor: absent ? colors.danger : colors.successSoft },
              ]}
            >
              {absent ? (
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.bodyStrong, { color: colors.onDanger }]}>A</Text>
              ) : (
                <Ionicons name="checkmark" size={18} color={colors.success} />
              )}
            </Animated.View>
          </Animated.View>
        )}
      </Pressable>
    </ReanimatedSwipeable>
  );
}

export const StudentRow = memo(StudentRowBase);

const styles = StyleSheet.create({
  row: {
    height: STUDENT_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  roll: { minWidth: 52, fontVariant: ['tabular-nums'] },
  name: { flex: 1 },
  badge: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  action: { width: ACTION_WIDTH, alignItems: 'center', justifyContent: 'center' },
  actionContent: { alignItems: 'center', gap: 2 },
});
