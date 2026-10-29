export type DetectedFileType =
  | 'pdf'
  | 'jpg'
  | 'png'
  | 'tiff'
  | 'xlsx'
  | 'xls'
  | 'csv';

export const MIME_BY_TYPE: Record<DetectedFileType, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
  tiff: 'image/tiff',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
};

export const EXTENSION_BY_TYPE: Record<DetectedFileType, string> = {
  pdf: 'pdf',
  jpg: 'jpg',
  png: 'png',
  tiff: 'tiff',
  xlsx: 'xlsx',
  xls: 'xls',
  csv: 'csv',
};

const ALLOWED_EXTENSIONS: Record<DetectedFileType, string[]> = {
  pdf: ['pdf'],
  jpg: ['jpg', 'jpeg'],
  png: ['png'],
  tiff: ['tif', 'tiff'],
  xlsx: ['xlsx'],
  xls: ['xls'],
  csv: ['csv'],
};

function startsWith(buf: Buffer, bytes: number[]): boolean {
  return buf.length >= bytes.length && bytes.every((b, i) => buf[i] === b);
}

// Plain text has no NUL bytes and no control characters except tab, LF and CR.
function looksLikeText(buf: Buffer): boolean {
  for (const byte of buf) {
    if (byte === 0x7f) {
      return false;
    }
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) {
      return false;
    }
  }
  return true;
}

/**
 * Detects the real file type from the file content.
 * head: first bytes of the file (up to ~8 KB). tail: last bytes (up to ~64 KB).
 * Returns null when the content is not one of the supported types.
 */
export function detectFileType(
  head: Buffer,
  tail: Buffer,
): DetectedFileType | null {
  if (head.length === 0) {
    return null;
  }
  if (startsWith(head, [0xff, 0xd8, 0xff])) {
    return 'jpg';
  }
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'png';
  }
  if (
    startsWith(head, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWith(head, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    return 'tiff';
  }
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return 'xls';
  }
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) {
    const marker = 'xl/workbook.xml';
    return head.includes(marker) || tail.includes(marker) ? 'xlsx' : null;
  }
  if (head.subarray(0, 1024).includes('%PDF-')) {
    return 'pdf';
  }
  return looksLikeText(head) ? 'csv' : null;
}

export function fileExtension(filename: string): string {
  const index = filename.lastIndexOf('.');
  return index > 0 ? filename.slice(index + 1).toLowerCase() : '';
}

export function isExtensionAllowed(
  filename: string,
  type: DetectedFileType,
): boolean {
  return ALLOWED_EXTENSIONS[type].includes(fileExtension(filename));
}

/** Keeps only a safe display name. The stored file never uses this name. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  const limited = cleaned.length > 200 ? cleaned.slice(-200) : cleaned;
  return limited.length > 0 ? limited : 'file';
}