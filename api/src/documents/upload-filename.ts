/**
 * multer decodes the "filename" header parameter as latin1 by default, so UTF-8
 * names such as "résumé.pdf" can arrive garbled. This repairs them when it is
 * safe to do so and otherwise returns the name unchanged.
 */
export function decodeFilename(name: string): string {
  // A character above U+00FF cannot come from a latin1 decode, so the name is already correct.
  if (/[^\u0000-ÿ]/.test(name)) {
    return name;
  }
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}
