import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AnswerPipelineService } from '../documents/answer-pipeline.service.js';

const ASSISTANT_NAME = 'Organization Assistant';

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly answerPipeline: AnswerPipelineService,
  ) {}

  async getOrCreateForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    const assistant = await this.prisma.assistant.upsert({
      where: { organizationId: user.organizationId },
      create: { organizationId: user.organizationId },
      update: {},
      select: { id: true, token: true, isActive: true },
    });
    const baseUrl = (process.env.PUBLIC_APP_URL || 'http://localhost:3000')
      .trim()
      .replace(/\/+$/, '');

    return {
      id: assistant.id,
      publicId: assistant.token,
      name: ASSISTANT_NAME,
      isActive: assistant.isActive,
      publicUrl: `${baseUrl}/assistant/${encodeURIComponent(assistant.token)}`,
      embedUrl: `${baseUrl}/embed/assistant/${encodeURIComponent(assistant.token)}`,
    };
  }

  async answerPublic(publicId: string, question: string) {
    const assistant = await this.prisma.assistant.findUnique({
      where: { token: publicId },
      select: { organizationId: true, isActive: true },
    });
    if (!assistant || !assistant.isActive) {
      throw new NotFoundException('Assistant not found.');
    }

    return this.answerPipeline.answerForOrganization(
      assistant.organizationId,
      question,
    );
  }

  async getPublicInfo(publicId: string) {
    const assistant = await this.prisma.assistant.findUnique({
      where: { token: publicId },
      select: { isActive: true },
    });
    if (!assistant || !assistant.isActive) {
      throw new NotFoundException('Assistant not found.');
    }
    return { name: ASSISTANT_NAME };
  }
}
