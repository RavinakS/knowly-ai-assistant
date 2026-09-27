DROP INDEX "DocumentChunk_documentId_chunkIndex_key";

CREATE UNIQUE INDEX "DocumentChunk_documentId_pageNumber_chunkIndex_key"
ON "DocumentChunk"("documentId", "pageNumber", "chunkIndex");

CREATE INDEX "DocumentChunk_documentId_pageNumber_idx"
ON "DocumentChunk"("documentId", "pageNumber");

CREATE INDEX "DocumentChunk_documentId_pageNumber_chunkIndex_idx"
ON "DocumentChunk"("documentId", "pageNumber", "chunkIndex");
