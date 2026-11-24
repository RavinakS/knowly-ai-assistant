import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DocumentsController } from "./documents.controller.js";
import { DocumentProcessingService } from "./document-processing.service.js";
import { DocumentsService } from "./management/documents.service.js";
import { LocalUploadStorage } from "./storage/local-upload-storage.js";
import { PdfTextExtractorService } from "./pdf-text-extractor.service.js";
import { ChunkingService } from "./chunking.service.js";
import { RetrievalService } from "./retrieval.service.js";
import { QuestionUnderstandingService } from "./question-understanding.service.js";
import { SystemOneService } from "./system-one.service.js";
import { AnswerGenerationService } from "./answer-generation.service.js";
import { AnswerPipelineService } from "./answer-pipeline.service.js";
import { DOCUMENT_STORAGE } from "./storage/document-storage.interface.js";

@Module({
  imports: [AuthModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentProcessingService,
    ChunkingService,
    RetrievalService,
    QuestionUnderstandingService,
    SystemOneService,
    AnswerGenerationService,
    AnswerPipelineService,
    LocalUploadStorage,
    PdfTextExtractorService,
    JwtAuthGuard,
    { provide: DOCUMENT_STORAGE, useExisting: LocalUploadStorage },
  ],
  exports: [AnswerPipelineService],
})
export class DocumentsModule {}
