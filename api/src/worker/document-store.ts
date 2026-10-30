import type { DetectedFileType } from '../documents/file-type.detector';
import type { ProcessingEventStatus } from '../documents/processing-event.entity';

export const DOCUMENT_STORE = Symbol('DOCUMENT_STORE');

export interface ClaimedDocument {
  id: string;
  storedPath: string;
  fileType: DetectedFileType;
  /** Number of attempts including the current one. */
  attempts: number;
}

export interface NewProcessingEvent {
  documentId: string;
  stage: string;
  status: ProcessingEventStatus;
  message: string | null;
  durationMs: number | null;
}

export interface DocumentStore {
  /** Atomically moves a document from uploaded/queued/processing to processing. Returns null when it is finished or missing. */
  claim(documentId: string): Promise<ClaimedDocument | null>;
  /** Back to queued with the last error, so the next attempt can claim it again. */
  release(documentId: string, message: string): Promise<void>;
  /** Final failure. */
  fail(documentId: string, message: string): Promise<void>;
  /** Processing finished. */
  complete(documentId: string): Promise<void>;
  recordEvent(event: NewProcessingEvent): Promise<void>;
}