import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmOptions } from '../database/typeorm-options';
import { DocumentEntity } from '../documents/document.entity';
import { ProcessingEventEntity } from '../documents/processing-event.entity';
import { DocumentProcessingService } from './document-processing.service';
import { DOCUMENT_STORE } from './document-store';
import { DocumentWorker } from './document.worker';
import { ProcessorClient } from './processor-client';
import { PROCESSOR_GATEWAY } from './processor-gateway';
import { TypeOrmDocumentStore } from './typeorm-document-store';
import { loadWorkerConfig, WORKER_CONFIG } from './worker.config';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeOrmOptions()),
    TypeOrmModule.forFeature([DocumentEntity, ProcessingEventEntity]),
  ],
  providers: [
    { provide: WORKER_CONFIG, useFactory: () => loadWorkerConfig() },
    { provide: DOCUMENT_STORE, useClass: TypeOrmDocumentStore },
    { provide: PROCESSOR_GATEWAY, useClass: ProcessorClient },
    DocumentProcessingService,
    DocumentWorker,
  ],
})
export class WorkerModule {}