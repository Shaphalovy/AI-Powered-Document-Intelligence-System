import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Observable } from 'rxjs';
import { buildMulterOptions } from './multer.options';
import { UPLOAD_CONFIG, type UploadConfig } from './upload.config';

export const UPLOAD_FIELD_NAME = 'files';

/** Wraps Nest's FilesInterceptor so limits come from the validated config. */
@Injectable()
export class UploadInterceptor implements NestInterceptor {
  private readonly delegate: NestInterceptor;

  constructor(@Inject(UPLOAD_CONFIG) config: UploadConfig) {
    const Delegate = FilesInterceptor(
      UPLOAD_FIELD_NAME,
      config.maxFilesPerRequest,
      buildMulterOptions(config),
    );
    this.delegate = new Delegate();
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> | Promise<Observable<unknown>> {
    return this.delegate.intercept(context, next);
  }
}
