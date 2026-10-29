import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from './document.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { UploadInterceptor } from './upload.interceptor';
import { loadUploadConfig, UPLOAD_CONFIG } from './upload.config';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentEntity])],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    UploadInterceptor,
    { provide: UPLOAD_CONFIG, useFactory: () => loadUploadConfig() },
  ],
})
export class DocumentsModule {}
