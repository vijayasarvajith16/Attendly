// Design tokens: colors (light + dark), spacing, radius, typography and motion.
// Every screen and component reads styling from here via useTheme().

import type { TextStyle } from 'react-native';

export type ColorScheme = 'light' | 'dark';

export interface Palette {
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimary: string;
  success: string;
  successSoft: string;
  onSuccess: string;
  danger: string;
  dangerSoft: string;
  onDanger: string;
  warning: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  overlay: string;
}

const light: Palette = {
  primary: '#4F46E5',
  primaryPressed: '#4338CA',
  primarySoft: '#E0E7FF',
  onPrimary: '#FFFFFF',
  success: '#15803D',
  successSoft: '#DCFCE7',
  onSuccess: '#FFFFFF',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  onDanger: '#FFFFFF',
  warning: '#D97706',
  background: '#F5F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0F6',
  border: '#E2E5ED',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#6B7280',
  overlay: 'rgba(17, 24, 39, 0.45)',
};

const dark: Palette = {
  primary: '#818CF8',
  primaryPressed: '#6366F1',
  primarySoft: '#262A4A',
  onPrimary: '#0B0D14',
  success: '#4ADE80',
  successSoft: '#12291B',
  onSuccess: '#0B0D14',
  danger: '#F87171',
  dangerSoft: '#3A1619',
  onDanger: '#0B0D14',
  warning: '#FBBF24',
  background: '#0B0D14',
  surface: '#151823',
  surfaceAlt: '#1E2230',
  border: '#2A2F3F',
  textPrimary: '#F3F4F6',
  textSecondary: '#C2C7D0',
  textMuted: '#7B8190',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const palettes: Record<ColorScheme, Palette> = { light, dark };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  subtitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
} as const satisfies Record<string, TextStyle>;

/** Cap for system font scaling on fixed-height rows and chips, so large text never clips. */
export const MAX_FONT_SCALE = 1.3;

/** Minimum height/width for anything tappable. */
export const touchTarget = 48;

/** Animation durations in ms. Everything stays under 250ms. */
export const motion = {
  fast: 150,
  base: 220,
} as const;

export interface Theme {
  scheme: ColorScheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  touchTarget: number;
  motion: typeof motion;
}

export function getTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: palettes[scheme],
    spacing,
    radius,
    typography,
    touchTarget,
    motion,
  };
}
