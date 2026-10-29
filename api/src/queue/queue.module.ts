import { Logger, Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { requireEnv } from '../config/env';
import { DocumentQueueService } from './document-queue.service';
import {
  DOCUMENT_QUEUE,
  DOCUMENT_QUEUE_TOKEN,
  JOB_ATTEMPTS,
  JOB_BACKOFF_MS,
  type DocumentJobData,
} from './queue.constants';
import { parseRedisUrl } from './redis-connection';

@Module({
  providers: [
    {
      provide: DOCUMENT_QUEUE_TOKEN,
      useFactory: () => {
        const queue = new Queue<DocumentJobData>(DOCUMENT_QUEUE, {
          // Producer side: fail fast if Redis is down so the HTTP request gets an error quickly.
          connection: {
            ...parseRedisUrl(requireEnv('REDIS_URL')),
            maxRetriesPerRequest: 1,
          },
          defaultJobOptions: {
            attempts: JOB_ATTEMPTS,
            backoff: { type: 'exponential', delay: JOB_BACKOFF_MS },
            removeOnComplete: true,
            removeOnFail: true,
          },
        });
        const logger = new Logger('DocumentQueue');
        queue.on('error', (err) => logger.error(`Queue error: ${err.message}`));
        return queue;
      },
    },
    DocumentQueueService,
  ],
  exports: [DocumentQueueService],
})
export class QueueModule {}