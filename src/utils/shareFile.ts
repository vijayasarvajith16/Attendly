// Writes text to a file in the app cache and opens the system share sheet.

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export class ShareUnavailableError extends Error {
  constructor() {
    super('Sharing is not available on this device.');
    this.name = 'ShareUnavailableError';
  }
}

interface ShareTextFileOptions {
  fileName: string;
  content: string;
  mimeType: string;
  /** iOS Uniform Type Identifier, e.g. 'public.comma-separated-values-text'. */
  uti?: string;
  dialogTitle?: string;
}

export async function shareTextFile({ fileName, content, mimeType, uti, dialogTitle }: ShareTextFileOptions): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new ShareUnavailableError();

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(content);

  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle });
}
