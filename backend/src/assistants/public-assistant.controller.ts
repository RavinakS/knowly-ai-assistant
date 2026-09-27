import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { UnderstandQuestionDto } from '../documents/dto/understand-question.dto.js';
import { AssistantService } from './assistant.service.js';

@Controller('public/assistants')
export class PublicAssistantController {
  constructor(private readonly assistants: AssistantService) {}

  @Get(':publicId')
  getPublicInfo(@Param('publicId') publicId: string) {
    if (publicId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(publicId)) {
      throw new NotFoundException('Assistant not found.');
    }
    return this.assistants.getPublicInfo(publicId);
  }

  @Post(':publicId/answer')
  answer(
    @Param('publicId') publicId: string,
    @Body() dto: UnderstandQuestionDto,
  ) {
    if (
      publicId.length > 128 ||
      !/^[A-Za-z0-9_-]+$/.test(publicId)
    ) {
      throw new NotFoundException('Assistant not found.');
    }
    return this.assistants.answerPublic(publicId, dto.question);
  }
}
