import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.LLM_API_KEY;
const llmContexts: string[] = [];
let answerCalls = 0;
let providerMode: 'normal' | 'invalid-json' = 'normal';
let app: import('@nestjs/core').INestApplication;
let prisma: import('@prisma/client').PrismaClient;
let baseUrl: string;
let organizationAId: string;
let organizationBId: string;
let userACookie: string;
let userBCookie: string;
let assistantAToken: string;
let assistantBToken: string;
let documentAId: string;
let documentBId: string;

before(async () => {
  process.env.LLM_API_KEY = 'test-key-not-a-real-secret';
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith('https://api.openai.com/')) {
      return originalFetch(input, init);
    }
    const request = JSON.parse(String(init?.body)) as {
      messages: { role: string; content: string }[];
    };
    const system = request.messages.find((message) => message.role === 'system')?.content ?? '';
    const userMessage = request.messages.find((message) => message.role === 'user')?.content ?? '';

    if (system.includes('question-understanding component')) {
      if (providerMode === 'invalid-json') {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: 'not json' } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      const clarification = userMessage === 'please clarify';
      const irrelevant = userMessage === 'weather in London';
      const understood = {
        intent: clarification || irrelevant ? 'unknown' : 'eligibility_question',
        normalizedQuestion: clarification
          ? 'Please clarify this question'
          : irrelevant
            ? 'What is the weather in London?'
            : userMessage,
        requiresKnowledgeBase: true,
        keywords: clarification
          ? []
          : irrelevant
            ? ['weather', 'London']
            : ['scholarship', 'GPA'],
      };
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(understood) } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    answerCalls += 1;
    const supplied = JSON.parse(userMessage) as {
      question: string;
      context: { documentName: string; content: string }[];
    };
    llmContexts.push(JSON.stringify(supplied.context));
    const onlyA = supplied.context.every((item) =>
      item.documentName.includes('Organization_A'),
    );
    const onlyB = supplied.context.every((item) =>
      item.documentName.includes('Organization_B'),
    );
    const answer =
      onlyA && supplied.context.length > 0
        ? 'Answer based on Organization A.'
        : onlyB && supplied.context.length > 0
          ? 'Answer based on Organization B.'
          : 'Unexpected mixed-tenant context.';
    return new Response(
      JSON.stringify({ choices: [{ message: { content: answer } }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../dist/app.module.js');
  const { PrismaService } = await import('../dist/prisma/prisma.service.js');
  const { JwtService } = await import('@nestjs/jwt');
  app = await NestFactory.create(AppModule, { logger: false });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;

  prisma = app.get(PrismaService);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const organizationA = await prisma.organization.create({
    data: { name: `Isolation Test A ${suffix}` },
  });
  const organizationB = await prisma.organization.create({
    data: { name: `Isolation Test B ${suffix}` },
  });
  organizationAId = organizationA.id;
  organizationBId = organizationB.id;

  const userA = await prisma.user.create({
    data: {
      name: 'Test User A',
      email: `isolation-a-${suffix}@example.test`,
      passwordHash: 'test-only',
      organizationId: organizationAId,
    },
  });
  const userB = await prisma.user.create({
    data: {
      name: 'Test User B',
      email: `isolation-b-${suffix}@example.test`,
      passwordHash: 'test-only',
      organizationId: organizationBId,
    },
  });
  const jwt = app.get(JwtService);
  userACookie = `knowly_session=${await jwt.signAsync({ sub: userA.id })}`;
  userBCookie = `knowly_session=${await jwt.signAsync({ sub: userB.id })}`;

  const assistantA = await prisma.assistant.create({
    data: { organizationId: organizationAId },
  });
  const assistantB = await prisma.assistant.create({
    data: { organizationId: organizationBId },
  });
  assistantAToken = assistantA.token;
  assistantBToken = assistantB.token;

  const documentA = await prisma.document.create({
    data: {
      organizationId: organizationAId,
      filename: `${organizationAId}/test-a.pdf`,
      originalFilename: 'Organization_A_Scholarship.pdf',
      fileSize: 100,
      pageCount: 1,
      mimeType: 'application/pdf',
      status: 'READY',
    },
  });
  const documentB = await prisma.document.create({
    data: {
      organizationId: organizationBId,
      filename: `${organizationBId}/test-b.pdf`,
      originalFilename: 'Organization_B_Scholarship.pdf',
      fileSize: 100,
      pageCount: 1,
      mimeType: 'application/pdf',
      status: 'READY',
    },
  });
  documentAId = documentA.id;
  documentBId = documentB.id;
  await prisma.documentPage.createMany({
    data: [
      {
        documentId: documentAId,
        organizationId: organizationAId,
        pageNumber: 1,
        text: 'Organization A scholarship GPA requirement is 3.75.',
      },
      {
        documentId: documentBId,
        organizationId: organizationBId,
        pageNumber: 1,
        text: 'Organization B scholarship GPA requirement is 2.50.',
      },
    ],
  });
  await prisma.documentChunk.createMany({
    data: [
      {
        documentId: documentAId,
        organizationId: organizationAId,
        pageNumber: 1,
        chunkIndex: 0,
        content: 'Organization A scholarship eligibility requires GPA 3.75.',
      },
      {
        documentId: documentBId,
        organizationId: organizationBId,
        pageNumber: 1,
        chunkIndex: 0,
        content: 'Organization B scholarship eligibility requires GPA 2.50.',
      },
    ],
  });
});

after(async () => {
  if (organizationAId && organizationBId) {
    await prisma.organization.deleteMany({
      where: { id: { in: [organizationAId, organizationBId] } },
    });
  }
  if (app) {
    await app.close();
  }
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) {
    delete process.env.LLM_API_KEY;
  } else {
    process.env.LLM_API_KEY = originalApiKey;
  }
});

test('authenticated and public APIs remain tenant-isolated', async (t) => {
  await t.test('search derives tenant from JWT and rejects tenant overrides', async () => {
    const response = await fetch(`${baseUrl}/documents/search`, {
      method: 'POST',
      headers: {
        cookie: userACookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        question: 'scholarship GPA',
        organizationId: organizationBId,
      }),
    });
    assert.equal(response.status, 400);

    const search = await fetch(`${baseUrl}/documents/search`, {
      method: 'POST',
      headers: {
        cookie: userACookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: 'scholarship GPA' }),
    });
    assert.equal(search.status, 201);
    const payload = (await search.json()) as {
      results: { documentId: string }[];
    };
    assert.deepEqual(payload.results.map((result) => result.documentId), [
      documentAId,
    ]);
  });

  await t.test('authenticated user cannot inspect another tenant document', async () => {
    const response = await fetch(
      `${baseUrl}/documents/${documentBId}/pages`,
      { headers: { cookie: userACookie } },
    );
    assert.equal(response.status, 404);
  });

  await t.test('decision and authenticated answer only use the JWT tenant', async () => {
    const decide = await fetch(`${baseUrl}/documents/decide`, {
      method: 'POST',
      headers: {
        cookie: userACookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: 'scholarship GPA' }),
    });
    assert.equal(decide.status, 201);
    const decision = (await decide.json()) as {
      retrieval: { results: { documentId: string }[] };
    };
    assert.deepEqual(
      decision.retrieval.results.map((result) => result.documentId),
      [documentAId],
    );

    const answer = await fetch(`${baseUrl}/documents/answer`, {
      method: 'POST',
      headers: {
        cookie: userACookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: 'scholarship GPA' }),
    });
    assert.equal(answer.status, 201);
    const answerBody = (await answer.json()) as {
      answer: string;
      sources: { documentName: string; pageNumber: number }[];
    };
    assert.equal(answerBody.answer, 'Answer based on Organization A.');
    assert.deepEqual(answerBody.sources, [
      { documentName: 'Organization_A_Scholarship.pdf', pageNumber: 1 },
    ]);
    assert.ok(
      llmContexts.every(
        (context) =>
          context.includes('Organization_A_Scholarship.pdf') &&
          !context.includes('Organization_B_Scholarship.pdf'),
      ),
    );
  });

  await t.test('each public assistant is resolved from its persisted organization', async () => {
    const answerA = await fetch(
      `${baseUrl}/public/assistants/${assistantAToken}/answer`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: 'scholarship GPA',
          organizationId: organizationBId,
        }),
      },
    );
    assert.equal(answerA.status, 400);

    const publicA = await fetch(
      `${baseUrl}/public/assistants/${assistantAToken}/answer`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: 'scholarship GPA' }),
      },
    );
    assert.equal(publicA.status, 201);
    const publicABody = (await publicA.json()) as {
      answer: string;
      sources: { documentName: string; pageNumber: number }[];
      organizationId?: string;
    };
    assert.equal(publicABody.answer, 'Answer based on Organization A.');
    assert.deepEqual(publicABody.sources, [
      { documentName: 'Organization_A_Scholarship.pdf', pageNumber: 1 },
    ]);
    assert.equal('organizationId' in publicABody, false);

    const publicB = await fetch(
      `${baseUrl}/public/assistants/${assistantBToken}/answer`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: 'scholarship GPA' }),
      },
    );
    assert.equal(publicB.status, 201);
    const publicBBody = (await publicB.json()) as {
      answer: string;
      sources: { documentName: string; pageNumber: number }[];
    };
    assert.equal(publicBBody.answer, 'Answer based on Organization B.');
    assert.deepEqual(publicBBody.sources, [
      { documentName: 'Organization_B_Scholarship.pdf', pageNumber: 1 },
    ]);
  });

  await t.test('public no-knowledge and clarification do not call answer generation', async () => {
    const before = answerCalls;
    const noKnowledge = await fetch(
      `${baseUrl}/public/assistants/${assistantAToken}/answer`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: 'weather in London' }),
      },
    );
    const noKnowledgeBody = await noKnowledge.json();
    assert.equal(noKnowledge.status, 201, JSON.stringify(noKnowledgeBody));
    assert.equal(noKnowledgeBody.decision, 'NO_RELEVANT_KNOWLEDGE');

    const clarification = await fetch(
      `${baseUrl}/public/assistants/${assistantAToken}/answer`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: 'please clarify' }),
      },
    );
    assert.equal(clarification.status, 201);
    assert.equal(
      (await clarification.json()).decision,
      'CLARIFICATION_REQUIRED',
    );
    assert.equal(answerCalls, before);
  });

  await t.test('invalid requests, public IDs, and protected endpoints fail safely', async () => {
    const unauthenticated = await fetch(`${baseUrl}/documents/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'scholarship GPA' }),
    });
    assert.equal(unauthenticated.status, 401);

    for (const question of ['', '   ', 'x'.repeat(1001)]) {
      const invalid = await fetch(
        `${baseUrl}/public/assistants/${assistantAToken}/answer`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question }),
        },
      );
      assert.equal(invalid.status, 400);
    }

    const malformed = await fetch(
      `${baseUrl}/public/assistants/${assistantAToken}/answer`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      },
    );
    assert.equal(malformed.status, 400);

    const unknown = await fetch(
      `${baseUrl}/public/assistants/not-a-persisted-assistant`,
    );
    assert.equal(unknown.status, 404);

    await prisma.assistant.update({
      where: { token: assistantAToken },
      data: { isActive: false },
    });
    const inactive = await fetch(
      `${baseUrl}/public/assistants/${assistantAToken}/answer`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: 'scholarship GPA' }),
      },
    );
    assert.equal(inactive.status, 404);
  });

  await t.test('provider errors are sanitized and invalid LLM JSON is rejected', async () => {
    providerMode = 'invalid-json';
    const invalidLlm = await fetch(`${baseUrl}/documents/understand-question`, {
      method: 'POST',
      headers: {
        cookie: userACookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: 'scholarship GPA' }),
    });
    assert.equal(invalidLlm.status, 502);
    const body = await invalidLlm.text();
    assert.equal(body.includes('test-key-not-a-real-secret'), false);

    providerMode = 'normal';
    process.env.LLM_API_KEY = '';
    const missingKey = await fetch(`${baseUrl}/documents/understand-question`, {
      method: 'POST',
      headers: {
        cookie: userACookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: 'scholarship GPA' }),
    });
    assert.equal(missingKey.status, 503);
    process.env.LLM_API_KEY = 'test-key-not-a-real-secret';
  });
});
