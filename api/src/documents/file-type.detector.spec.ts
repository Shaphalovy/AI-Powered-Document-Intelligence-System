import {
  detectFileType,
  isExtensionAllowed,
  sanitizeFilename,
} from './file-type.detector';

const bytes = (...values: number[]) => Buffer.from(values);
const withBody = (head: Buffer) =>
  Buffer.concat([head, Buffer.from('x'.repeat(64))]);

describe('detectFileType', () => {
  it('detects a PDF', () => {
    const buf = Buffer.from('%PDF-1.7\n1 0 obj\n');
    expect(detectFileType(buf, buf)).toBe('pdf');
  });

  it('detects a PDF with junk before the header', () => {
    const buf = Buffer.concat([
      Buffer.from('junk'.repeat(10)),
      Buffer.from('%PDF-1.4\n'),
    ]);
    expect(detectFileType(buf, buf)).toBe('pdf');
  });

  it('detects a JPEG', () => {
    const buf = withBody(bytes(0xff, 0xd8, 0xff, 0xe0));
    expect(detectFileType(buf, buf)).toBe('jpg');
  });

  it('detects a PNG', () => {
    const buf = withBody(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a));
    expect(detectFileType(buf, buf)).toBe('png');
  });

  it('detects a little-endian TIFF', () => {
    const buf = withBody(bytes(0x49, 0x49, 0x2a, 0x00));
    expect(detectFileType(buf, buf)).toBe('tiff');
  });

  it('detects a big-endian TIFF', () => {
    const buf = withBody(bytes(0x4d, 0x4d, 0x00, 0x2a));
    expect(detectFileType(buf, buf)).toBe('tiff');
  });

  it('detects an old XLS file', () => {
    const buf = withBody(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1));
    expect(detectFileType(buf, buf)).toBe('xls');
  });

  it('detects an XLSX file from the zip directory', () => {
    const head = withBody(bytes(0x50, 0x4b, 0x03, 0x04));
    const tail = Buffer.from('....xl/workbook.xml....');
    expect(detectFileType(head, tail)).toBe('xlsx');
  });

  it('rejects a zip file that is not an XLSX', () => {
    const head = withBody(bytes(0x50, 0x4b, 0x03, 0x04));
    const tail = Buffer.from('....word/document.xml....');
    expect(detectFileType(head, tail)).toBeNull();
  });

  it('detects plain text as CSV', () => {
    const buf = Buffer.from('invoice_no,total\nINV-1,100.50\n');
    expect(detectFileType(buf, buf)).toBe('csv');
  });

  it('rejects binary data with NUL bytes', () => {
    const buf = Buffer.concat([bytes(0x00, 0x01, 0x02, 0x03), Buffer.from('abc')]);
    expect(detectFileType(buf, buf)).toBeNull();
  });

  it('rejects a Windows executable', () => {
    const buf = withBody(bytes(0x4d, 0x5a, 0x90, 0x00));
    expect(detectFileType(buf, buf)).toBeNull();
  });

  it('rejects an empty file', () => {
    const buf = Buffer.alloc(0);
    expect(detectFileType(buf, buf)).toBeNull();
  });
});

describe('isExtensionAllowed', () => {
  it('accepts the matching extension in any case', () => {
    expect(isExtensionAllowed('Invoice.PDF', 'pdf')).toBe(true);
  });

  it('accepts jpeg for a JPEG file', () => {
    expect(isExtensionAllowed('photo.jpeg', 'jpg')).toBe(true);
  });

  it('rejects a mismatching extension', () => {
    expect(isExtensionAllowed('invoice.exe', 'pdf')).toBe(false);
  });

  it('rejects a file without extension', () => {
    expect(isExtensionAllowed('invoice', 'pdf')).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('removes unix path traversal', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
  });

  it('removes windows paths', () => {
    expect(sanitizeFilename('C:\\temp\\inv.pdf')).toBe('inv.pdf');
  });

  it('removes control and reserved characters', () => {
    expect(sanitizeFilename('in\u0000v<o>ice.pdf')).toBe('inv_o_ice.pdf');
  });

  it('falls back to a default name', () => {
    expect(sanitizeFilename('....')).toBe('file');
  });

  it('limits the length to 200 characters', () => {
    const result = sanitizeFilename('a'.repeat(300) + '.pdf');
    expect(result.length).toBe(200);
    expect(result.endsWith('.pdf')).toBe(true);
  });
});