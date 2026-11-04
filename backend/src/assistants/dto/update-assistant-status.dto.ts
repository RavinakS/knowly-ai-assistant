import { IsBoolean } from "class-validator";

export class UpdateAssistantStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
