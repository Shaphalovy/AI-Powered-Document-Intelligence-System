import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  DOCUMENT_JOB,
  DOCUMENT_QUEUE_TOKEN,
  type DocumentJobData,
} from './queue.constants';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class DocumentQueueService implements OnModuleDestroy {
  constructor(
    @Inject(DOCUMENT_QUEUE_TOKEN) private readonly queue: Queue<DocumentJobData>,
  ) {}

  /** jobId = documentId, so a second enqueue while the job exists is ignored by BullMQ. */
  async enqueue(documentId: string): Promise<void> {
    if (!UUID_RE.test(documentId)) {
      throw new Error('Invalid document id');
    }
    await this.queue.add(DOCUMENT_JOB, { documentId }, { jobId: documentId });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}