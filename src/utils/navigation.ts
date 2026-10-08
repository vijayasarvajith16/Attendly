// Navigation helper: ignores a repeated push within a short window, so a
// double tap never opens the same screen twice.

import { router, type Href } from 'expo-router';

const REPEAT_WINDOW_MS = 700;
let lastPushAt = 0;

export function pushOnce(href: Href): void {
  const now = Date.now();
  if (now - lastPushAt < REPEAT_WINDOW_MS) return;
  lastPushAt = now;
  router.push(href);
}
