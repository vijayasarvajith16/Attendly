// Root layout: gesture + safe-area roots, theme, toasts, database init
// (migrations run before any screen renders), and the stack navigator:
// home (classes) → class detail (tabs), plus All Students, Import, Settings.

import { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DATABASE_NAME, initDatabase } from '../src/db/schema';
import { AppThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { pushOnce } from '../src/utils/navigation';
import { EmptyState } from '../src/components/EmptyState';
import { HeaderIcon } from '../src/components/HeaderIcon';
import { ToastProvider } from '../src/components/Toast';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <Suspense fallback={<BootScreen />}>
            <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase} useSuspense>
              <ToastProvider>
                <RootStack />
              </ToastProvider>
            </SQLiteProvider>
          </Suspense>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { colors, scheme, typography } = useTheme();

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
            title: 'Attendly',
            headerRight: () => (
              <View style={styles.headerActions}>
                <HeaderIcon icon="people-outline" label="All students" onPress={() => pushOnce('/students')} />
                <HeaderIcon icon="settings-outline" label="Settings" onPress={() => pushOnce('/settings')} />
              </View>
            ),
          }}
        />
        <Stack.Screen name="class/[id]" options={{ title: '' }} />
        <Stack.Screen name="students" options={{ title: 'All students' }} />
        <Stack.Screen name="import" options={{ title: 'Import list' }} />
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
  headerActions: { flexDirection: 'row', alignItems: 'center' },
});
