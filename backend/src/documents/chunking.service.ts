import { Injectable } from '@nestjs/common';

const TARGET_CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const MIN_BOUNDARY_SEARCH = 500;

export function chunkPageText(
  input: string,
  targetSize = TARGET_CHUNK_SIZE,
  overlap = CHUNK_OVERLAP,
): string[] {
  const text = input
    .replace(/\r\n?/g, '\n')
    .replace(/\0/g, '')
    .trim();
  if (!text) {
    return [];
  }
  if (
    !Number.isInteger(targetSize) ||
    !Number.isInteger(overlap) ||
    targetSize < 1 ||
    overlap < 0 ||
    overlap >= targetSize
  ) {
    throw new RangeError('Chunk size and overlap configuration is invalid.');
  }
  if (text.length <= targetSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const limit = Math.min(start + targetSize, text.length);
    let end = limit;

    if (limit < text.length) {
      end =
        findBoundary(text, start, limit, '\n\n', MIN_BOUNDARY_SEARCH) ??
        findBoundary(text, start, limit, '\n', MIN_BOUNDARY_SEARCH) ??
        findSentenceBoundary(text, start, limit, MIN_BOUNDARY_SEARCH) ??
        findWhitespaceBoundary(text, start, limit, MIN_BOUNDARY_SEARCH) ??
        limit;
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= text.length) {
      break;
    }

    const nextStart = Math.max(start + 1, end - overlap);
    start =
      nextStart > 0 && /\s/.test(text[nextStart - 1]) && /\s/.test(text[nextStart])
        ? nextStart + 1
        : nextStart;
  }

  return chunks;
}

function findBoundary(
  text: string,
  start: number,
  limit: number,
  boundary: string,
  minimumOffset: number,
): number | null {
  const index = text.lastIndexOf(boundary, limit - 1);
  return index >= start + minimumOffset ? index + boundary.length : null;
}

function findSentenceBoundary(
  text: string,
  start: number,
  limit: number,
  minimumOffset: number,
): number | null {
  const slice = text.slice(start, limit);
  const matches = [...slice.matchAll(/[.!?](?:["')\]]?)(?=\s)/g)];
  const last = matches.at(-1);
  if (!last || last.index === undefined || last.index < minimumOffset) {
    return null;
  }
  return start + last.index + last[0].length;
}

function findWhitespaceBoundary(
  text: string,
  start: number,
  limit: number,
  minimumOffset: number,
): number | null {
  for (let index = limit - 1; index >= start + minimumOffset; index -= 1) {
    if (/\s/.test(text[index])) {
      return index + 1;
    }
  }
  return null;
}

@Injectable()
export class ChunkingService {
  chunk(text: string): string[] {
    return chunkPageText(text);
  }
}
