// Centered icon + title + message with an optional action, used for empty,
// error and "nothing here yet" states on every screen.

import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

type Tone = 'neutral' | 'positive' | 'error';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  tone?: Tone;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  message,
  tone = 'neutral',
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  const { colors, spacing, typography, motion } = useTheme();

  const toneColors: Record<Tone, { fg: string; bg: string }> = {
    neutral: { fg: colors.primary, bg: colors.primarySoft },
    positive: { fg: colors.success, bg: colors.successSoft },
    error: { fg: colors.danger, bg: colors.dangerSoft },
  };
  const t = toneColors[tone];

  return (
    <Animated.View entering={FadeIn.duration(motion.base)} style={[styles.container, { padding: spacing.xl, gap: spacing.md }]}>
      <View style={[styles.iconCircle, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={36} color={t.fg} />
      </View>
      <Text style={[typography.subtitle, styles.center, { color: colors.textPrimary }]}>{title}</Text>
      {message ? <Text style={[typography.body, styles.center, { color: colors.textSecondary }]}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: spacing.sm }} />
      ) : null}
      {secondaryActionLabel && onSecondaryAction ? (
        <Button label={secondaryActionLabel} onPress={onSecondaryAction} variant="ghost" />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
    maxWidth: 320,
  },
});
