// Small text formatting helpers.

/** plural(1, 'student') → "1 student", plural(3, 'line') → "3 lines" */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Lower-case, accent-free text for forgiving search ("Seán" matches "sean"). */
export function searchKey(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}
