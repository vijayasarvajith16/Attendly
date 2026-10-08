---
name: attendance-domain
description: Data and business rules for the Attendly attendance app (classes and subjects, master student list, class membership, sessions, absences, imports, reports, backups). Use whenever changing anything in src/db/, writing a query, touching attendance, roster import, reports or backup/restore, or adding a feature that reads or writes student or attendance data.
---

# Attendance domain rules

Attendly is fully offline. All data lives in on-device SQLite (`expo-sqlite`, async API). These rules keep attendance history safe and every query scoped to the right class.

## Data model (schema v2, `src/db/schema.ts`)

| Table | Purpose |
|---|---|
| `classes` (id, name, kind `'CLASS'`/`'SUBJECT'`, created_at) | A class or subject. Name is unique per kind, case-insensitive. |
| `students` (id, roll_no UNIQUE, name) | **Master list.** One row per real student, keyed by roll number. |
| `class_students` (class_id, student_id) PK both | Many-to-many membership. A student can be in many classes. |
| `sessions` (id, class_id, date `YYYY-MM-DD`, period) UNIQUE(class_id, date, period) | One class period on one day. Created lazily on the first absence. |
| `attendance` (session_id, student_id, status) PK both | **Absences only.** No row = present. |
| `settings` (key, value) | App settings, e.g. `periods_per_day`. |

- Schema version lives in `PRAGMA user_version`. Add a migration by appending to `MIGRATIONS` and bumping `SCHEMA_VERSION`; never edit an old migration. Table rebuilds run with `foreign_keys = OFF` inside a transaction and must pass `PRAGMA foreign_key_check` before commit (see `initDatabase`).
- `foreign_keys = ON` and `journal_mode = WAL` are set on every open.
- v1 → v2 migration moves existing data into one class named `My class` (`MIGRATED_CLASS_NAME`): students who were active are linked; removed students stay in the master list unlinked.

## Golden rules

1. **All SQL lives in `src/db/`.** Screens and hooks call typed functions; they never build SQL.
2. **Every attendance, session and report query is scoped by `class_id`.** A query that reads `sessions` or `attendance` without a class filter is a bug (exceptions: backup export and global counts in `backup.ts`).
3. **Never delete students or attendance as a side effect of roster changes.**
   - "Replace class list" and "Remove from class" only delete `class_students` rows.
   - Students are deleted only by "Clear all data". Attendance is deleted only by un-marking an absence, "Mark all present", deleting a class (cascade), or "Clear all data".
4. **History survives membership changes.** Absentee and report queries include students no longer in the class and expose `inClass: false`; UI labels them "No longer in this class". Counts like "N of total" use current members only.
5. **"Mark all present" clears absences of current class members only** (`clearAbsences`), so removed students' history is kept.
6. **All writes go through `serializeWrite`** (`src/db/writeQueue.ts`) so multi-step writes never interleave. Multi-row writes run in `withTransactionAsync`. Reads that must see pending writes use `afterPendingWrites`.
7. **Marking is idempotent**: `INSERT ... ON CONFLICT DO NOTHING` for absences; un-marking a non-existent absence is a no-op.

## Roll numbers

- Stored and displayed exactly as written (`"007"` stays `"007"`).
- Identity uses `rollKey()` (`src/utils/roll.ts`): trimmed, case-insensitive, list punctuation stripped, leading zeros ignored for all-digit rolls. `"7"`, `"07"`, `"007"`, `"7."`, `"(7)"` are the same student.
- Sort with `rollOrder()` → `ORDER BY CAST(roll_no AS INTEGER), roll_no`.

## Importing into a class (`importToClass`)

- Imports always target one class (`/import?classId=`).
- Preview classifies each row against the master list: **new** (unknown roll), **existing** (same roll, same name by `nameKey`), **conflict** (same roll, different name). Conflicts keep the stored name unless the user picks "Use new name" for that row; names are shared across classes.
- Existing students keep their stored roll text.
- Modes: **add** links every row to the class; **replace** also unlinks class members missing from the file (confirm first, listing who). Neither mode deletes students or attendance.
- Duplicate roll keys inside one file must be resolved in the preview before saving.
- Adding one student by hand (`addStudentToClass`) links an existing roll number only when the name matches (`nameKey`). If the name differs, nothing is written and the user is shown the saved name (`status: 'nameMismatch'`), so a typo never silently adds a different student. It runs in one transaction.

## Reports

- `listAbsencesInRange(db, classId, from, to, period | null)` returns absences newest date first, then period, then roll order; the UI groups by date.
- Only absences are stored, so dates where everyone was present (or attendance wasn't taken) do not appear. Say so in empty states.
- CSV exports start with a UTF-8 BOM and neutralise cells beginning with `= + - @` (`src/utils/exportCsv.ts`).

## Backups

- Format `attendly-backup`, version 2: classes, students, classStudents, sessions, attendance, settings, with original ids.
- `validateBackup` accepts version 1 (pre-classes) and converts it the same way as the schema migration. Reject newer versions with "update the app".
- Restore and clear-all are single transactions: all-or-nothing.

## Testing changes

Run the DB layer against Node's built-in SQLite with an adapter that mimics the `expo-sqlite` async API (`getAllAsync`, `runAsync`, `withTransactionAsync`, `prepareAsync`). Always test: migration from the previous schema with real-looking data, class scoping with a student shared by two classes, replace-list keeping history, and backup round-trips.
