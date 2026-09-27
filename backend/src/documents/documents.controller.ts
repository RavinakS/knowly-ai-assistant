import {
  BadRequestException,
  Controller,
  Post,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DocumentsService } from './documents.service.js';
import { MulterExceptionFilter } from './multer-exception.filter.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Controller('documents')
@UseGuards(JwtAuthGuard)
@UseFilters(MulterExceptionFilter)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 0, parts: 1 },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file || file.size === 0) {
      throw new BadRequestException('A non-empty PDF file is required.');
    }
    if (file.mimetype !== 'application/pdf') {
      throw new UnsupportedMediaTypeException('Only PDF files are allowed.');
    }
    if (
      file.buffer.length < 5 ||
      file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-'
    ) {
      throw new UnsupportedMediaTypeException(
        'The uploaded file does not have a valid PDF signature.',
      );
    }

    return this.documentsService.upload(user.id, file);
  }
}
