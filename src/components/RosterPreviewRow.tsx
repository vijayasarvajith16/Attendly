// One editable row in the import preview: roll number, name, delete, and a
// "Keep this one" action when the roll number is duplicated.

import { memo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { RosterRow } from '../import/types';
import { useTheme } from '../theme/ThemeProvider';

interface RosterPreviewRowProps {
  row: RosterRow;
  problem?: string;
  isDuplicate: boolean;
  onChangeName: (key: string, name: string) => void;
  onChangeRoll: (key: string, rollNo: string) => void;
  onDelete: (key: string) => void;
  onKeep: (key: string) => void;
}

function RosterPreviewRowBase({ row, problem, isDuplicate, onChangeName, onChangeRoll, onDelete, onKeep }: RosterPreviewRowProps) {
  const { scheme, colors, spacing, radius, typography, touchTarget } = useTheme();
  const hasProblem = Boolean(problem);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: hasProblem ? colors.dangerSoft : colors.surface,
          borderColor: hasProblem ? colors.danger : colors.border,
          borderRadius: radius.md,
          paddingLeft: spacing.md,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <View style={[styles.line, { minHeight: touchTarget, gap: spacing.sm }]}>
        <TextInput
          keyboardAppearance={scheme}
          value={row.rollNo}
          onChangeText={(text) => onChangeRoll(row.key, text)}
          style={[typography.bodyStrong, styles.roll, { color: colors.textPrimary }]}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel={`Roll number for ${row.name}`}
          maxLength={20}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TextInput
          keyboardAppearance={scheme}
          value={row.name}
          onChangeText={(text) => onChangeName(row.key, text)}
          style={[typography.body, styles.name, { color: colors.textPrimary }]}
          autoCapitalize="words"
          autoCorrect={false}
          accessibilityLabel={`Name for roll ${row.rollNo}`}
          maxLength={100}
        />
        <Pressable
          onPress={() => onDelete(row.key)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${row.rollNo} ${row.name} from import`}
          style={({ pressed }) => [styles.iconButton, { width: touchTarget, height: touchTarget, opacity: pressed ? 0.4 : 1 }]}
        >
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {hasProblem ? (
        <View style={[styles.problemLine, { paddingBottom: spacing.sm, paddingRight: spacing.md, gap: spacing.sm }]}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={[typography.caption, styles.flex, { color: colors.danger }]}>{problem}</Text>
          {isDuplicate ? (
            <Pressable
              onPress={() => onKeep(row.key)}
              accessibilityRole="button"
              accessibilityLabel={`Keep ${row.name} for roll ${row.rollNo}`}
              hitSlop={10}
              style={({ pressed }) => [
                styles.keepButton,
                { backgroundColor: colors.surface, borderColor: colors.danger, borderRadius: radius.sm, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[typography.caption, { color: colors.danger }]}>Keep this one</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export const RosterPreviewRow = memo(RosterPreviewRowBase);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { borderWidth: StyleSheet.hairlineWidth },
  line: { flexDirection: 'row', alignItems: 'center' },
  roll: { width: 84, paddingVertical: 10 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 10 },
  name: { flex: 1, paddingVertical: 10 },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  problemLine: { flexDirection: 'row', alignItems: 'center' },
  keepButton: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
});
