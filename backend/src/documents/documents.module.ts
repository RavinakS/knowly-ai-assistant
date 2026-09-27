import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentProcessingService } from './document-processing.service.js';
import { DocumentsService } from './documents.service.js';
import { LocalUploadStorage } from './local-upload-storage.js';
import { PdfTextExtractorService } from './pdf-text-extractor.service.js';
import { ChunkingService } from './chunking.service.js';

@Module({
  imports: [AuthModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentProcessingService,
    ChunkingService,
    LocalUploadStorage,
    PdfTextExtractorService,
    JwtAuthGuard,
  ],
})
export class DocumentsModule {}
