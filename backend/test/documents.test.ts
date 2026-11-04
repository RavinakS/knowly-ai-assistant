import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const originalUploadDir = process.env.UPLOAD_DIR;

let app: INestApplication;
let prisma: import("@prisma/client").PrismaClient;
let uploadDir: string;
let baseUrl: string;
let organizationAId: string;
let organizationBId: string;
let userACookie: string;
let userBCookie: string;

interface TestDocument {
  id: string;
  organizationId: string;
  filePath: string;
}

before(async () => {
  uploadDir = await mkdtemp(join(tmpdir(), "knowly-documents-test"));
  process.env.UPLOAD_DIR = uploadDir;

  const { NestFactory } = await import("@nestjs/core");
  const { AppModule } = await import("../dist/app.module.js");
  const { PrismaService } = await import("../dist/prisma/prisma.service.js");
  const { JwtService } = await import("@nestjs/jwt");

  app = await NestFactory.create(AppModule, { logger: false });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(0, "127.0.0.1");

  const address = app.getHttpServer().address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;

  prisma = app.get(PrismaService);

  const suffix = `${Date.now()}-${randomUUID()}`;

  const organizationA = await prisma.organization.create({
    data: { name: `Document Delete Test A ${suffix}` },
  });

  const organizationB = await prisma.organization.create({
    data: { name: `Document Delete Test B ${suffix}` },
  });

  organizationAId = organizationA.id;
  organizationBId = organizationB.id;

  const userA = await prisma.user.create({
    data: {
      name: "Document Test User A",
      email: `document-test-a-${suffix}@example.test`,
      passwordHash: "test-only",
      organizationId: organizationAId,
    },
  });

  const userB = await prisma.user.create({
    data: {
      name: "Document Test User B",
      email: `document-test-b-${suffix}@example.test`,
      passwordHash: "test-only",
      organizationId: organizationBId,
    },
  });

  const jwt = app.get(JwtService);
  userACookie = `knowly_session=${await jwt.signAsync({ sub: userA.id })}`;
  userBCookie = `knowly_session=${await jwt.signAsync({ sub: userB.id })}`;
});

after(async () => {
  if (prisma && organizationAId && organizationBId) {
    await prisma.organization.deleteMany({
      where: { id: { in: [organizationAId, organizationBId] } },
    });
  }

  if (app) {
    await app.close();
  }

  if (uploadDir) {
    await rm(uploadDir, { recursive: true, force: true });
  }

  if (originalUploadDir === undefined) {
    delete process.env.UPLOAD_DIR;
  } else {
    process.env.UPLOAD_DIR = originalUploadDir;
  }
});

async function createDocument(
  organizationId: string,
  status: "PROCESSING" | "READY" | "FAILED" = "READY",
): Promise<TestDocument> {
  const id = randomUUID();
  const filename = `${organizationId}/${id}.pdf`;
  const filePath = join(uploadDir, organizationId, `${id}.pdf`);

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, "%PDF-test-placeholder");

  await prisma.document.create({
    data: {
      id,
      organizationId,
      filename,
      originalFilename: `test-${id}.pdf`,
      fileSize: 20,
      pageCount: status === "READY" ? 1 : null,
      mimeType: "application/pdf",
      status,
    },
  });

  if (status === "READY") {
    await prisma.documentPage.create({
      data: {
        documentId: id,
        organizationId,
        pageNumber: 1,
        text: "Test Page content.",
      },
    });

    await prisma.documentChunk.create({
      data: {
        documentId: id,
        organizationId,
        pageNumber: 1,
        chunkIndex: 0,
        content: "Test chunk content.",
      },
    });
  }
  return { id, organizationId, filePath };
}

async function deleteDocument(id: string, cookie?: string): Promise<Response> {
  const headers = cookie ? { cookie } : undefined;

  return fetch(`${baseUrl}/documents/${id}`, { method: "DELETE", headers });
}

