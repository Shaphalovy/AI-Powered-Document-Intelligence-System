import { decodeFilename } from './upload-filename';

describe('decodeFilename', () => {
  it('keeps plain ASCII names', () => {
    expect(decodeFilename('invoice-001.pdf')).toBe('invoice-001.pdf');
  });

  it('repairs UTF-8 names that were decoded as latin1', () => {
    const garbled = Buffer.from('résumé-€.pdf', 'utf8').toString('latin1');
    expect(decodeFilename(garbled)).toBe('résumé-€.pdf');
  });

  it('keeps names that are already correct unicode', () => {
    expect(decodeFilename('счёт-фактура.pdf')).toBe('счёт-фактура.pdf');
  });

  it('keeps a latin1 name that is not valid UTF-8', () => {
    expect(decodeFilename('café.pdf')).toBe('café.pdf');
  });
});
