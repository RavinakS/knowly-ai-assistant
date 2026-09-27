import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        organizationId: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        id: true,
        name: true,
        assistant: { select: { id: true, token: true } },
      },
    });
    if (!organization) {
      throw new UnauthorizedException();
    }

    return {
      user: { id: user.id, email: user.email, name: user.name },
      organization: { id: organization.id, name: organization.name },
      assistant: organization.assistant,
    };
  }

  async getDocumentsForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.prisma.document.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        filename: true,
        originalFilename: true,
        fileSize: true,
        pageCount: true,
        mimeType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
