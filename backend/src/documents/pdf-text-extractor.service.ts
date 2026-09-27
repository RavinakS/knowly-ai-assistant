import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedPdf {
  pageCount: number;
  pages: ExtractedPage[];
}

@Injectable()
export class PdfTextExtractorService {
  async extract(filePath: string): Promise<ExtractedPdf> {
    const buffer = await readFile(filePath);
    const parser = new PDFParse({
      data: buffer,
      stopAtErrors: true,
      isEvalSupported: false,
    });

    try {
      const result = await parser.getText({ pageJoiner: '' });
      if (
        !Number.isInteger(result.total) ||
        result.total < 1 ||
        result.pages.length !== result.total
      ) {
        throw new Error('PDF parser returned an incomplete page result.');
      }

      return {
        pageCount: result.total,
        pages: result.pages.map((page, index) => ({
          pageNumber: page.num || index + 1,
          text: page.text.replace(/\r\n?/g, '\n').replace(/\0/g, '').trim(),
        })),
      };
    } finally {
      await parser.destroy();
    }
  }
}