async function uploadDocument(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<Response> {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: contentType }), filename);

  return fetch(`${baseUrl}/documents`, {
    method: "POST",
    headers: { cookie: userACookie },
    body: form,
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

test("DELETE /documents/:id is authenticated and organization-scoped", async (t) => {
  await t.test("rejects requests without authentication", async () => {
    const document = await createDocument(organizationAId);
    const response = await deleteDocument(document.id);

    assert.equal(response.status, 401);
    assert.equal(
      await prisma.document.count({ where: { id: document.id } }),
      1,
    );
    assert.equal(await fileExists(document.filePath), true);
  });

  await t.test("rejects malformed document IDs", async () => {
    const response = await deleteDocument("not-a-uuid", userACookie);

    assert.equal(response.status, 400);
  });

  await t.test("returns 404 for an unknown document", async () => {
    const response = await deleteDocument(randomUUID(), userACookie);

    assert.equal(response.status, 404);
  });

  await t.test(
    "does not let one organization delete another organization's document",
    async () => {
      const document = await createDocument(organizationBId);

      const response = await deleteDocument(document.id, userACookie);

      assert.equal(response.status, 404);
      assert.equal(
        await prisma.document.count({ where: { id: document.id } }),
        1,
      );
      assert.equal(
        await prisma.documentPage.count({
          where: { documentId: document.id },
        }),
        1,
      );
      assert.equal(
        await prisma.documentChunk.count({
          where: { documentId: document.id },
        }),
        1,
      );
      assert.equal(await fileExists(document.filePath), true);
    },
  );

  await t.test(
    "deletes an owned document, its pages, chunks, and stored PDF",
    async () => {
      const document = await createDocument(organizationAId);
      const response = await deleteDocument(document.id, userACookie);

      assert.equal(response.status, 204);
      assert.equal(
        await prisma.document.count({ where: { id: document.id } }),
        0,
      );
      assert.equal(
        await prisma.documentPage.count({
          where: { documentId: document.id },
        }),
        0,
      );
      assert.equal(
        await prisma.documentChunk.count({
          where: { documentId: document.id },
        }),
        0,
      );
      assert.equal(await fileExists(document.filePath), false);
    },
  );

  await t.test(
    "rejects deletion while the document is processing",
    async () => {
      const document = await createDocument(organizationAId, "PROCESSING");

      const response = await deleteDocument(document.id, userACookie);

      assert.equal(response.status, 409);
      assert.equal(
        await prisma.document.count({ where: { id: document.id } }),
        1,
      );
      assert.equal(await fileExists(document.filePath), true);
    },
  );

  await t.test(
    "returns a safe error if staging the stored file fails",
    async () => {
      const document = await createDocument(organizationAId);
      const { LocalUploadStorage } =
        await import("../dist/documents/local-upload-storage.js");
      const storage = app.get(LocalUploadStorage);
      const originalStage = storage.stageDocumentFile.bind(storage);

      storage.stageDocumentFile = async () => {
        throw new Error(`Test failure at ${document.filePath}`);
      };

      try {
        const response = await deleteDocument(document.id, userACookie);
        const responseText = await response.text();

        assert.equal(response.status, 500);
        assert.equal(responseText.includes(document.filePath), false);
        assert.equal(
          await prisma.document.count({ where: { id: document.id } }),
          1,
        );
        assert.equal(await fileExists(document.filePath), true);
      } finally {
        storage.stageDocumentFile = originalStage;
      }
    },
  );

  await t.test(
    "restores the original PDF when the database deletion fails",
    async () => {
      const document = await createDocument(organizationAId);
      const originalDelete = prisma.document.delete.bind(prisma.document);
      prisma.document.delete = (async () => {
        throw new Error("Simulated database delete failure");
      }) as typeof prisma.document.delete;

      try {
        const response = await deleteDocument(document.id, userACookie);
        const responseText = await response.text();

        assert.equal(response.status, 500);
        assert.equal(responseText.includes("Simulated database"), false);
        assert.equal(
          await prisma.document.count({ where: { id: document.id } }),
          1,
        );
        assert.equal(
          await prisma.documentPage.count({
            where: { documentId: document.id },
          }),
          1,
        );
        assert.equal(
          await prisma.documentChunk.count({
            where: { documentId: document.id },
          }),
          1,
        );
        assert.equal(await fileExists(document.filePath), true);
      } finally {
        prisma.document.delete = originalDelete;
      }
    },
  );

  await t.test(
    "does not let a client-supplied organization ID switch tenants",
    async () => {
      const document = await createDocument(organizationBId);

      const response = await fetch(`${baseUrl}/documents/${document.id}`, {
        method: "DELETE",
        headers: {
          cookie: userACookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ organizationId: organizationBId }),
      });

      assert.equal(response.status, 404);
      assert.equal(
        await prisma.document.count({ where: { id: document.id } }),
        1,
      );
      assert.equal(await fileExists(document.filePath), true);
    },
  );
});

test("POST /documents validates uploads and reports processing failures", async (t) => {
  await t.test("rejects an empty upload without creating a document", async () => {
    const before = await prisma.document.count({
      where: { organizationId: organizationAId },
    });
    const response = await uploadDocument(Buffer.alloc(0), "empty.pdf", "application/pdf");

    assert.equal(response.status, 400);
    assert.equal(
      await prisma.document.count({
        where: { organizationId: organizationAId },
      }),
      before,
    );
  });

  await t.test("rejects unsupported file types", async () => {
    const before = await prisma.document.count({
      where: { organizationId: organizationAId },
    });
    const response = await uploadDocument(
      Buffer.from("not a PDF"),
      "notes.txt",
      "text/plain",
    );

    assert.equal(response.status, 415);
    assert.equal(
      await prisma.document.count({
        where: { organizationId: organizationAId },
      }),
      before,
    );
  });

  await t.test("rejects a PDF MIME type with an invalid PDF signature", async () => {
    const before = await prisma.document.count({
      where: { organizationId: organizationAId },
    });
    const response = await uploadDocument(
      Buffer.from("not actually a PDF"),
      "spoofed.pdf",
      "application/pdf",
    );

    assert.equal(response.status, 415);
    assert.equal(
      await prisma.document.count({
        where: { organizationId: organizationAId },
      }),
      before,
    );
  });

  await t.test("rejects files larger than 10 MB", async () => {
    const before = await prisma.document.count({
      where: { organizationId: organizationAId },
    });
    const response = await uploadDocument(
      Buffer.alloc(10 * 1024 * 1024 + 1, 0x41),
      "oversized.pdf",
      "application/pdf",
    );

    assert.equal(response.status, 413);
    assert.equal(
      await prisma.document.count({
        where: { organizationId: organizationAId },
      }),
      before,
    );
  });

  await t.test("marks extraction failures as FAILED without partial knowledge", async () => {
    const { PdfTextExtractorService } = await import(
      "../dist/documents/pdf-text-extractor.service.js"
    );
    const extractor = app.get(PdfTextExtractorService);
    const originalExtract = extractor.extract.bind(extractor);
    extractor.extract = async () => {
      throw new Error("Simulated PDF extraction failure");
    };

    try {
      const response = await uploadDocument(
        Buffer.from("%PDF-1.4\nminimal test fixture"),
        "extraction-fails.pdf",
        "application/pdf",
      );
      assert.equal(response.status, 201);
      const uploaded = (await response.json()) as {
        id: string;
        status: string;
      };
      assert.equal(uploaded.status, "FAILED");

      const record = await prisma.document.findUnique({
        where: { id: uploaded.id },
        select: { organizationId: true, filename: true, status: true },
      });
      assert.ok(record);
      assert.equal(record.status, "FAILED");
      assert.equal(record.organizationId, organizationAId);
      assert.equal(
        await prisma.documentPage.count({
          where: { documentId: uploaded.id },
        }),
        0,
      );
      assert.equal(
        await prisma.documentChunk.count({
          where: { documentId: uploaded.id },
        }),
        0,
      );

      const [storedOrganizationId, storedFilename] = record.filename.split("/");
      assert.equal(storedOrganizationId, organizationAId);
      assert.equal(
        await fileExists(join(uploadDir, storedOrganizationId, storedFilename)),
        true,
      );
    } finally {
      extractor.extract = originalExtract;
    }
  });
});
