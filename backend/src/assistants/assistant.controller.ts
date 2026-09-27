import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AssistantService } from './assistant.service.js';

@Controller('assistants')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistants: AssistantService) {}

  @Post()
  getOrCreate(@CurrentUser() user: AuthenticatedUser) {
    return this.assistants.getOrCreateForUser(user.id);
  }
}
