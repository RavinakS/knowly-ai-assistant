import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

export const QUESTION_INTENTS = [
  'knowledge_question',
  'comparison',
  'procedural_question',
  'eligibility_question',
  'unknown',
] as const;

export type QuestionIntent = (typeof QUESTION_INTENTS)[number];

export interface UnderstoodQuestion {
  intent: QuestionIntent;
  normalizedQuestion: string;
  requiresKnowledgeBase: boolean;
  keywords: string[];
}

const MAX_QUESTION_LENGTH = 1000;
const MAX_KEYWORDS = 10;
const REQUEST_TIMEOUT_MS = 15_000;

const SYSTEM_PROMPT = `You are a question-understanding component for an organizational knowledge assistant.
Your job is ONLY to classify and normalize the user's question.
Do not answer the question. Do not invent facts.
Return ONLY valid JSON matching this schema:
{
  "intent": "knowledge_question" | "comparison" | "procedural_question" | "eligibility_question" | "unknown",
  "normalizedQuestion": "concise normalized question preserving the user's meaning",
  "requiresKnowledgeBase": true,
  "keywords": ["up to 10 useful retrieval terms"]
}
Classify requests to compare entities as comparison, how-to/process requests as procedural_question, qualification or eligibility requests as eligibility_question, organization-specific fact questions as knowledge_question, and unrelated or unclear requests as unknown. Set requiresKnowledgeBase to true when the answer depends on organization-specific knowledge, otherwise false. Do not include any additional properties.`;

@Injectable()
export class QuestionUnderstandingService {
  async understand(question: string): Promise<UnderstoodQuestion> {
    const normalizedInput = typeof question === 'string' ? question.trim() : '';
    if (!normalizedInput) {
      throw new BadRequestException('A non-empty question is required.');
    }
    if (normalizedInput.length > MAX_QUESTION_LENGTH) {
      throw new BadRequestException('The question must be 1000 characters or fewer.');
    }

    const apiKey = process.env.LLM_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Question understanding is not configured.',
      );
    }

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: normalizedInput },
          ],
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException(
          'Question understanding timed out. Please try again.',
        );
      }
      throw new BadGatewayException(
        'The question understanding provider is unavailable.',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        'The question understanding provider could not process the request.',
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException(
        'The question understanding provider returned an invalid response.',
      );
    }

    const content = getMessageContent(payload);
    if (content === null) {
      throw new BadGatewayException(
        'The question understanding provider returned an invalid response.',
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new BadGatewayException(
        'The question understanding provider returned invalid JSON.',
      );
    }

    return validateUnderstoodQuestion(parsed);
  }
}

function getMessageContent(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('choices' in payload)) {
    return null;
  }
  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }
  const first = choices[0];
  if (typeof first !== 'object' || first === null || !('message' in first)) {
    return null;
  }
  const message = first.message;
  if (typeof message !== 'object' || message === null || !('content' in message)) {
    return null;
  }
  return typeof message.content === 'string' ? message.content : null;
}

function validateUnderstoodQuestion(value: unknown): UnderstoodQuestion {
  if (typeof value !== 'object' || value === null) {
    throw invalidResponse();
  }

  if (
    !('intent' in value) ||
    !('normalizedQuestion' in value) ||
    !('requiresKnowledgeBase' in value) ||
    !('keywords' in value)
  ) {
    throw invalidResponse();
  }
  const { intent, normalizedQuestion, requiresKnowledgeBase, keywords } = value;
  if (
    !isQuestionIntent(intent) ||
    typeof normalizedQuestion !== 'string' ||
    !normalizedQuestion.trim() ||
    normalizedQuestion.length > MAX_QUESTION_LENGTH ||
    typeof requiresKnowledgeBase !== 'boolean' ||
    !Array.isArray(keywords) ||
    keywords.length > MAX_KEYWORDS ||
    !keywords.every(isKeyword)
  ) {
    throw invalidResponse();
  }

  return {
    intent,
    normalizedQuestion: normalizedQuestion.trim(),
    requiresKnowledgeBase,
    keywords: keywords.map((keyword) => keyword.trim()),
  };
}

function isQuestionIntent(value: unknown): value is QuestionIntent {
  return (
    typeof value === 'string' &&
    QUESTION_INTENTS.some((intent) => intent === value)
  );
}

function isKeyword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 100
  );
}

function invalidResponse(): BadGatewayException {
  return new BadGatewayException(
    'The question understanding provider returned an invalid structured response.',
  );
}
