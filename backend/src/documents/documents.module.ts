import { Module, type Provider } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DocumentsController } from "./documents.controller.js";
import { DocumentProcessingService } from "./document-processing.service.js";
import { DocumentsService } from "./management/documents.service.js";
import { LocalUploadStorage } from "./storage/local-upload-storage.js";
import { SupabaseDocumentStorage } from "./storage/supabase-document-storage.js";
import { PdfTextExtractorService } from "./pdf-text-extractor.service.js";
import { ChunkingService } from "./chunking.service.js";
import { RetrievalService } from "./retrieval.service.js";
import { QuestionUnderstandingService } from "./question-understanding.service.js";
import { SystemOneService } from "./system-one.service.js";
import { AnswerGenerationService } from "./answer-generation.service.js";
import { AnswerPipelineService } from "./answer-pipeline.service.js";
import { DOCUMENT_STORAGE } from "./storage/document-storage.interface.js";

const storageProvider = process.env.STORAGE_PROVIDER?.trim().toLowerCase();
const selectedStorageProvider =
  storageProvider ??
  (process.env.NODE_ENV === "production" ? undefined : "local");

if (!selectedStorageProvider) {
  throw new Error(
    "Set STORAGE_PROVIDER to 'local' or 'supabase' before starting the backend in production.",
  );
}

const documentStorageProviders: Provider[] =
  selectedStorageProvider === "local"
    ? [
        LocalUploadStorage,
        { provide: DOCUMENT_STORAGE, useExisting: LocalUploadStorage },
      ]
    : selectedStorageProvider === "supabase"
      ? [
          SupabaseDocumentStorage,
          {
            provide: DOCUMENT_STORAGE,
            useExisting: SupabaseDocumentStorage,
          },
        ]
      : (() => {
          throw new Error(
            `Unsupported STORAGE_PROVIDER '${selectedStorageProvider}'. Use 'local' or 'supabase'.`,
          );
        })();

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
    ...documentStorageProviders,
    PdfTextExtractorService,
    JwtAuthGuard,
  ],
  exports: [AnswerPipelineService],
})
export class DocumentsModule {}
