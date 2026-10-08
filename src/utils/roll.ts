// Roll number identity. Roll numbers are stored and shown exactly as written,
// but "7", "07", "007", "7." and "(7)" (and "cs01" / "CS01") count as the same student.

/**
 * Comparison key: list punctuation and whitespace stripped, upper-cased, and
 * leading zeros dropped from all-digit rolls.
 */
export function rollKey(rollNo: string): string {
  const value = rollNo
    .trim()
    .replace(/^[(#[]+/, '')
    .replace(/[.):\]]+$/, '')
    .trim()
    .toUpperCase();
  return /^\d+$/.test(value) ? value.replace(/^0+(?=\d)/, '') : value;
}
