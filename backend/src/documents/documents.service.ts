import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  UnauthorizedException,
} from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { DocumentProcessingService } from './document-processing.service.js';
import { LocalUploadStorage } from './local-upload-storage.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface UploadedDocument {
  id: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  status: DocumentStatus;
  createdAt: Date;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalUploadStorage,
    private readonly processing: DocumentProcessingService,
  ) {}

  async upload(userId: string, file: Express.Multer.File) {
    if (!file || !Buffer.isBuffer(file.buffer) || file.size === 0) {
      throw new BadRequestException('A non-empty PDF file is required.');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException('File must be 10 MB or smaller.');
    }
    if (
      file.mimetype !== 'application/pdf' ||
      file.buffer.length < 5 ||
      file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-'
    ) {
      throw new UnsupportedMediaTypeException(
        'The uploaded file is not a valid PDF.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    const originalFilename = file.originalname
      .split(/[\\/]/)
      .at(-1)
      ?.replace(/[\u0000-\u001f\u007f]/g, '')
      .trim();
    if (!originalFilename || originalFilename.length > 255) {
      throw new BadRequestException('The uploaded filename is invalid.');
    }

    const stored = await this.storage.store(user.organizationId, file.buffer);
    let document: UploadedDocument;
    try {
      document = await this.prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw<{ locked: boolean }[]>`
          WITH acquired AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${user.organizationId}, 0))
          )
          SELECT TRUE AS locked FROM acquired
        `;
        const documentCount = await transaction.document.count({
          where: { organizationId: user.organizationId },
        });
        if (documentCount >= 10) {
          throw new ConflictException(
            'Your organization has reached the 10-document limit.',
          );
        }

        return transaction.document.create({
          data: {
            id: stored.id,
            organizationId: user.organizationId,
            filename: stored.filename,
            originalFilename,
            fileSize: file.size,
            pageCount: null,
            mimeType: 'application/pdf',
            status: DocumentStatus.PROCESSING,
          },
          select: {
            id: true,
            originalFilename: true,
            fileSize: true,
            mimeType: true,
            status: true,
            createdAt: true,
          },
        });
      });
    } catch (error) {
      try {
        await this.storage.remove(stored.path);
      } catch (cleanupError) {
        this.logger.error(
          'Failed to clean up a stored upload after its database insert failed.',
          cleanupError instanceof Error ? cleanupError.stack : undefined,
        );
      }
      this.logger.error(
        'Failed to create the uploaded document record.',
        error instanceof HttpException
          ? undefined
          : error instanceof Error
            ? error.stack
            : undefined,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Unable to save the uploaded document.',
      );
    }

    let processingResult;
    try {
      processingResult = await this.processing.process(
        stored.id,
        user.organizationId,
        stored.path,
      );
    } catch (error) {
      if (error instanceof PayloadTooLargeException) {
        try {
          await this.prisma.document.delete({
            where: {
              id_organizationId: {
                id: stored.id,
                organizationId: user.organizationId,
              },
            },
          });
          await this.storage.remove(stored.path);
        } catch (cleanupError) {
          this.logger.error(
            `Failed to clean up an over-limit document ${stored.id}.`,
            cleanupError instanceof Error ? cleanupError.stack : undefined,
          );
          throw new InternalServerErrorException(
            'Unable to reject the uploaded document safely.',
          );
        }
        throw error;
      }
      throw error;
    }
    return { ...document, ...processingResult };
  }

  async getPagesForUser(userId: string, documentId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId)) {
      throw new BadRequestException('Invalid document ID.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!document) {
      throw new NotFoundException('Document not found.');
    }

    const pages = await this.prisma.documentPage.findMany({
      where: { documentId: document.id, organizationId: user.organizationId },
      select: { pageNumber: true, text: true },
      orderBy: { pageNumber: 'asc' },
    });
    const chunks = await this.prisma.documentChunk.findMany({
      where: { documentId: document.id, organizationId: user.organizationId },
      select: { pageNumber: true, chunkIndex: true, content: true },
      orderBy: [{ pageNumber: 'asc' }, { chunkIndex: 'asc' }],
    });
    return {
      documentId: document.id,
      pages: pages.map((page) => ({
        ...page,
        chunks: chunks
          .filter((chunk) => chunk.pageNumber === page.pageNumber)
          .map(({ chunkIndex, content }) => ({ chunkIndex, content })),
      })),
    };
  }
}
