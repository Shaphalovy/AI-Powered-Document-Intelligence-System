import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UnprocessableEntityException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { seconds, Throttle } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { DocumentsService } from './documents.service';
import { UploadInterceptor } from './upload.interceptor';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /** POST /documents  (multipart/form-data, one or more "files" parts) */
  @Post()
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  @UseInterceptors(UploadInterceptor)
  async upload(
    @Req() req: AuthenticatedRequest,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    if (!req.user) {
      // The global guard normally stops this earlier; clean up in case it did not.
      await this.documents.discardUploads(files ?? []);
      throw new UnauthorizedException();
    }
    if (!files || files.length === 0) {
      throw new BadRequestException(
        'No files uploaded. Send multipart/form-data with one or more "files" parts.',
      );
    }
    const results = await this.documents.registerUploads(req.user.id, files);
    const accepted = results.filter((r) => r.status === 'accepted').length;
    if (accepted === 0) {
      throw new UnprocessableEntityException({
        message: 'No file was accepted',
        accepted: 0,
        rejected: results.length,
        results,
      });
    }
    return { accepted, rejected: results.length - accepted, results };
  }
}
