import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  PayloadTooLargeException,
} from "@nestjs/common";
import { DocumentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { PdfTextExtractorService } from "./pdf-text-extractor.service.js";
import { ChunkingService } from "./chunking.service.js";
import { DOCUMENT_STORAGE } from "./storage/document-storage.interface.js";
import type { DocumentStorage } from "./storage/document-storage.interface.js";

const MAX_PDF_PAGES = 20;

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    @Inject(DOCUMENT_STORAGE)
    private readonly storage: DocumentStorage,
    private readonly prisma: PrismaService,
    private readonly extractor: PdfTextExtractorService,
    private readonly chunking: ChunkingService,
  ) {}

  async process(
    documentId: string,
    organizationId: string,
    storageKey: string,
  ): Promise<{ status: DocumentStatus; pageCount: number | null }> {
    let extracted;
    try {
      const buffer = await this.storage.read(organizationId, storageKey);
      extracted = await this.extractor.extract(buffer);
    } catch (error) {
      await this.markFailed(documentId, organizationId, error);
      return { status: DocumentStatus.FAILED, pageCount: null };
    }

    if (extracted.pageCount > MAX_PDF_PAGES) {
      throw new PayloadTooLargeException(
        `PDFs must contain ${MAX_PDF_PAGES} pages or fewer.`,
      );
    }

    try {
      const chunks = extracted.pages.flatMap((page) =>
        this.chunking.chunk(page.text).map((content, chunkIndex) => ({
          documentId,
          organizationId,
          pageNumber: page.pageNumber,
          chunkIndex,
          content,
        })),
      );

      await this.prisma.$transaction(async (transaction) => {
        await transaction.documentChunk.deleteMany({
          where: { documentId, organizationId },
        });
        await transaction.documentPage.deleteMany({
          where: { documentId, organizationId },
        });
        await transaction.documentPage.createMany({
          data: extracted.pages.map((page) => ({
            documentId,
            organizationId,
            pageNumber: page.pageNumber,
            text: page.text,
          })),
        });
        if (chunks.length > 0) {
          await transaction.documentChunk.createMany({ data: chunks });
        }
        await transaction.document.update({
          where: {
            id_organizationId: { id: documentId, organizationId },
          },
          data: {
            pageCount: extracted.pageCount,
            status: DocumentStatus.READY,
          },
        });
      });

      return { status: DocumentStatus.READY, pageCount: extracted.pageCount };
    } catch (error) {
      await this.markFailed(documentId, organizationId, error);
      return { status: DocumentStatus.FAILED, pageCount: null };
    }
  }

  private async markFailed(
    documentId: string,
    organizationId: string,
    error: unknown,
  ): Promise<void> {
    this.logger.error(
      `PDF processing failed for document ${documentId}.`,
      error instanceof Error ? error.stack : undefined,
    );

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.documentChunk.deleteMany({
          where: { documentId, organizationId },
        });
        await transaction.documentPage.deleteMany({
          where: { documentId, organizationId },
        });
        await transaction.document.update({
          where: {
            id_organizationId: { id: documentId, organizationId },
          },
          data: { pageCount: null, status: DocumentStatus.FAILED },
        });
      });
    } catch (statusError) {
      this.logger.error(
        `Failed to mark document ${documentId} as failed.`,
        statusError instanceof Error ? statusError.stack : undefined,
      );
      throw new InternalServerErrorException(
        "The document could not be processed.",
      );
    }
  }
}
