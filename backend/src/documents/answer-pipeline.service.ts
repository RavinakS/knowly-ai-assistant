import { Injectable } from '@nestjs/common';
import { AnswerGenerationService } from './answer-generation.service.js';
import { QuestionUnderstandingService } from './question-understanding.service.js';
import { RetrievalService } from './retrieval.service.js';
import { SystemOneService } from './system-one.service.js';
import type { GeneratedAnswer } from './answer-generation.service.js';
import type { SystemOneDecision } from './system-one.service.js';

export interface AssistantAnswer extends GeneratedAnswer {
  decision: SystemOneDecision;
}

@Injectable()
export class AnswerPipelineService {
  constructor(
    private readonly questionUnderstanding: QuestionUnderstandingService,
    private readonly retrieval: RetrievalService,
    private readonly systemOne: SystemOneService,
    private readonly answerGeneration: AnswerGenerationService,
  ) {}

  async answerForUser(userId: string, question: string): Promise<AssistantAnswer> {
    const understanding =
      await this.questionUnderstanding.understand(question);
    const retrieval =
      understanding.normalizedQuestion.trim() &&
      understanding.keywords.length > 0
        ? await this.retrieval.searchForUser(userId, {
            question: understanding.normalizedQuestion,
            keywords: understanding.keywords,
          })
        : { results: [], hasRelevantKnowledge: false };

    return this.finishAnswer(understanding, retrieval);
  }

  async answerForOrganization(
    organizationId: string,
    question: string,
  ): Promise<AssistantAnswer> {
    const understanding =
      await this.questionUnderstanding.understand(question);
    const retrieval =
      understanding.normalizedQuestion.trim() &&
      understanding.keywords.length > 0
        ? await this.retrieval.searchForOrganization(organizationId, {
            question: understanding.normalizedQuestion,
            keywords: understanding.keywords,
          })
        : { results: [], hasRelevantKnowledge: false };

    return this.finishAnswer(understanding, retrieval);
  }

  private async finishAnswer(
    understanding: Awaited<
      ReturnType<QuestionUnderstandingService['understand']>
    >,
    retrieval: Awaited<ReturnType<RetrievalService['searchForUser']>>,
  ): Promise<AssistantAnswer> {
    const decision = this.systemOne.decide(understanding, retrieval);

    if (decision.decision === 'CLARIFICATION_REQUIRED') {
      return {
        answer:
          "Could you provide a little more detail about what you'd like to know?",
        sources: [],
        decision: decision.decision,
      };
    }
    if (decision.decision === 'NO_RELEVANT_KNOWLEDGE') {
      return {
        answer:
          "I couldn't find this information in the organization's knowledge base.",
        sources: [],
        decision: decision.decision,
      };
    }

    return {
      ...(await this.answerGeneration.generate(
        understanding.normalizedQuestion,
        retrieval.results,
      )),
      decision: decision.decision,
    };
  }
}
