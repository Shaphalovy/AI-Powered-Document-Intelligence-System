import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentEntity } from '../documents/document.entity';
import type { DetectedFileType } from '../documents/file-type.detector';
import { ProcessingEventEntity } from '../documents/processing-event.entity';
import type {
  ClaimedDocument,
  DocumentStore,
  NewProcessingEvent,
} from './document-store';

interface ClaimRow {
  id: string;
  stored_path: string;
  file_type: DetectedFileType;
  attempts: number;
}

/**
 * Statuses a worker may claim. "processing" is included on purpose: BullMQ never gives the same job
 * (jobId = documentId) to two workers at once, so a document still marked "processing" when its job
 * arrives was left behind by a crashed worker (stalled job) and must be resumed, not skipped.
 */
export const CLAIMABLE_STATUSES = ['uploaded', 'queued', 'processing'] as const;

@Injectable()
export class TypeOrmDocumentStore implements DocumentStore {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documents: Repository<DocumentEntity>,
    @InjectRepository(ProcessingEventEntity)
    private readonly events: Repository<ProcessingEventEntity>,
  ) {}

  async claim(documentId: string): Promise<ClaimedDocument | null> {
    // One atomic statement. The job lock of BullMQ already guarantees one worker per document.
    const result = await this.documents
      .createQueryBuilder()
      .update(DocumentEntity)
      .set({
        status: 'processing',
        attempts: () => 'attempts + 1',
        errorMessage: null,
      })
      .where('id = :id AND status IN (:...statuses)', {
        id: documentId,
        statuses: [...CLAIMABLE_STATUSES],
      })
      .returning('id, stored_path, file_type, attempts')
      .execute();

    const row = (result.raw as ClaimRow[])[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      storedPath: row.stored_path,
      fileType: row.file_type,
      attempts: row.attempts,
    };
  }

  async release(documentId: string, message: string): Promise<void> {
    await this.documents.update(
      { id: documentId, status: 'processing' },
      { status: 'queued', errorMessage: message },
    );
  }

  async fail(documentId: string, message: string): Promise<void> {
    await this.documents.update(
      { id: documentId, status: 'processing' },
      { status: 'failed', errorMessage: message },
    );
  }

  async complete(documentId: string): Promise<void> {
    await this.documents.update(
      { id: documentId, status: 'processing' },
      { status: 'completed', errorMessage: null },
    );
  }

  async recordEvent(event: NewProcessingEvent): Promise<void> {
    await this.events.save(this.events.create(event));
  }
}