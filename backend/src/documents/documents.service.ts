import {
  BadRequestException,
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
      document = await this.prisma.document.create({
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
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'Unable to save the uploaded document.',
      );
    }

    const processingResult = await this.processing.process(
      stored.id,
      user.organizationId,
      stored.path,
    );
    return { ...document, ...processingResult };
  }

  async getPagesForUser(userId: string, documentId: string) {
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
    return { documentId: document.id, pages };
  }
}
