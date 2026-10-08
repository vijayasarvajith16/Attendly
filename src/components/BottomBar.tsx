// Bottom action area that sits above the home indicator, keeping primary
// actions within thumb reach for one-handed use. Pass safeArea={false} inside
// tab screens, where the tab bar already clears the home indicator.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';

export function BottomBar({ children, safeArea = true }: { children: ReactNode; safeArea?: boolean }) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.md + (safeArea ? insets.bottom : 0),
          gap: spacing.sm,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
});
