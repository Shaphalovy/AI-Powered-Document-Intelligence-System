import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueModule } from '../queue/queue.module';
import { DocumentEntity } from './document.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { ProcessingEventEntity } from './processing-event.entity';
import { UploadInterceptor } from './upload.interceptor';
import { loadUploadConfig, UPLOAD_CONFIG } from './upload.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity, ProcessingEventEntity]),
    QueueModule,
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    UploadInterceptor,
    { provide: UPLOAD_CONFIG, useFactory: () => loadUploadConfig() },
  ],
})
export class DocumentsModule {}