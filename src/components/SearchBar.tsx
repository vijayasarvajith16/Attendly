// Search field with a clear button, used to filter students by roll or name.

import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../theme/ThemeProvider';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = 'Search roll no or name' }: SearchBarProps) {
  const { scheme, colors, spacing, radius, typography, touchTarget } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { minHeight: touchTarget, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, paddingLeft: spacing.md },
      ]}
    >
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        keyboardAppearance={scheme}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
        accessibilityLabel="Search students"
        style={[typography.body, styles.input, { color: colors.textPrimary, paddingHorizontal: spacing.sm }]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={({ pressed }) => [styles.clear, { width: touchTarget, opacity: pressed ? 0.5 : 1 }]}
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, paddingVertical: 10 },
  clear: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
