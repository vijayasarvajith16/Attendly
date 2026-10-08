// Fire-and-forget haptic feedback. Failures (e.g. unsupported device) are ignored.

import * as Haptics from 'expo-haptics';

export function tapHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function successHaptic(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function warningHaptic(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}

/** Subtle tick, e.g. when a swipe crosses its action threshold. */
export function selectionHaptic(): void {
  Haptics.selectionAsync().catch(() => undefined);
}
