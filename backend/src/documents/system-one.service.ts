import { BadRequestException, Injectable } from '@nestjs/common';
import {
  QUESTION_INTENTS,
  type UnderstoodQuestion,
} from './question-understanding.service.js';
import type { RetrievalResponse } from './retrieval.service.js';

export const SYSTEM_ONE_DECISIONS = [
  'ANSWER_FROM_KNOWLEDGE',
  'NO_RELEVANT_KNOWLEDGE',
  'CLARIFICATION_REQUIRED',
] as const;

export type SystemOneDecision = (typeof SYSTEM_ONE_DECISIONS)[number];

export interface SystemOneResult {
  decision: SystemOneDecision;
  reason: string;
  requiresAnswerGeneration: boolean;
}

@Injectable()
export class SystemOneService {
  decide(
    understanding: UnderstoodQuestion,
    retrieval: RetrievalResponse,
  ): SystemOneResult {
    validateInput(understanding, retrieval);

    if (
      !understanding.normalizedQuestion.trim() ||
      !understanding.keywords.some((keyword) => keyword.trim().length > 0)
    ) {
      return {
        decision: 'CLARIFICATION_REQUIRED',
        reason:
          'The question is too unclear to retrieve reliable organization knowledge',
        requiresAnswerGeneration: false,
      };
    }

    if (retrieval.hasRelevantKnowledge && retrieval.results.length > 0) {
      return {
        decision: 'ANSWER_FROM_KNOWLEDGE',
        reason: 'Relevant organization knowledge was found',
        requiresAnswerGeneration: true,
      };
    }

    return {
      decision: 'NO_RELEVANT_KNOWLEDGE',
      reason: 'No relevant organization knowledge was found',
      requiresAnswerGeneration: false,
    };
  }
}

function validateInput(
  understanding: UnderstoodQuestion,
  retrieval: RetrievalResponse,
): void {
  if (
    typeof understanding !== 'object' ||
    understanding === null ||
    !QUESTION_INTENTS.some((intent) => intent === understanding.intent) ||
    typeof understanding.normalizedQuestion !== 'string' ||
    typeof understanding.requiresKnowledgeBase !== 'boolean' ||
    !Array.isArray(understanding.keywords) ||
    !understanding.keywords.every(
      (keyword) => typeof keyword === 'string',
    ) ||
    typeof retrieval !== 'object' ||
    retrieval === null ||
    typeof retrieval.hasRelevantKnowledge !== 'boolean' ||
    !Array.isArray(retrieval.results)
  ) {
    throw new BadRequestException('The decision input is invalid.');
  }
}
