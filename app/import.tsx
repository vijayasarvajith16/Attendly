// Roster import screen: pick a CSV/Excel/Word file (or paste a list), review
// and edit the parsed students (fix duplicates, edit names, add/delete rows),
// then save.

import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useHeaderHeight, usePreventRemove } from 'expo-router/react-navigation';
import { FlashList } from '@shopify/flash-list';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AddStudentForm } from '../src/components/AddStudentForm';
import { BottomBar } from '../src/components/BottomBar';
import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';
import { RosterPreviewRow } from '../src/components/RosterPreviewRow';
import type { Student } from '../src/db/students';
import { useRosterImport } from '../src/hooks/useRosterImport';
import { ImportError, type RosterRow } from '../src/import/types';
import { useTheme } from '../src/theme/ThemeProvider';
import { plural } from '../src/utils/format';

type RosterImport = ReturnType<typeof useRosterImport>;

const PASTE_PLACEHOLDER = ['1, Asha Kumar', '2. Ravi Shankar', '3 Priya Nair'].join('\n');

function goHome() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Asks before discarding unsaved import work; calls `discard` if the user agrees. */
function confirmDiscard(discard: () => void): void {
  Alert.alert('Discard this list?', 'The students you checked and edited here have not been saved.', [
    { text: 'Keep editing', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: discard },
  ]);
}

/** Blocks back/swipe-back while there is unsaved work, with a confirm dialog. */
function useGuardUnsaved(hasUnsaved: boolean): void {
  const navigation = useNavigation();
  usePreventRemove(hasUnsaved, ({ data }) => confirmDiscard(() => navigation.dispatch(data.action)));
}

function describeRemovals(missing: Student[]): string {
  const shown = missing.slice(0, 5).map((s) => `• ${s.rollNo}  ${s.name}`);
  const more = missing.length > 5 ? `\n…and ${missing.length - 5} more` : '';
  return `${shown.join('\n')}${more}\n\nRemoved students are hidden from the roster. Their past attendance is kept.`;
}

export default function ImportScreen() {
  const imp = useRosterImport();
  const { phase } = imp;

  switch (phase.name) {
    case 'idle':
      return <IdleView imp={imp} />;
    case 'working':
      return <WorkingView message={phase.message} progress={phase.progress} />;
    case 'error':
      return phase.code === 'pdf-unsupported' ? (
        <EmptyState
          icon="document-outline"
          title="PDF can't be read yet"
          message={phase.message}
          actionLabel="Paste a list"
          onAction={imp.startPaste}
          secondaryActionLabel="Choose another file"
          onSecondaryAction={() => void imp.pickFile()}
        />
      ) : (
        <EmptyState
          icon="document-text-outline"
          tone="error"
          title="Couldn't import that"
          message={phase.message}
          actionLabel="Choose another file"
          onAction={() => void imp.pickFile()}
          secondaryActionLabel="Paste a list instead"
          onSecondaryAction={imp.startPaste}
        />
      );
    case 'paste':
      return <PasteView imp={imp} />;
    case 'saved':
      return (
        <EmptyState
          icon="checkmark-circle"
          tone="positive"
          title="Roster saved"
          message={`${plural(phase.count, 'student')} saved.${
            phase.removed > 0 ? ` ${plural(phase.removed, 'student')} removed from the roster (history kept).` : ''
          }`}
          actionLabel="Start taking attendance"
          onAction={goHome}
        />
      );
    case 'preview':
      return <PreviewView imp={imp} />;
  }
}

