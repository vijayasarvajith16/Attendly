// Root layout: gesture + safe-area roots, theme, database init (migrations run
// before any screen renders), and the stack navigator for all screens.

import { Suspense } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { DATABASE_NAME, initDatabase } from '../src/db/schema';
import { AppThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { pushOnce } from '../src/utils/navigation';
import { EmptyState } from '../src/components/EmptyState';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <Suspense fallback={<BootScreen />}>
            <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase} useSuspense>
              <RootStack />
            </SQLiteProvider>
          </Suspense>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { colors, scheme, typography, touchTarget } = useTheme();

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { ...typography.subtitle, color: colors.textPrimary },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
          animationDuration: 220,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Attendance',
            headerRight: () => (
              <Pressable
                onPress={() => pushOnce('/settings')}
                accessibilityRole="button"
                accessibilityLabel="Settings"
                hitSlop={8}
                style={({ pressed }) => [styles.headerButton, { minWidth: touchTarget, opacity: pressed ? 0.5 : 1 }]}
              >
                <Ionicons name="settings-outline" size={24} color={colors.textPrimary} />
              </Pressable>
            ),
          }}
        />
        <Stack.Screen name="absentees" options={{ title: 'Absentees' }} />
        <Stack.Screen name="import" options={{ title: 'Import roster' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}

function BootScreen() {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.background, gap: spacing.md }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[typography.caption, { color: colors.textSecondary }]}>Opening your class register…</Text>
    </View>
  );
}

// Rendered by Expo Router in place of the layout if startup (e.g. the database
// migration) throws. It replaces the layout, so it sets up its own providers.
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <StartupError {...props} />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

function StartupError({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <EmptyState
        icon="alert-circle-outline"
        tone="error"
        title="Something went wrong"
        message={`The app couldn't start. Your saved data has not been changed.\n\n${error.message}`}
        actionLabel="Try again"
        onAction={() => {
          void retry();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
