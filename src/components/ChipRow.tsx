// Horizontally scrollable single-choice chips (report range presets, period filter).

import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { MAX_FONT_SCALE } from '../theme/tokens';
import { tapHaptic } from '../utils/haptics';

export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
}

interface ChipRowProps<T extends string | number> {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

export function ChipRow<T extends string | number>({ options, value, onChange, accessibilityLabel }: ChipRowProps<T>) {
  const { colors, spacing, radius, typography, touchTarget } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm }}
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => {
              if (!selected) {
                tapHaptic();
                onChange(option.value);
              }
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.chip,
              {
                minHeight: touchTarget,
                minWidth: touchTarget,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.lg,
                backgroundColor: selected ? colors.primary : colors.surfaceAlt,
                borderColor: selected ? colors.primary : colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.bodyStrong, { color: selected ? colors.onPrimary : colors.textPrimary }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
