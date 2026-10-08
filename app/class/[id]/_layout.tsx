// Class detail: four tabs (Attendance, Absentees, Students, Reports) sharing
// one ClassProvider, so the selected date and period carry across tabs.
// The header shows the class name with rename/delete options.

import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View, type ColorValue } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ClassFormModal } from '../../../src/components/ClassFormModal';
import { EmptyState } from '../../../src/components/EmptyState';
import { HeaderIcon } from '../../../src/components/HeaderIcon';
import { useClassActions } from '../../../src/hooks/useClassActions';
import { ClassProvider, useClassContext } from '../../../src/hooks/useClassContext';
import { useTheme } from '../../../src/theme/ThemeProvider';

/** Back to the class list. dismissTo pops the root stack (router.back() would only switch tabs). */
function goHome() {
  router.dismissTo('/');
}

export default function ClassLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const classId = Number(id);

  if (!Number.isInteger(classId) || classId <= 0) {
    return <EmptyState icon="alert-circle-outline" tone="error" title="Class not found" actionLabel="Back to classes" onAction={goHome} />;
  }
  return (
    <ClassProvider classId={classId}>
      <ClassTabs />
    </ClassProvider>
  );
}

type TabIcon = keyof typeof Ionicons.glyphMap;

function tabIcon(name: TabIcon) {
  // Tab bar icons size themselves; colour follows the active/inactive tint.
  function Icon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={color} />;
  }
  return Icon;
}

function ClassTabs() {
  const { colors } = useTheme();
  const { classInfo, classError, reloadClass } = useClassContext();
  const actions = useClassActions();
  const [renaming, setRenaming] = useState(false);

  const showOptions = useCallback(() => {
    if (!classInfo) return;
    Alert.alert(classInfo.name, undefined, [
      { text: 'Rename', onPress: () => setRenaming(true) },
      { text: 'Delete', style: 'destructive', onPress: () => actions.confirmDelete(classInfo, goHome) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [classInfo, actions]);

  if (classError) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: '', headerRight: undefined }} />
        <EmptyState icon="alert-circle-outline" tone="error" title="Couldn't open this class" message="Please try again." actionLabel="Try again" onAction={reloadClass} />
      </View>
    );
  }

  if (classInfo === undefined) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: '', headerRight: undefined }} />
        <EmptyState icon="trash-outline" title="This class no longer exists" actionLabel="Back to classes" onAction={goHome} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: classInfo?.name ?? '',
          headerRight: () => <HeaderIcon icon="ellipsis-horizontal-circle-outline" label="Class options" onPress={showOptions} />,
        }}
      />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Attendance', tabBarIcon: tabIcon('checkmark-done') }} />
        <Tabs.Screen name="absentees" options={{ title: 'Absentees', tabBarIcon: tabIcon('person-remove-outline') }} />
        <Tabs.Screen name="students" options={{ title: 'Students', tabBarIcon: tabIcon('people-outline') }} />
        <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: tabIcon('bar-chart-outline') }} />
      </Tabs>
      {renaming && classInfo ? (
        <ClassFormModal
          mode="rename"
          initialName={classInfo.name}
          initialKind={classInfo.kind}
          onSubmit={async (name) => {
            await actions.rename(classInfo.id, name);
            reloadClass();
          }}
          onClose={() => setRenaming(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
