// Home: the teacher's classes and subjects. A segmented control switches
// between them, the + button creates one, and each card opens its class.

import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClassCard } from '../src/components/ClassCard';
import { ClassFormModal } from '../src/components/ClassFormModal';
import { EmptyState } from '../src/components/EmptyState';
import { SegmentedControl } from '../src/components/SegmentedControl';
import type { ClassKind, ClassSummary } from '../src/db/classes';
import { useClassActions } from '../src/hooks/useClassActions';
import { useClasses } from '../src/hooks/useClasses';
import { useTheme } from '../src/theme/ThemeProvider';
import { pushOnce } from '../src/utils/navigation';

type FormState = { mode: 'create' } | { mode: 'rename'; item: ClassSummary } | null;

function openClass(classId: number) {
  pushOnce({ pathname: '/class/[id]', params: { id: String(classId) } });
}

export default function HomeScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<ClassKind>('CLASS');
  const [form, setForm] = useState<FormState>(null);
  const { classes, counts, error, reload } = useClasses(kind);
  const actions = useClassActions();
  const noun = kind === 'CLASS' ? 'class' : 'subject';

  const showOptions = useCallback(
    (item: ClassSummary) => {
      Alert.alert(item.name, undefined, [
        { text: 'Rename', onPress: () => setForm({ mode: 'rename', item }) },
        { text: 'Delete', style: 'destructive', onPress: () => actions.confirmDelete(item, reload) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [actions, reload]
  );

  const submitForm = useCallback(
    async (name: string, formKind: ClassKind) => {
      if (form?.mode === 'rename') {
        await actions.rename(form.item.id, name);
        reload();
      } else {
        const id = await actions.create(name, formKind);
        setKind(formKind);
        openClass(id);
      }
    },
    [form, actions, reload]
  );

  const renderItem = useCallback(
    ({ item }: { item: ClassSummary }) => <ClassCard item={item} onOpen={(c) => openClass(c.id)} onMore={showOptions} />,
    [showOptions]
  );

  const renderBody = () => {
    if (error) {
      return <EmptyState icon="alert-circle-outline" tone="error" title="Couldn't load your classes" message={error} actionLabel="Try again" onAction={reload} />;
    }
    if (!classes) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (classes.length === 0) {
      return (
        <EmptyState
          icon={kind === 'CLASS' ? 'people-outline' : 'book-outline'}
          title={kind === 'CLASS' ? 'No classes yet' : 'No subjects yet'}
          message={`Create a ${noun}, then import its student list to start taking attendance.`}
          actionLabel={`Create ${noun}`}
          onAction={() => setForm({ mode: 'create' })}
        />
      );
    }
    return (
      <FlashList
        data={classes}
        renderItem={renderItem}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 96 + insets.bottom }}
      />
    );
  };

  return (
    <View style={styles.flex}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <SegmentedControl
          segments={[
            { value: 'CLASS', label: `Classes (${counts.CLASS})` },
            { value: 'SUBJECT', label: `Subjects (${counts.SUBJECT})` },
          ]}
          value={kind}
          onChange={setKind}
        />
      </View>

      <View style={styles.flex}>{renderBody()}</View>

      <Pressable
        onPress={() => setForm({ mode: 'create' })}
        accessibilityRole="button"
        accessibilityLabel={`New ${noun}`}
        style={({ pressed }) => [
          styles.fab,
          {
            right: spacing.lg,
            bottom: spacing.lg + insets.bottom,
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}
      >
        <Ionicons name="add" size={28} color={colors.onPrimary} />
      </Pressable>

      {form ? (
        <ClassFormModal
          mode={form.mode}
          initialName={form.mode === 'rename' ? form.item.name : ''}
          initialKind={form.mode === 'rename' ? form.item.kind : kind}
          onSubmit={submitForm}
          onClose={() => setForm(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
