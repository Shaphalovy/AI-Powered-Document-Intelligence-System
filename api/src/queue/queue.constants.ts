export const DOCUMENT_QUEUE = 'document-processing';
export const DOCUMENT_JOB = 'process-document';
export const DOCUMENT_QUEUE_TOKEN = Symbol('DOCUMENT_QUEUE');

/** Queue payload is the document ID only (job data is plain text in Redis). */
export interface DocumentJobData {
  documentId: string;
}

export const JOB_ATTEMPTS = 3;
export const JOB_BACKOFF_MS = 5000;