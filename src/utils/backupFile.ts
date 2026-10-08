// Moves backups in and out of the app: share a backup file, or pick one and
// parse + validate it (nothing is written to the database here).

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { BackupError, validateBackup, type Backup } from '../db/backup';
import { toISODate } from './dates';
import { shareTextFile } from './shareFile';

const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export function backupFileName(date = new Date()): string {
  return `attendly-backup-${toISODate(date)}.json`;
}

export async function shareBackup(backup: Backup): Promise<void> {
  await shareTextFile({
    fileName: backupFileName(),
    content: JSON.stringify(backup),
    mimeType: 'application/json',
    uti: 'public.json',
    dialogTitle: 'Save your attendance backup',
  });
}

/** Lets the user pick a backup file. Returns null if they cancelled; throws BackupError if it isn't valid. */
export async function pickBackupFile(): Promise<Backup | null> {
  // '*/*' because Android often labels .json files as generic binary.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  if (asset.size !== undefined && asset.size > MAX_BACKUP_BYTES) {
    throw new BackupError('This file is too large to be an Attendly backup.');
  }

  let data: unknown;
  try {
    data = JSON.parse(await new File(asset.uri).text());
  } catch {
    throw new BackupError(`"${asset.name}" isn't an Attendly backup. Choose a file that was created with "Export backup".`);
  }
  return validateBackup(data);
}
