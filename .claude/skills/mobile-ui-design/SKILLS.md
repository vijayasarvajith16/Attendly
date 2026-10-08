---
name: mobile-ui-design
description: Design rules for the attendance app's React Native (Expo) UI. Use whenever building or changing any screen, component, list, button, swipe interaction, animation, theme, or dark mode styling in this project.
---

# Mobile UI design rules

These rules keep the app fast, readable, and easy to use one-handed during a live class. Follow them in every screen and component unless the user asks otherwise.

## Priorities (in order)

1. Speed of use during class: few taps, instant feedback, no confirmation for routine actions.
2. Readability at a glance: roll number and status must be visible without squinting.
3. Smooth motion: nothing should stutter, even with 100+ students.
4. Consistency: use the design tokens, never ad-hoc colors or sizes.

## Design tokens (always import, never hardcode)

All colors, spacing, radius, and type sizes come from `src/theme/tokens.ts`.

- Spacing scale only: `4, 8, 12, 16, 24, 32`. No other values.
- Radius only: `8, 12, 16`.
- Colors are named by role, not by hex: `primary`, `success`, `danger`, `surface`, `background`, `textPrimary`, `textSecondary`, `border`. Each role has a light and a dark value.
- Type scale: `title` (22 bold), `subtitle` (17 semibold), `body` (15 regular), `caption` (13 regular). Use only these.

If a value you need is not in the tokens, add it to `tokens.ts` first, then use it.

## Layout and touch

- Minimum touch target: 48px height. Icon-only buttons need 48x48 hit area even if the icon is smaller (use `hitSlop`).
- Wrap every screen in `SafeAreaView` or use `useSafeAreaInsets` so content clears the notch and the home indicator.
- Keep primary actions in the lower third of the screen so they are reachable with one thumb.
- Lists use `FlashList`, never `ScrollView` with `map()`, once the list can exceed about 20 items.
- Give every list row a stable `keyExtractor` based on `id`, never on array index.

## Student row

Each row shows, left to right: roll number (bold, fixed width, so names align), name (flexible, truncates with ellipsis after one line), status indicator (right side).

- Present: surface background, a neutral "P" or check icon in `success`.
- Absent: `danger` tint background (about 10% opacity of `danger`), a filled `danger` "A" badge.
- Row height is fixed (about 56px) so the list scrolls smoothly.
- Do not show extra text on the row (no timestamps, no icons beyond the status). Clutter slows the teacher down.

## Swipe to mark absent

- Swipe left reveals a `danger` action panel labeled "Absent". Release past about 40% of the row width to commit; release earlier to snap back.
- On commit: fire a light haptic impact, animate the row to its absent style, and save immediately. No confirmation dialog.
- Tap toggles present and absent. Tap is the undo path, so do not add an undo toast for every change.
- Swipe must never trigger while the list is scrolling vertically. Use a horizontal-only gesture with a clear activation threshold (about 10px horizontal before the gesture activates).

## Motion

- Duration: 150 to 250ms for state changes. Never longer than 250ms in this app.
- Use `FadeIn`, `FadeOut`, or `LinearTransition` from Reanimated for row state changes and list reordering.
- Press feedback: `Pressable` with a slight opacity change (0.6) or a scale of 0.97. Use one style across the whole app.
- Do not animate anything that repeats or loops during class. It draws attention and drains battery.
- Respect the system's reduced-motion setting: check `AccessibilityInfo.isReduceMotionEnabled` and skip non-essential animations when it is on.

## Color and dark mode

- Read the scheme with `useColorScheme()` and resolve tokens through one hook (for example `useTheme()`). Do not check the scheme inside individual components.
- Contrast: text must reach WCAG AA (4.5:1 for body text). Test the absent tint against both light and dark surfaces.
- Never use color as the only signal. Absent rows have both the tint and the "A" badge, so they stay clear in grayscale or for color-blind users.

## Feedback and states

Every screen must handle these four states, with a designed message for each:

- **Loading:** a skeleton of rows or a small centered spinner. Never a blank screen.
- **Empty:** an icon, one short sentence, and one button that fixes it (for example "No students yet. Import a list" with an Import button).
- **Error:** a plain-language message and a retry action. Never show raw error text or stack traces.
- **Success:** a brief confirmation for significant actions such as saving a roster or exporting. Use a non-blocking toast, not an alert.

Destructive actions (clear all data, mark all present, delete a roster entry, remove an absentee) use a confirmation dialog with a clear action label, such as "Clear data" instead of "OK". Routine actions (marking a student absent or present) never use a dialog.

## Typography and copy

- Use sentence case everywhere ("Mark attendance", not "Mark Attendance").
- Keep labels to one or two words where possible. Buttons use verbs ("Save roster", "Export CSV").
- Dates are shown as `Mon, 8 Oct` for quick reading, stored as `YYYY-MM-DD` internally.
- Numbers use tabular figures in counts so they do not jump when they change.

## Screen patterns

- **Main attendance screen:** header with date and period, a period chip row, a stat card (total, present, absent), a search field, then the student list. Primary action area is at the bottom.
- **Absentee screen:** header with "Absentees: X of Y", the date and period, then the list, then a bottom "Export CSV" button.
- **Import screen:** pick file button at top, a preview list in the middle, and a sticky "Save roster" button at the bottom that shows the row count.
- **Settings screen:** grouped sections using standard list rows with clear labels and destructive actions in `danger` color.

## Checklist before finishing any UI task

- [ ] Uses only tokens for color, spacing, radius, and type
- [ ] Every touch target is at least 48px
- [ ] Works in both light and dark mode
- [ ] Loading, empty, error, and success states are handled
- [ ] Animations are 250ms or less and respect reduced motion
- [ ] Swipe does not conflict with vertical scrolling
- [ ] Lists use FlashList with stable keys
- [ ] Tested on a real phone in Expo Go, not only in the simulator