function IdleView({ imp }: { imp: RosterImport }) {
  const { colors, spacing, radius, typography } = useTheme();
  const formats = ['CSV', 'XLSX', 'XLS', 'DOCX', 'TXT'];

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.title, { color: colors.textPrimary }]}>Import your class list</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            Choose a file with one student per line: the roll number, then the name. You can check and fix everything before
            saving.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }]}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>EXAMPLES THAT WORK</Text>
          <View style={[{ backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: spacing.md }]}>
            {['Roll No, Name', '1, Asha Kumar', '2. Ravi Shankar', '007: Priya Nair', '21CS045 - Arjun'].map((line) => (
              <Text key={line} style={[typography.body, styles.mono, { color: colors.textPrimary }]}>
                {line}
              </Text>
            ))}
          </View>
          <View style={[styles.chips, { gap: spacing.sm }]}>
            {formats.map((f) => (
              <View key={f} style={[styles.chip, { backgroundColor: colors.primarySoft, borderRadius: radius.pill }]}>
                <Text style={[typography.caption, { color: colors.primary }]}>{f}</Text>
              </View>
            ))}
            <View style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>PDF · copy & paste</Text>
            </View>
          </View>
        </View>

        {imp.existingCount ? (
          <View style={[styles.note, { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }]}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={[typography.caption, styles.flex, { color: colors.textPrimary }]}>
              You already have {plural(imp.existingCount, 'student')}. Importing again updates names and adds new students.
              Attendance history is always kept.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <BottomBar>
        <Button label="Import student list" icon="cloud-upload-outline" fullWidth onPress={() => void imp.pickFile()} />
        <Button label="Paste a list" icon="clipboard-outline" variant="ghost" fullWidth onPress={imp.startPaste} />
      </BottomBar>
    </View>
  );
}

function PasteView({ imp }: { imp: RosterImport }) {
  const { scheme, colors, spacing, radius, typography } = useTheme();
  const headerHeight = useHeaderHeight();
  const text = imp.pasteText;
  useGuardUnsaved(text.trim().length > 0);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <View style={[styles.flex, { padding: spacing.lg, gap: spacing.md }]}>
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          Paste the class list below, one student per line. Copying from a PDF, email or website works.
        </Text>
        <TextInput
          keyboardAppearance={scheme}
          value={text}
          onChangeText={imp.setPasteText}
          multiline
          autoFocus
          textAlignVertical="top"
          autoCorrect={false}
          autoCapitalize="none"
          placeholder={PASTE_PLACEHOLDER}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Pasted student list"
          style={[
            typography.body,
            styles.mono,
            styles.flex,
            {
              color: colors.textPrimary,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: radius.md,
              padding: spacing.md,
            },
          ]}
        />
      </View>
      <BottomBar>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Button label="Cancel" variant="secondary" onPress={() => (text.trim() ? confirmDiscard(imp.reset) : imp.reset())} />
          <Button
            label="Find students"
            icon="search"
            onPress={() => void imp.parsePastedText()}
            disabled={!text.trim()}
            style={styles.flex}
          />
        </View>
      </BottomBar>
    </KeyboardAvoidingView>
  );
}

function WorkingView({ message, progress }: { message: string; progress: number | null }) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View style={[styles.center, { padding: spacing.xl, gap: spacing.lg }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[typography.body, styles.textCenter, { color: colors.textSecondary }]}>{message}</Text>
      {progress !== null ? (
        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.primary, borderRadius: radius.pill }]} />
        </View>
      ) : null}
    </View>
  );
}

