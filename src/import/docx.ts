// Word (.docx) support: converts the document to simple HTML with mammoth,
// then turns tables into cell rows and paragraphs/list items into lines.

import { isRollNo } from './parseRoster';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Text content of an HTML fragment; <br> and block ends become `breakWith`. */
function textOf(html: string, breakWith: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, breakWith)
      .replace(/<\/(p|li|h[1-6])>/gi, breakWith)
      .replace(/<[^>]+>/g, '')
  );
}

function linesOf(html: string): string[][] {
  return textOf(html, '\n')
    .split('\n')
    .map((line) => [line.trim()])
    .filter(([line]) => line.length > 0);
}

function tableRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  for (const tr of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((td) =>
      textOf(td[1], ' ').replace(/\s+/g, ' ').trim()
    );
    rows.push(cells);
  }
  return rows;
}

function listItems(listHtml: string): string[] {
  return [...listHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((li) => textOf(li[1], ' ').replace(/\s+/g, ' ').trim());
}

/**
 * Word's automatic numbering ("1. Asha" typed as a numbered list) is not part of
 * the text, so a numbered list item without its own roll number gets its
 * position as the roll number.
 */
function numberedListRows(listHtml: string): string[][] {
  return listItems(listHtml)
    .filter(Boolean)
    .map((item, i) => {
      const firstWord = item.split(/[\s.,:)\-]+/)[0] ?? '';
      return [isRollNo(firstWord) ? item : `${i + 1}. ${item}`];
    });
}

const BLOCKS = /<table\b[^>]*>[\s\S]*?<\/table>|<ol\b[^>]*>[\s\S]*?<\/ol>|<ul\b[^>]*>[\s\S]*?<\/ul>|<(p|h[1-6])\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Converts mammoth's HTML output into rows for parseRoster, in document order. */
export function docxHtmlToRows(html: string): string[][] {
  const rows: string[][] = [];
  for (const block of html.matchAll(BLOCKS)) {
    const fragment = block[0];
    const tag = fragment.slice(1, 3).toLowerCase();
    if (tag === 'ta') rows.push(...tableRows(fragment));
    else if (tag === 'ol') rows.push(...numberedListRows(fragment));
    else if (tag === 'ul') rows.push(...listItems(fragment).filter(Boolean).map((item) => [item]));
    else rows.push(...linesOf(fragment));
  }
  return rows;
}

/** Reads a .docx file's bytes into rows. mammoth is loaded only when needed. */
export async function extractDocxRows(bytes: Uint8Array): Promise<string[][]> {
  // The prebuilt browser bundle is self-contained (no Node fs/path/Buffer), so it runs on Hermes.
  const { default: mammoth } = await import('mammoth/mammoth.browser');
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return docxHtmlToRows(result.value);
}
