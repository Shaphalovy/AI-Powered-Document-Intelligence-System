import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentEntity } from './document.entity';
import {
  detectFileType,
  EXTENSION_BY_TYPE,
  isExtensionAllowed,
  MIME_BY_TYPE,
  sanitizeFilename,
  type DetectedFileType,
} from './file-type.detector';
import { INCOMING_DIR_NAME } from './multer.options';
import { decodeFilename } from './upload-filename';
import { UPLOAD_CONFIG, type UploadConfig } from './upload.config';

const HEAD_BYTES = 8 * 1024;
const TAIL_BYTES = 64 * 1024;

/** The parts of a multer file this service needs. */
export interface UploadedTempFile {
  originalname: string;
  path: string;
  size: number;
}

export type UploadResult =
  | {
      status: 'accepted';
      originalFilename: string;
      id: string;
      fileType: DetectedFileType;
      size: number;
      documentStatus: 'uploaded';
    }
  | { status: 'rejected'; originalFilename: string; reason: string };

class Rejection extends Error {}

@Injectable()
export class DocumentsService implements OnModuleInit {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documents: Repository<DocumentEntity>,
    @Inject(UPLOAD_CONFIG) private readonly config: UploadConfig,
  ) {}

  /** Fail fast at startup if the upload folder cannot be created. */
  async onModuleInit(): Promise<void> {
    await fsp.mkdir(path.join(this.config.dir, INCOMING_DIR_NAME), {
      recursive: true,
    });
  }

  /** Files are handled one by one to keep disk and memory use predictable. */
  async registerUploads(
    ownerId: string,
    files: UploadedTempFile[],
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    for (const file of files) {
      results.push(await this.registerOne(ownerId, file));
    }
    return results;
  }

  /** Deletes temporary files when a request is refused before they are registered. */
  async discardUploads(files: UploadedTempFile[]): Promise<void> {
    await Promise.all(files.map((file) => fsp.rm(file.path, { force: true })));
  }

  private async registerOne(
    ownerId: string,
    file: UploadedTempFile,
  ): Promise<UploadResult> {
    const originalFilename = sanitizeFilename(decodeFilename(file.originalname));
    let finalPath: string | null = null;
    try {
      if (file.size === 0) {
        throw new Rejection('The file is empty');
      }
      const { head, tail } = await readHeadAndTail(file.path, file.size);
      const fileType = detectFileType(head, tail);
      if (!fileType) {
        throw new Rejection(
          'The file content is not a supported or valid document type',
        );
      }
      if (!isExtensionAllowed(originalFilename, fileType)) {
        throw new Rejection(
          `The file extension does not match the file content (detected: ${fileType})`,
        );
      }
      const sha256 = await hashFile(file.path);
      const id = randomUUID();
      const storedName = `${id}.${EXTENSION_BY_TYPE[fileType]}`;
      finalPath = path.join(this.config.dir, storedName);
      await fsp.rename(file.path, finalPath);

      await this.documents.save(
        this.documents.create({
          id,
          ownerId,
          originalFilename,
          storedPath: storedName,
          mimeType: MIME_BY_TYPE[fileType],
          fileType,
          fileSize: String(file.size),
          sha256,
          status: 'uploaded',
        }),
      );
      return {
        status: 'accepted',
        originalFilename,
        id,
        fileType,
        size: file.size,
        documentStatus: 'uploaded',
      };
    } catch (error) {
      if (finalPath) {
        await fsp.rm(finalPath, { force: true });
      }
      if (error instanceof Rejection) {
        return { status: 'rejected', originalFilename, reason: error.message };
      }
      // Log the error text only, never file contents.
      this.logger.error(
        `Saving an upload failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return {
        status: 'rejected',
        originalFilename,
        reason: 'Internal error while saving the file',
      };
    } finally {
      // After a successful rename this path no longer exists; force ignores that.
      await fsp.rm(file.path, { force: true });
    }
  }
}

async function readHeadAndTail(
  filePath: string,
  size: number,
): Promise<{ head: Buffer; tail: Buffer }> {
  const handle = await fsp.open(filePath, 'r');
  try {
    const headLength = Math.min(HEAD_BYTES, size);
    const tailLength = Math.min(TAIL_BYTES, size);
    const head = Buffer.alloc(headLength);
    const tail = Buffer.alloc(tailLength);
    await handle.read(head, 0, headLength, 0);
    await handle.read(tail, 0, tailLength, size - tailLength);
    return { head, tail };
  } finally {
    await handle.close();
  }
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
}
