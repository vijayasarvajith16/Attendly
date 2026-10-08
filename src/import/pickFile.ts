// Opens the system file picker and turns the chosen file into table rows.
// CSV/TXT are read as text, XLSX/XLS via SheetJS, DOCX via mammoth.
// PDF is not supported on-device yet (see the TODO in extract()).

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import Papa from 'papaparse';

import { extractDocxRows } from './docx';
import { textToRows } from './parseRoster';
import { ImportError, type ExtractedFile, type FileKind } from './types';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<string, FileKind> = {
  csv: 'csv',
  txt: 'txt',
  tsv: 'csv',
  xlsx: 'xlsx',
  xls: 'xls',
  docx: 'docx',
  pdf: 'pdf',
};

const SUPPORTED_LIST = 'CSV, Excel (XLSX or XLS), Word (DOCX) or text file';

function detectKind(fileName: string): FileKind | null {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSIONS[ext] ?? null;
}

function isBlank(rows: string[][]): boolean {
  return rows.every((row) => row.every((cell) => String(cell ?? '').trim() === ''));
}

function parseCsv(text: string): string[][] {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' });
  // Papa reports "UndetectableDelimiter" for single-column files; the rows are still fine.
  const fatal = result.errors.find((e) => e.type !== 'Delimiter');
  if (fatal && result.data.length === 0) throw new ImportError('This CSV file could not be read. Check that it is a plain CSV export.');
  return result.data;
}

async function parseSpreadsheet(bytes: Uint8Array): Promise<string[][]> {
  const XLSX = await import('xlsx');
  let workbook;
  try {
    workbook = XLSX.read(bytes, { type: 'array' });
  } catch {
    throw new ImportError('This Excel file could not be opened. It may be damaged or password-protected.');
  }
  // Use the first sheet that has any content.
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: false, // formatted text keeps leading zeros like "007"
      defval: '',
      blankrows: false,
    });
    if (!isBlank(rows)) return rows;
  }
  return [];
}

async function extract(file: File, kind: FileKind): Promise<string[][]> {
  switch (kind) {
    case 'csv':
      return parseCsv(await file.text());
    case 'txt':
      return textToRows(await file.text());
    case 'xlsx':
    case 'xls':
      return parseSpreadsheet(await file.bytes());
    case 'docx':
      try {
        return await extractDocxRows(await file.bytes());
      } catch {
        throw new ImportError('This Word file could not be opened. It may be damaged or password-protected. Try saving it again as .docx.');
      }
    case 'pdf':
      // TODO(pdf): pdf-parse needs Node, and pdf.js needs a DOM and workers; neither runs
      // reliably on Hermes in Expo Go. Real support needs either a hand-written text
      // extractor (FlateDecode + ToUnicode CMaps + line reconstruction) or a native
      // module in a development build. Until then, offer "Paste the list" instead.
      throw new ImportError(
        "PDF files can't be read on the phone yet. Open the PDF, select and copy the student list, then use \"Paste a list\". Or import the class list as Excel, CSV or Word.",
        'pdf-unsupported'
      );
  }
}

/**
 * Lets the user pick a roster file and returns its rows, or null if they cancelled.
 * Throws ImportError with a user-facing message for unsupported, empty or unreadable files.
 */
export async function pickRosterFile(onPicked?: (fileName: string) => void): Promise<ExtractedFile | null> {
  // '*/*' because Android often reports CSV files with a generic MIME type and
  // would grey them out; the extension is checked below instead.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const kind = detectKind(asset.name);
  if (asset.name.toLowerCase().endsWith('.doc')) {
    throw new ImportError(`"${asset.name}" is an older Word file. Open it in Word, choose Save As → Word Document (.docx), and import that.`);
  }
  if (!kind) {
    throw new ImportError(`"${asset.name}" isn't a supported file. Choose a ${SUPPORTED_LIST}.`);
  }
  if (asset.size !== undefined && asset.size > MAX_FILE_BYTES) {
    throw new ImportError('This file is larger than 10 MB. Export just the student list and try again.');
  }
  if (asset.size === 0) throw new ImportError(`"${asset.name}" is empty.`);

  onPicked?.(asset.name);

  let rows: string[][];
  try {
    rows = await extract(new File(asset.uri), kind);
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError(`"${asset.name}" could not be read. Try saving it again as CSV.`);
  }

  if (isBlank(rows)) throw new ImportError(`"${asset.name}" is empty.`);
  return { fileName: asset.name, kind, rows };
}
