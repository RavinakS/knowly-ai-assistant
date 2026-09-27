import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';
import { PublicAssistantController } from './public-assistant.controller.js';

@Module({
  imports: [AuthModule, DocumentsModule],
  controllers: [AssistantController, PublicAssistantController],
  providers: [AssistantService],
})
export class AssistantsModule {}
