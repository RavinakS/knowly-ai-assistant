CREATE TABLE "DocumentPage" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentPage_documentId_pageNumber_key"
ON "DocumentPage"("documentId", "pageNumber");

CREATE INDEX "DocumentPage_documentId_idx"
ON "DocumentPage"("documentId");

CREATE INDEX "DocumentPage_organizationId_idx"
ON "DocumentPage"("organizationId");

ALTER TABLE "DocumentPage"
ADD CONSTRAINT "DocumentPage_documentId_organizationId_fkey"
FOREIGN KEY ("documentId", "organizationId")
REFERENCES "Document"("id", "organizationId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentPage"
ADD CONSTRAINT "DocumentPage_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
