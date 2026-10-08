// Two-or-more option segmented control (e.g. Classes / Subjects).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { MAX_FONT_SCALE } from '../theme/tokens';
import { tapHaptic } from '../utils/haptics';

interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ segments, value, onChange }: SegmentedControlProps<T>) {
  const { colors, radius, typography, touchTarget } = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.track, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}
    >
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => {
              if (!selected) {
                tapHaptic();
                onChange(segment.value);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.segment,
              {
                minHeight: touchTarget,
                borderRadius: radius.sm,
                backgroundColor: selected ? colors.surface : 'transparent',
                opacity: pressed && !selected ? 0.6 : 1,
              },
              selected && styles.selectedShadow,
            ]}
          >
            <Text
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              numberOfLines={1}
              style={[typography.bodyStrong, { color: selected ? colors.textPrimary : colors.textSecondary }]}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  selectedShadow: { elevation: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
});
