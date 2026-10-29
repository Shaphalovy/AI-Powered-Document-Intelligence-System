import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import type { UploadConfig } from './upload.config';

/** Sub-folder where files wait until their content has been checked. */
export const INCOMING_DIR_NAME = 'incoming';

/**
 * Multer settings. Files go to disk (never memory) under a random name with no
 * extension. There is deliberately NO fileFilter: content is checked after the
 * file is saved (multer < 2.5.0 had a crash bug with async filters, and the
 * client-sent type cannot be trusted anyway).
 */
export function buildMulterOptions(config: UploadConfig): MulterOptions {
  const incoming = path.join(config.dir, INCOMING_DIR_NAME);
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        try {
          fs.mkdirSync(incoming, { recursive: true });
          cb(null, incoming);
        } catch (error) {
          cb(error as Error, incoming);
        }
      },
      filename: (_req, _file, cb) => cb(null, randomUUID()),
    }),
    limits: {
      fileSize: config.maxFileBytes,
      files: config.maxFilesPerRequest,
      fields: 0,
    },
  };
}
