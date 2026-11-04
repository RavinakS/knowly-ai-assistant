import { Body, Controller, Patch, Post, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { AssistantService } from "./assistant.service.js";
import { UpdateAssistantStatusDto } from "./dto/update-assistant-status.dto.js";

@Controller("assistants")
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistants: AssistantService) {}

  @Post()
  getOrCreate(@CurrentUser() user: AuthenticatedUser) {
    return this.assistants.getOrCreateForUser(user.id);
  }

  @Patch()
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAssistantStatusDto,
  ) {
    return this.assistants.setActiveForUser(user.id, dto.isActive);
  }
}