function PreviewView({ imp }: { imp: RosterImport }) {
  const { colors, spacing, typography } = useTheme();
  const headerHeight = useHeaderHeight();
  const [saving, setSaving] = useState(false);
  useGuardUnsaved(imp.rows.length > 0 && !saving);

  const runSave = useCallback(
    async (removeMissing: boolean) => {
      setSaving(true);
      try {
        await imp.save(removeMissing);
      } catch (e) {
        Alert.alert("Couldn't save", e instanceof ImportError ? e.message : 'Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [imp]
  );

  const onSave = useCallback(async () => {
    let missing: Student[] = [];
    try {
      missing = await imp.findRemovals();
    } catch {
      // If the comparison fails, save without removing anyone (the safe choice).
    }
    if (missing.length === 0) {
      await runSave(false);
      return;
    }
    Alert.alert(
      `${plural(missing.length, 'student')} not in this file`,
      describeRemovals(missing),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Keep them', onPress: () => void runSave(false) },
        { text: 'Remove', style: 'destructive', onPress: () => void runSave(true) },
      ]
    );
  }, [imp, runSave]);

  const renderItem = useCallback(
    ({ item }: { item: RosterRow }) => (
      <RosterPreviewRow
        row={item}
        problem={imp.problemByKey.get(item.key)}
        isDuplicate={imp.duplicateKeys.has(item.key)}
        onChangeName={imp.updateName}
        onChangeRoll={imp.updateRoll}
        onDelete={imp.deleteRow}
        onKeep={imp.keepDuplicate}
      />
    ),
    [imp.problemByKey, imp.duplicateKeys, imp.updateName, imp.updateRoll, imp.deleteRow, imp.keepDuplicate]
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <FlashList
        data={imp.rows}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        extraData={imp.problemByKey}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={<PreviewHeader imp={imp} />}
        ListFooterComponent={<SkippedLines imp={imp} />}
        ListEmptyComponent={
          <Text style={[typography.body, styles.textCenter, { color: colors.textSecondary, padding: spacing.xl }]}>
            All rows removed. Add a student above or choose another file.
          </Text>
        }
      />
      <BottomBar>
        {!imp.canSave && imp.rows.length > 0 ? (
          <Text style={[typography.caption, styles.textCenter, { color: colors.danger }]}>
            Fix {plural(new Set(imp.problems.map((p) => p.key)).size, 'row')} marked in red to save.
          </Text>
        ) : null}
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Button label="Change file" icon="swap-horizontal" variant="secondary" onPress={() => confirmDiscard(imp.reset)} disabled={saving} />
          <Button
            label={`Save roster (${imp.rows.length})`}
            icon="checkmark"
            onPress={() => void onSave()}
            disabled={!imp.canSave}
            loading={saving}
            style={styles.flex}
          />
        </View>
      </BottomBar>
    </KeyboardAvoidingView>
  );
}

function PreviewHeader({ imp }: { imp: RosterImport }) {
  const { colors, spacing, radius, typography } = useTheme();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ padding: spacing.lg, gap: spacing.md }}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs }]}>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
          <Text style={[typography.caption, styles.flex, { color: colors.textSecondary }]} numberOfLines={1}>
            {imp.fileName}
          </Text>
        </View>
        <Text style={[typography.title, { color: colors.textPrimary }]}>
          {imp.rows.length === 1 ? '1 student found' : `${imp.rows.length} students found`}
          {imp.skipped.length > 0 ? (
            <Text style={[typography.subtitle, { color: colors.textSecondary }]}>{`, ${plural(imp.skipped.length, 'line')} skipped`}</Text>
          ) : null}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>Tap a roll number or name to edit it.</Text>
      </View>

      {imp.duplicateGroupCount > 0 ? (
        <View style={[styles.note, { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }]}>
          <Ionicons name="copy-outline" size={20} color={colors.danger} />
          <Text style={[typography.caption, styles.flex, { color: colors.textPrimary }]}>
            {imp.duplicateGroupCount === 1
              ? '1 roll number appears more than once.'
              : `${imp.duplicateGroupCount} roll numbers appear more than once.`}{' '}
            Tap “Keep this one” on the correct row, or edit a roll number.
          </Text>
        </View>
      ) : null}

      {showAdd ? (
        <AddStudentForm onAdd={imp.addRow} />
      ) : (
        <Pressable
          onPress={() => setShowAdd(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, styles.addLink, { gap: spacing.sm, opacity: pressed ? 0.5 : 1 }]}
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <Text style={[typography.bodyStrong, { color: colors.primary }]}>Add a student</Text>
        </Pressable>
      )}

      <Text style={[typography.caption, { color: colors.textSecondary }]}>STUDENTS</Text>
    </Animated.View>
  );
}

function SkippedLines({ imp }: { imp: RosterImport }) {
  const { colors, spacing, radius, typography } = useTheme();
  if (imp.skipped.length === 0) return <View style={{ height: spacing.lg }} />;

  return (
    <View style={{ padding: spacing.lg, gap: spacing.sm }}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>SKIPPED LINES ({imp.skipped.length})</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}>
        {imp.skipped.slice(0, 200).map((s, i) => (
          <View
            key={`${s.line}-${i}`}
            style={[
              { padding: spacing.md, gap: 2 },
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
            ]}
          >
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Line {s.line} · {s.reason}
            </Text>
            <Text style={[typography.body, styles.mono, { color: colors.textSecondary }]} numberOfLines={2}>
              {s.text}
            </Text>
          </View>
        ))}
        {imp.skipped.length > 200 ? (
          <Text style={[typography.caption, { color: colors.textMuted, padding: spacing.md }]}>
            …and {imp.skipped.length - 200} more
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textCenter: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth },
  note: { flexDirection: 'row', alignItems: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 6 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  addLink: { minHeight: 48 },
  progressTrack: { width: '80%', height: 8, overflow: 'hidden' },
  progressFill: { height: 8 },
});
