import type { DetectedFileType } from '../documents/file-type.detector';

export const PROCESSOR_GATEWAY = Symbol('PROCESSOR_GATEWAY');

export interface ProcessRequest {
  documentId: string;
  storedPath: string;
  fileType: DetectedFileType;
}

export interface ProcessorGateway {
  /** Resolves when the processor finished the document. Throws ProcessorError otherwise. */
  process(request: ProcessRequest): Promise<void>;
}

/** Error text is safe to store and show: it never contains URLs or response bodies. */
export class ProcessorError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ProcessorError';
  }
}