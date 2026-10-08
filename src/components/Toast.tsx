// Non-blocking confirmation messages ("Roster saved", "Removed from class").
// Wrap the app in <ToastProvider> and call useToast().show(message).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import { MAX_FONT_SCALE } from '../theme/tokens';

type ToastTone = 'success' | 'info';

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
}

const VISIBLE_MS = 2400;
/** Keeps the toast above bottom tab bars and action bars. */
const BOTTOM_OFFSET = 120;

const ToastContext = createContext<ToastApi>({ show: () => undefined });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    nextId.current += 1;
    setToast({ id: nextId.current, message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? <ToastView key={toast.id} message={toast.message} tone={toast.tone} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ message, tone }: { message: string; tone: ToastTone }) {
  const { colors, spacing, radius, typography, motion, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const bg = scheme === 'dark' ? colors.surfaceAlt : colors.textPrimary;
  const fg = scheme === 'dark' ? colors.textPrimary : colors.surface;

  return (
    <Animated.View
      entering={FadeInDown.duration(motion.base)}
      exiting={FadeOutDown.duration(motion.fast)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.toast,
        {
          bottom: insets.bottom + BOTTOM_OFFSET,
          left: spacing.lg,
          right: spacing.lg,
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <Ionicons name={tone === 'success' ? 'checkmark-circle' : 'information-circle'} size={20} color={tone === 'success' ? colors.success : fg} />
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.bodyStrong, styles.text, { color: fg }]}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  text: { flex: 1 },
});
