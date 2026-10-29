import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { UnrecoverableError, Worker } from 'bullmq';
import { requireEnv } from '../config/env';
import { DocumentProcessingService } from './document-processing.service';
import { DOCUMENT_QUEUE, type DocumentJobData } from '../queue/queue.constants';
import { parseRedisUrl } from '../queue/redis-connection';
import { WORKER_CONFIG, type WorkerConfig } from './worker.config';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class DocumentWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentWorker.name);
  private worker?: Worker<DocumentJobData>;

  constructor(
    private readonly processing: DocumentProcessingService,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<DocumentJobData>(
      DOCUMENT_QUEUE,
      async (job) => {
        const documentId: unknown = job.data?.documentId;
        if (typeof documentId !== 'string' || !UUID_RE.test(documentId)) {
          throw new UnrecoverableError('Invalid job data');
        }
        await this.processing.handle({
          documentId,
          attemptsMade: job.attemptsMade,
          maxAttempts: job.opts.attempts ?? 1,
        });
      },
      {
        // The worker connection is created by BullMQ with the settings it needs.
        connection: parseRedisUrl(requireEnv('REDIS_URL')),
        concurrency: this.config.concurrency,
      },
    );
    this.worker.on('error', (error) =>
      this.logger.error(`Worker error: ${error.message}`),
    );
    this.worker.on('failed', (job, error) =>
      this.logger.warn(`Job ${job?.id ?? '?'} will be retried or dropped: ${error.message}`),
    );
    this.logger.log(`Worker started (concurrency ${this.config.concurrency})`);
  }

  /** Waits for running jobs to finish before the process exits. */
  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    this.logger.log('Worker stopped');
  }
}