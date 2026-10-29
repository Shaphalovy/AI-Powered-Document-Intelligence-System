import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ProcessingEventStatus } from '../documents/processing-event.entity';
import { DOCUMENT_STORE, type DocumentStore } from './document-store';
import {
  PROCESSOR_GATEWAY,
  ProcessorError,
  type ProcessorGateway,
} from './processor-gateway';

export interface JobContext {
  documentId: string;
  /** Attempts that already failed before this one (BullMQ attemptsMade). */
  attemptsMade: number;
  maxAttempts: number;
}

export type HandleResult = 'completed' | 'failed' | 'skipped';

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    @Inject(DOCUMENT_STORE) private readonly store: DocumentStore,
    @Inject(PROCESSOR_GATEWAY) private readonly processor: ProcessorGateway,
  ) {}

  /**
   * Runs one attempt for one document.
   * Throws only when BullMQ should retry the job later. Every other outcome returns.
   */
  async handle(job: JobContext): Promise<HandleResult> {
    const document = await this.store.claim(job.documentId);
    if (!document) {
      this.logger.warn(
        `Document ${job.documentId} is not waiting for processing, job skipped`,
      );
      return 'skipped';
    }

    const startedAt = Date.now();
    await this.event(document.id, 'started', `Attempt ${document.attempts}`);

    try {
      await this.processor.process({
        documentId: document.id,
        storedPath: document.storedPath,
        fileType: document.fileType,
      });
    } catch (error) {
      if (!(error instanceof ProcessorError)) {
        this.logger.error(`Unexpected processing error: ${safeMessage(error)}`);
      }
      const { message, retryable } = describeError(error);
      const duration = Date.now() - startedAt;
      const attemptsLeft = job.attemptsMade + 1 < job.maxAttempts;

      if (retryable && attemptsLeft) {
        await this.store.release(document.id, message);
        await this.event(document.id, 'retried', message, duration);
        throw new Error(message); // BullMQ runs the job again after its backoff
      }

      await this.store.fail(document.id, message);
      await this.event(document.id, 'failed', message, duration);
      return 'failed';
    }

    await this.store.complete(document.id);
    await this.event(
      document.id,
      'succeeded',
      'Processing finished',
      Date.now() - startedAt,
    );
    return 'completed';
  }

  /** A broken event log must never break processing. */
  private async event(
    documentId: string,
    status: ProcessingEventStatus,
    message: string,
    durationMs: number | null = null,
  ): Promise<void> {
    try {
      await this.store.recordEvent({
        documentId,
        stage: 'process',
        status,
        message,
        durationMs,
      });
    } catch (error) {
      this.logger.error(`Could not write a processing event: ${safeMessage(error)}`);
    }
  }
}

function describeError(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof ProcessorError) {
    return { message: error.message, retryable: error.retryable };
  }
  return { message: 'Unexpected error while processing', retryable: true };
}

/** Error text for logs, with anything that looks like credentials in a URL removed. */
function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'unknown error';
  return message.replace(/\/\/[^@\s/]*@/g, '//***@');
}