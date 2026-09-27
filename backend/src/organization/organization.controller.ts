import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { OrganizationService } from './organization.service.js';

@Controller('organization/me')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  getOrganization(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationService.getForUser(user.id);
  }

  @Get('documents')
  getDocuments(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationService.getDocumentsForUser(user.id);
  }
}
