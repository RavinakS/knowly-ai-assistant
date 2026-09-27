import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PdfTextExtractorService } from './pdf-text-extractor.service.js';

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly extractor: PdfTextExtractorService,
  ) {}

  async process(
    documentId: string,
    organizationId: string,
    filePath: string,
  ): Promise<{ status: DocumentStatus; pageCount: number | null }> {
    try {
      const extracted = await this.extractor.extract(filePath);

      await this.prisma.$transaction(async (transaction) => {
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
      this.logger.error(
        `PDF processing failed for document ${documentId}.`,
        error instanceof Error ? error.stack : undefined,
      );

      try {
        await this.prisma.$transaction(async (transaction) => {
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
          'The document could not be processed.',
        );
      }

      return { status: DocumentStatus.FAILED, pageCount: null };
    }
  }
}
