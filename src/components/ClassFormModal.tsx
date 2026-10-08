// Bottom sheet for creating a class/subject or renaming one. Mount it only
// while open, so it always starts from the given initial values.

import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { ClassNameError, MAX_CLASS_NAME_LENGTH, type ClassKind } from '../db/classes';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import { SegmentedControl } from './SegmentedControl';

interface ClassFormModalProps {
  mode: 'create' | 'rename';
  initialName?: string;
  initialKind: ClassKind;
  onSubmit: (name: string, kind: ClassKind) => Promise<void>;
  onClose: () => void;
}

const KIND_SEGMENTS = [
  { value: 'CLASS', label: 'Class' },
  { value: 'SUBJECT', label: 'Subject' },
] as const;

export function ClassFormModal({ mode, initialName = '', initialKind, onSubmit, onClose }: ClassFormModalProps) {
  const { scheme, colors, spacing, radius, typography, touchTarget, motion } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [kind, setKind] = useState<ClassKind>(initialKind);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSubmit(name, kind);
      onClose();
    } catch (e) {
      setError(e instanceof ClassNameError ? e.message : 'That could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const noun = kind === 'CLASS' ? 'class' : 'subject';
  const title = mode === 'create' ? `New ${noun}` : `Rename ${noun}`;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(motion.fast)} style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}>
        <Pressable style={styles.flex} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.bottom} pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.duration(motion.base)}
          style={[
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.lg,
              paddingBottom: spacing.lg + insets.bottom,
              gap: spacing.md,
            },
          ]}
        >
          <Text style={[typography.subtitle, { color: colors.textPrimary }]}>{title}</Text>
          {mode === 'create' ? <SegmentedControl segments={KIND_SEGMENTS} value={kind} onChange={setKind} /> : null}
          <TextInput
            keyboardAppearance={scheme}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            placeholder={kind === 'CLASS' ? 'e.g. Class 10-A' : 'e.g. Mathematics'}
            placeholderTextColor={colors.textMuted}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            maxLength={MAX_CLASS_NAME_LENGTH}
            accessibilityLabel={`${noun} name`}
            style={[
              typography.body,
              styles.input,
              {
                minHeight: touchTarget,
                color: colors.textPrimary,
                backgroundColor: colors.background,
                borderColor: error ? colors.danger : colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
              },
            ]}
          />
          {error ? <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text> : null}
          <View style={[styles.row, { gap: spacing.sm }]}>
            <Button label="Cancel" variant="secondary" onPress={onClose} />
            <Button
              label={mode === 'create' ? `Create ${noun}` : 'Save'}
              onPress={() => void submit()}
              loading={saving}
              disabled={!name.trim()}
              style={styles.flex}
            />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { borderWidth: StyleSheet.hairlineWidth },
});
