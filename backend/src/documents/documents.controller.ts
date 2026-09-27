import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
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
import { SearchDocumentsDto } from './dto/search-documents.dto.js';
import { RetrievalService } from './retrieval.service.js';
import { UnderstandQuestionDto } from './dto/understand-question.dto.js';
import { QuestionUnderstandingService } from './question-understanding.service.js';
import { SystemOneService } from './system-one.service.js';
import { AnswerPipelineService } from './answer-pipeline.service.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Controller('documents')
@UseGuards(JwtAuthGuard)
@UseFilters(MulterExceptionFilter)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly retrievalService: RetrievalService,
    private readonly questionUnderstanding: QuestionUnderstandingService,
    private readonly systemOne: SystemOneService,
    private readonly answerPipeline: AnswerPipelineService,
  ) {}

  @Post('understand-question')
  understandQuestion(@Body() dto: UnderstandQuestionDto) {
    return this.questionUnderstanding.understand(dto.question);
  }

  @Post('decide')
  async decide(@CurrentUser() user: AuthenticatedUser, @Body() dto: UnderstandQuestionDto) {
    const questionUnderstanding = await this.questionUnderstanding.understand(
      dto.question,
    );
    const retrieval =
      questionUnderstanding.normalizedQuestion.trim() &&
      questionUnderstanding.keywords.length > 0
        ? await this.retrievalService.searchForUser(user.id, {
            question: questionUnderstanding.normalizedQuestion,
            keywords: questionUnderstanding.keywords,
          })
        : { results: [], hasRelevantKnowledge: false };
    const decision = this.systemOne.decide(questionUnderstanding, retrieval);

    return {
      ...decision,
      questionUnderstanding,
      retrieval,
    };
  }

  @Post('answer')
  answer(@CurrentUser() user: AuthenticatedUser, @Body() dto: UnderstandQuestionDto) {
    return this.answerPipeline.answerForUser(user.id, dto.question);
  }

  @Post('search')
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SearchDocumentsDto,
  ) {
    return this.retrievalService.searchForUser(user.id, dto.question);
  }

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

  @Get(':id/pages')
  getPages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') documentId: string,
  ) {
    return this.documentsService.getPagesForUser(user.id, documentId);
  }
}
