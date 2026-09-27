import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { OrganizationModule } from './organization/organization.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AssistantsModule } from './assistants/assistants.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrganizationModule,
    DocumentsModule,
    AssistantsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
