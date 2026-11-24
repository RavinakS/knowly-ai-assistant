import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

test("Supabase document storage supports upload, read, and deletion recovery", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalSecretKey = process.env.SUPABASE_SECRET_KEY;
  const originalBucket = process.env.SUPABASE_STORAGE_BUCKET;
  const organizationId = randomUUID();
  const storedObjects = new Map<string, Buffer>();
  const requests: { method: string; path: string }[] = [];
  const bucketName = "knowly-documents";
  const bucketPrefix = `/storage/v1/object/${bucketName}/`;

  process.env.SUPABASE_URL = "https://storage-test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-secret-key";
  process.env.SUPABASE_STORAGE_BUCKET = bucketName;

  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? new URL(input)
        : input instanceof URL
          ? input
          : new URL(input.url);
    const method = init?.method ?? "GET";
    requests.push({ method, path: url.pathname });

    if (method === "POST" && url.pathname === "/storage/v1/object/move") {
      const move = JSON.parse(String(init?.body)) as {
        sourceKey: string;
        destinationKey: string;
      };
      const object = storedObjects.get(move.sourceKey);
      if (!object) {
        return new Response(
          JSON.stringify({
            statusCode: "404",
            error: "Not Found",
            message: "Object not found",
          }),
          { status: 404, headers: { "content-type": "application/json" } },
        );
      }

      storedObjects.delete(move.sourceKey);
      storedObjects.set(move.destinationKey, object);
      return new Response(JSON.stringify({ message: "success" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (method === "POST" && url.pathname.startsWith(bucketPrefix)) {
      const key = decodeURIComponent(url.pathname.slice(bucketPrefix.length));
      storedObjects.set(key, Buffer.from(init?.body as Uint8Array));
      return new Response(
        JSON.stringify({ Key: `${bucketName}/${key}`, Id: randomUUID() }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (method === "GET" && url.pathname.startsWith(bucketPrefix)) {
      const key = decodeURIComponent(url.pathname.slice(bucketPrefix.length));
      const object = storedObjects.get(key);
      if (!object) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(object, {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    }

    if (method === "DELETE") {
      const body = JSON.parse(String(init?.body)) as { prefixes: string[] };
      for (const key of body.prefixes) {
        storedObjects.delete(key);
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response("Unexpected test request", { status: 500 });
  };

  try {
    const { SupabaseDocumentStorage } =
      await import("../dist/documents/storage/supabase-document-storage.js");
    const storage = new SupabaseDocumentStorage();
    const pdf = Buffer.from("%PDF-test-storage");
    const stored = await storage.store(organizationId, pdf);

    assert.equal(stored.storageKey, `${organizationId}/${stored.id}.pdf`);
    assert.deepEqual(await storage.read(organizationId, stored.storageKey), pdf);

    const staged = await storage.stageForDeletion(
      organizationId,
      stored.storageKey,
    );
    assert.ok(staged);
    assert.equal(storedObjects.has(stored.storageKey), false);
    assert.equal(storedObjects.has(staged.stagedKey), true);

    await storage.restoreStagedFile(staged);
    assert.equal(storedObjects.has(stored.storageKey), true);
    assert.equal(storedObjects.has(staged.stagedKey), false);

    assert.equal(
      await storage.stageForDeletion(
        organizationId,
        `${organizationId}/${randomUUID()}.pdf`,
      ),
      null,
    );

    const stagedAgain = await storage.stageForDeletion(
      organizationId,
      stored.storageKey,
    );
    assert.ok(stagedAgain);
    await storage.removeStagedFile(stagedAgain);
    assert.equal(storedObjects.has(stagedAgain.stagedKey), false);

    assert.ok(requests.some((request) => request.method === "GET"));
    await assert.rejects(
      storage.read(randomUUID(), stored.storageKey),
      /Invalid stored document key/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalUrl;
    }
    if (originalSecretKey === undefined) {
      delete process.env.SUPABASE_SECRET_KEY;
    } else {
      process.env.SUPABASE_SECRET_KEY = originalSecretKey;
    }
    if (originalBucket === undefined) {
      delete process.env.SUPABASE_STORAGE_BUCKET;
    } else {
      process.env.SUPABASE_STORAGE_BUCKET = originalBucket;
    }
  }
});
