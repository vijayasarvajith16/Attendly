// Inline form for adding a student by hand in the import preview.

import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

interface AddStudentFormProps {
  /** Returns an error message to show, or null when the student was added. */
  onAdd: (rollNo: string, name: string) => string | null;
}

export function AddStudentForm({ onAdd }: AddStudentFormProps) {
  const { scheme, colors, spacing, radius, typography, touchTarget } = useTheme();
  const [rollNo, setRollNo] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<TextInput>(null);

  const submit = () => {
    const message = onAdd(rollNo, name);
    setError(message);
    if (!message) {
      setRollNo('');
      setName('');
    }
  };

  const inputStyle = [
    typography.body,
    styles.input,
    {
      minHeight: touchTarget,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
    },
  ];

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <TextInput
          keyboardAppearance={scheme}
          value={rollNo}
          onChangeText={setRollNo}
          placeholder="Roll no"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => nameRef.current?.focus()}
          style={[inputStyle, styles.roll]}
          maxLength={20}
        />
        <TextInput
          keyboardAppearance={scheme}
          ref={nameRef}
          value={name}
          onChangeText={setName}
          placeholder="Student name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
          style={[inputStyle, styles.flex]}
          maxLength={100}
        />
      </View>
      {error ? <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text> : null}
      <Button label="Add student" icon="person-add-outline" variant="secondary" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  input: { borderWidth: StyleSheet.hairlineWidth },
  roll: { width: 96 },
});
