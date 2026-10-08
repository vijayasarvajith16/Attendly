// One editable row in the import preview: roll number, name, delete, a
// "Keep this one" action for duplicated roll numbers, and a badge showing how
// the row matches the master list (new, existing, or a name conflict with a
// choice of which name to keep).

import { memo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { RowMatch } from '../hooks/useRosterImport';
import type { RosterRow } from '../import/types';
import { useTheme } from '../theme/ThemeProvider';

interface RosterPreviewRowProps {
  row: RosterRow;
  problem?: string;
  isDuplicate: boolean;
  match?: RowMatch;
  onToggleUseNewName: (key: string) => void;
  onChangeName: (key: string, name: string) => void;
  onChangeRoll: (key: string, rollNo: string) => void;
  onDelete: (key: string) => void;
  onKeep: (key: string) => void;
}

function RosterPreviewRowBase({ row, problem, isDuplicate, match, onToggleUseNewName, onChangeName, onChangeRoll, onDelete, onKeep }: RosterPreviewRowProps) {
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
      ) : match ? (
        <MatchLine match={match} onToggle={() => onToggleUseNewName(row.key)} />
      ) : null}
    </View>
  );
}

function Badge({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  const { radius, typography } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderRadius: radius.sm }]}>
      <Text style={[typography.caption, { color: fg }]}>{label}</Text>
    </View>
  );
}

function MatchLine({ match, onToggle }: { match: RowMatch; onToggle: () => void }) {
  const { colors, spacing, radius, typography } = useTheme();
  const line = [styles.problemLine, { paddingBottom: spacing.sm, paddingRight: spacing.md, gap: spacing.sm }];

  if (match.kind === 'new') {
    return (
      <View style={line}>
        <Badge label="New" fg={colors.primary} bg={colors.primarySoft} />
      </View>
    );
  }
  if (match.kind === 'existing') {
    return (
      <View style={line}>
        <Badge label={match.inClass ? 'In class' : 'Existing'} fg={colors.success} bg={colors.successSoft} />
      </View>
    );
  }
  return (
    <View style={line}>
      <Ionicons name="swap-horizontal" size={16} color={colors.warning} />
      <Text style={[typography.caption, styles.flex, { color: colors.textSecondary }]} numberOfLines={2}>
        {match.useNewName ? `Will rename “${match.existingName}”` : `Saved as “${match.existingName}”`}
      </Text>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={match.useNewName ? `Keep the saved name ${match.existingName}` : 'Use the name from this file'}
        hitSlop={10}
        style={({ pressed }) => [
          styles.keepButton,
          { backgroundColor: colors.surface, borderColor: colors.warning, borderRadius: radius.sm, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[typography.caption, { color: colors.textPrimary }]}>{match.useNewName ? 'Keep saved name' : 'Use new name'}</Text>
      </Pressable>
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
  badge: { paddingHorizontal: 8, paddingVertical: 2 },
});
