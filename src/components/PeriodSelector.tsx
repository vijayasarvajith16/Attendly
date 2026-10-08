// Horizontally scrollable period chips (1..count). The selected period is
// highlighted and kept in view.

import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { MAX_FONT_SCALE } from '../theme/tokens';
import { tapHaptic } from '../utils/haptics';

interface PeriodSelectorProps {
  count: number;
  value: number;
  onChange: (period: number) => void;
}

const CHIP_SIZE = 48;

export function PeriodSelector({ count, value, onChange }: PeriodSelectorProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const periods = Array.from({ length: count }, (_, i) => i + 1);

  useEffect(() => {
    const x = Math.max(0, (value - 3) * (CHIP_SIZE + spacing.sm));
    scrollRef.current?.scrollTo({ x, animated: true });
  }, [value, spacing.sm]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm }}
      accessibilityRole="tablist"
    >
      {periods.map((p) => {
        const selected = p === value;
        return (
          <Pressable
            key={p}
            onPress={() => {
              if (!selected) {
                tapHaptic();
                onChange(p);
              }
            }}
            accessibilityRole="tab"
            accessibilityLabel={`Period ${p}`}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.chip,
              {
                borderRadius: radius.md,
                backgroundColor: selected ? colors.primary : colors.surfaceAlt,
                borderColor: selected ? colors.primary : colors.border,
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.subtitle, { color: selected ? colors.onPrimary : colors.textPrimary }]}>{p}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
