// Shared types for roster import: what a file is turned into, what the parser
// produces, and the errors shown to the user.

/** Supported file kinds, detected from the file extension. */
export type FileKind = 'csv' | 'txt' | 'xlsx' | 'xls' | 'docx' | 'pdf';

/**
 * A picked file reduced to table rows. Spreadsheets and CSV give one cell per
 * column; plain text gives one single-cell row per line.
 */
export interface ExtractedFile {
  fileName: string;
  kind: FileKind;
  rows: string[][];
}

export interface RosterRow {
  /** Stable id for list rendering and edits (not the roll number, which can repeat). */
  key: string;
  rollNo: string;
  name: string;
  /** 1-based line/row number in the source file; undefined for rows added by hand. */
  sourceLine?: number;
}

export interface SkippedLine {
  line: number;
  text: string;
  reason: string;
}

export interface ParseResult {
  rows: RosterRow[];
  skipped: SkippedLine[];
}

/** Lets the screen offer a tailored next step (e.g. "Paste the list instead" for PDFs). */
export type ImportErrorCode = 'pdf-unsupported';

/** An error whose message is safe and friendly to show the user as-is. */
export class ImportError extends Error {
  readonly code?: ImportErrorCode;

  constructor(message: string, code?: ImportErrorCode) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
  }
}
