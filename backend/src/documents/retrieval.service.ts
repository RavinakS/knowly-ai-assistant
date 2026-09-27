import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 20;
const MINIMUM_SCORE = 1;

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'do',
  'does',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'me',
  'of',
  'on',
  'or',
  'our',
  'the',
  'their',
  'this',
  'to',
  'we',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
  'you',
  'your',
]);

export interface ScoredChunk {
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  chunkIndex: number;
  content: string;
  score: number;
}

export interface RetrievalResponse {
  results: ScoredChunk[];
  hasRelevantKnowledge: boolean;
}

export interface RetrievalQuery {
  question: string;
  keywords?: string[];
}

@Injectable()
export class RetrievalService {
  constructor(private readonly prisma: PrismaService) {}

  async searchForUser(
    userId: string,
    query: string | RetrievalQuery,
    topK = DEFAULT_TOP_K,
  ): Promise<RetrievalResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.searchForOrganization(user.organizationId, query, topK);
  }

  async searchForOrganization(
    organizationId: string,
    query: string | RetrievalQuery,
    topK = DEFAULT_TOP_K,
  ): Promise<RetrievalResponse> {
    const question = typeof query === 'string' ? query : query.question;
    const normalizedQuestion = normalizeText(question);
    const keywords =
      typeof query === 'string' || query.keywords === undefined
        ? extractKeywords(normalizedQuestion)
        : extractProvidedKeywords(query.keywords);
    if (!normalizedQuestion || keywords.length === 0) {
      throw new BadRequestException(
        'Enter a question containing at least one meaningful keyword.',
      );
    }
    if (!Number.isInteger(topK) || topK < 1 || topK > MAX_TOP_K) {
      throw new BadRequestException(
        `topK must be an integer between 1 and ${MAX_TOP_K}.`,
      );
    }

    const candidates = await this.prisma.documentChunk.findMany({
      where: {
        organizationId,
        document: { is: { status: DocumentStatus.READY } },
      },
      select: {
        documentId: true,
        pageNumber: true,
        chunkIndex: true,
        content: true,
        document: { select: { originalFilename: true } },
      },
    });

    const results = candidates
      .map((candidate): ScoredChunk | null => {
        if (candidate.pageNumber === null) {
          return null;
        }
        const content = normalizeText(candidate.content);
        const score = scoreChunk(content, normalizedQuestion, keywords);
        if (score < MINIMUM_SCORE) {
          return null;
        }
        return {
          documentId: candidate.documentId,
          documentName: candidate.document.originalFilename,
          pageNumber: candidate.pageNumber,
          chunkIndex: candidate.chunkIndex,
          content: candidate.content,
          score,
        };
      })
      .filter((result): result is ScoredChunk => result !== null)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.documentId.localeCompare(right.documentId) ||
          (left.pageNumber ?? 0) - (right.pageNumber ?? 0) ||
          left.chunkIndex - right.chunkIndex,
      )
      .slice(0, topK);

    return {
      results,
      hasRelevantKnowledge: results.length > 0,
    };
  }
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function extractKeywords(normalizedQuestion: string): string[] {
  return extractProvidedKeywords(normalizedQuestion.split(' '));
}

function extractProvidedKeywords(values: string[]): string[] {
  return [
    ...new Set(
      values
        .flatMap((value) => normalizeText(value).split(' '))
        .filter((word) => word.length > 1 && !STOP_WORDS.has(word)),
    ),
  ];
}

function scoreChunk(
  content: string,
  normalizedQuestion: string,
  keywords: string[],
): number {
  const words = new Set(content.split(' '));
  let score = 0;

  for (const keyword of keywords) {
    if (!words.has(keyword)) {
      continue;
    }
    const occurrences = content
      .split(' ')
      .filter((word) => word === keyword).length;
    score += 1 + Math.min(occurrences - 1, 2) * 0.25;
  }

  if (
    keywords.length > 1 &&
    normalizedQuestion.length > 0 &&
    content.includes(normalizedQuestion)
  ) {
    score += 1;
  }

  return score;
}
