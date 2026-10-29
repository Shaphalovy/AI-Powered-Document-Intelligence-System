import { Inject, Injectable } from '@nestjs/common';
import {
  ProcessorError,
  type ProcessorGateway,
  type ProcessRequest,
} from './processor-gateway';
import { WORKER_CONFIG, type WorkerConfig } from './worker.config';

@Injectable()
export class ProcessorClient implements ProcessorGateway {
  constructor(@Inject(WORKER_CONFIG) private readonly config: WorkerConfig) {}

  async process(request: ProcessRequest): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${this.config.processorUrl}/process`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          document_id: request.documentId,
          stored_path: request.storedPath,
          file_type: request.fileType,
        }),
        signal: AbortSignal.timeout(this.config.processorTimeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ProcessorError('The processor did not respond in time', true);
      }
      throw new ProcessorError('The processor is unreachable', true);
    }

    // Release the connection without reading the body (it is never stored or shown).
    await response.body?.cancel().catch(() => undefined);

    if (response.ok) {
      return;
    }
    if (response.status === 501) {
      throw new ProcessorError('Processing is not implemented yet', false);
    }
    if (response.status >= 500) {
      throw new ProcessorError(
        `The processor returned an error (status ${response.status})`,
        true,
      );
    }
    throw new ProcessorError(
      `The processor rejected the request (status ${response.status})`,
      false,
    );
  }
}