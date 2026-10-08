// Provides the app theme (light/dark from the system setting) and keeps
// Expo Router's navigation theme in sync so headers match the app colors.

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider, type Theme as NavigationTheme } from 'expo-router';

import { getTheme, type ColorScheme, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(getTheme('light'));

export function useSystemScheme(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

function toNavigationTheme(theme: Theme): NavigationTheme {
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
  };
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useSystemScheme();
  const theme = useMemo(() => getTheme(scheme), [scheme]);
  const navigationTheme = useMemo(() => toNavigationTheme(theme), [theme]);

  // Root window colour, so screen transitions and the keyboard never flash white in dark mode.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => undefined);
  }, [theme.colors.background]);

  return (
    <ThemeContext.Provider value={theme}>
      <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
