import * as path from 'node:path';

/** Injection token for the validated upload settings. */
export const UPLOAD_CONFIG = 'UPLOAD_CONFIG';

export interface UploadConfig {
  /** Absolute folder where uploaded files are stored. */
  dir: string;
  /** Maximum size of ONE file, in bytes. */
  maxFileBytes: number;
  /** Maximum number of files in ONE upload request. */
  maxFilesPerRequest: number;
}

const DEFAULT_DIR = '/data/uploads';
const DEFAULT_MAX_UPLOAD_MB = 100;
const DEFAULT_MAX_FILES = 20;
const HARD_MAX_UPLOAD_MB = 500;
const HARD_MAX_FILES = 100;

function readPositiveInt(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  max: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${name} must be a whole number`);
  }
  const value = Number(raw);
  if (value < 1 || value > max) {
    throw new Error(`${name} must be between 1 and ${max}`);
  }
  return value;
}

/** Reads and validates upload settings. Throws on bad values so the app fails fast at startup. */
export function loadUploadConfig(
  env: NodeJS.ProcessEnv = process.env,
): UploadConfig {
  const rawDir = env.UPLOAD_DIR;
  const dir = rawDir === undefined || rawDir === '' ? DEFAULT_DIR : rawDir;
  if (!path.isAbsolute(dir)) {
    throw new Error('UPLOAD_DIR must be an absolute path');
  }
  const maxMb = readPositiveInt(
    env,
    'MAX_UPLOAD_MB',
    DEFAULT_MAX_UPLOAD_MB,
    HARD_MAX_UPLOAD_MB,
  );
  return {
    dir: path.resolve(dir),
    maxFileBytes: maxMb * 1024 * 1024,
    maxFilesPerRequest: readPositiveInt(
      env,
      'MAX_FILES_PER_UPLOAD',
      DEFAULT_MAX_FILES,
      HARD_MAX_FILES,
    ),
  };
}
