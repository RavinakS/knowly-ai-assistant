import 'dotenv/config';
import { hash } from 'bcryptjs';
import { DocumentStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const demoPassword = 'Knowly-Demo-2026!';

const demoOrganizations = [
  {
    id: '90000000-0000-4000-8000-000000000001',
    name: 'Knowly Demo - Northstar Consulting',
    email: 'demo@northstar.example',
    userName: 'Northstar Demo User',
    documentId: '91000000-0000-4000-8000-000000000001',
    filename: 'Northstar_Employee_Handbook.pdf',
    pages: [
      {
        pageNumber: 1,
        text: 'Employees receive 20 days of annual leave. Submit leave requests at least 5 business days in advance through the employee portal.',
      },
      {
        pageNumber: 2,
        text: 'Remote employees may claim up to $800 per calendar year for approved home-office equipment. Expense claims require an itemized receipt and must be submitted within 30 days.',
      },
    ],
  },
  {
    id: '90000000-0000-4000-8000-000000000002',
    name: 'Knowly Demo - Apex University',
    email: 'demo@apex.example',
    userName: 'Apex Demo User',
    documentId: '91000000-0000-4000-8000-000000000002',
    filename: 'Apex_Scholarship_Guide.pdf',
    pages: [
      {
        pageNumber: 1,
        text: 'Merit scholarship applicants must be full-time undergraduate students in years 2 through 4 and maintain a cumulative GPA of at least 3.75.',
      },
      {
        pageNumber: 2,
        text: 'Submit scholarship applications through the student portal by March 15. Required documents are an official transcript and a completed financial aid form. The award covers 50 percent of annual tuition.',
      },
    ],
  },
] as const;

async function seedDemoData(): Promise<void> {
  const passwordHash = await hash(demoPassword, 12);

  for (const demo of demoOrganizations) {
    await prisma.organization.upsert({
      where: { id: demo.id },
      create: { id: demo.id, name: demo.name },
      update: { name: demo.name },
    });
    await prisma.user.upsert({
      where: { email: demo.email },
      create: {
        email: demo.email,
        name: demo.userName,
        passwordHash,
        organizationId: demo.id,
      },
      update: {
        name: demo.userName,
        passwordHash,
        organizationId: demo.id,
      },
    });
    await prisma.assistant.upsert({
      where: { organizationId: demo.id },
      create: { organizationId: demo.id },
      update: { isActive: true },
    });

    await prisma.document.upsert({
      where: { id: demo.documentId },
      create: {
        id: demo.documentId,
        organizationId: demo.id,
        filename: `${demo.id}/${demo.documentId}.pdf`,
        originalFilename: demo.filename,
        fileSize: 1,
        pageCount: demo.pages.length,
        mimeType: 'application/pdf',
        status: DocumentStatus.READY,
      },
      update: {
        organizationId: demo.id,
        originalFilename: demo.filename,
        pageCount: demo.pages.length,
        status: DocumentStatus.READY,
      },
    });
    await prisma.$transaction(async (transaction) => {
      await transaction.documentChunk.deleteMany({
        where: { documentId: demo.documentId, organizationId: demo.id },
      });
      await transaction.documentPage.deleteMany({
        where: { documentId: demo.documentId, organizationId: demo.id },
      });
      await transaction.documentPage.createMany({
        data: demo.pages.map((page) => ({
          documentId: demo.documentId,
          organizationId: demo.id,
          pageNumber: page.pageNumber,
          text: page.text,
        })),
      });
      await transaction.documentChunk.createMany({
        data: demo.pages.map((page) => ({
          documentId: demo.documentId,
          organizationId: demo.id,
          pageNumber: page.pageNumber,
          chunkIndex: 0,
          content: page.text,
        })),
      });
    });
  }

  console.log('Knowly demo organizations, accounts, assistants, documents, and chunks are ready.');
  console.log('Northstar: demo@northstar.example / Knowly-Demo-2026!');
  console.log('Apex University: demo@apex.example / Knowly-Demo-2026!');
}

seedDemoData()
  .catch((error: unknown) => {
    console.error('Unable to seed Knowly demo data.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
