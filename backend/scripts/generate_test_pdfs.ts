import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";

interface PDFPageContent {
  title: string;
  sections: { heading: string; body: string }[];
}

function createPDF(filePath: string, pages: PDFPageContent[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(filePath);

    doc.pipe(writeStream);

    pages.forEach((page, index) => {
      if (index > 0) {
        doc.addPage();
      }

      // Title in Bold
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .text(page.title, { align: "left" });
      doc.moveDown(1);

      // Sections
      page.sections.forEach((section) => {
        doc.font("Helvetica-Bold").fontSize(12).text(section.heading);
        doc.moveDown(0.3);
        doc
          .font("Helvetica")
          .fontSize(10)
          .text(section.body, { align: "justify" });
        doc.moveDown(1);
      });

      // Page Footer
      doc
        .font("Helvetica")
        .fontSize(9)
        .text(`Page ${index + 1}`, 50, 720, { align: "right" });
    });

    doc.end();

    writeStream.on("finish", () => resolve());
    writeStream.on("error", (err) => reject(err));
  });
}

/**
 * Generates a PDF file larger than 10MB by appending raw binary buffers.
 */
function createLargePDF(
  filePath: string,
  targetSizeMB: number = 10.5,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(filePath);

    doc.pipe(writeStream);

    doc.font("Helvetica-Bold").fontSize(16).text("Large Document Test (>10MB)");
    doc.moveDown(0.5);
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(
        "This document is explicitly generated to test file size validation error handling.",
      );

    // Append raw padding data directly to the stream after standard document rendering completes
    doc.end();

    writeStream.on("finish", () => {
      // Append extra byte buffer to push total file size above 10MB
      const currentSize = fs.statSync(filePath).size;
      const targetSizeBytes = Math.ceil(targetSizeMB * 1024 * 1024);
      const neededBytes = targetSizeBytes - currentSize;

      if (neededBytes > 0) {
        const paddingBuffer = Buffer.alloc(neededBytes, "0");
        fs.appendFileSync(filePath, paddingBuffer);
      }
      resolve();
    });

    writeStream.on("error", (err) => reject(err));
  });
}

/**
 * Creates an empty 0-byte file to test invalid/empty file uploads.
 */
function createEmptyFile(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, Buffer.alloc(0));
}

async function generateAllPDFs() {
  const baseDir = path.join(process.cwd(), "test_pdfs");

  // --- Apex University Documents ---
  await createPDF(
    path.join(baseDir, "apex_university", "Student_Handbook_2026.pdf"),
    [
      {
        title: "Apex University - Student Handbook 2026",
        sections: [
          {
            heading: "Section 1: Class Attendance Policy",
            body: "Students must maintain a minimum of 75% attendance in all registered courses to be eligible to sit for end-semester examinations. Absence due to medical emergencies requires an official medical certificate submitted within 3 working days of returning to class.",
          },
        ],
      },
      {
        title: "Apex University - Academic Integrity Policy",
        sections: [
          {
            heading: "Section 2: Plagiarism Penalties",
            body: "First-offense plagiarism in any assignment results in an immediate score of zero for that assignment. Second-offense plagiarism results in an automatic course failure and referral to the Academic Disciplinary Board.",
          },
        ],
      },
    ],
  );

  await createPDF(
    path.join(baseDir, "apex_university", "Scholarship_and_Aid_Rules.pdf"),
    [
      {
        title: "Apex University - Merit Scholarship Policy",
        sections: [
          {
            heading: "Section 1: Eligibility Requirements",
            body: "To qualify for the Merit Scholarship, a student must meet all of the following conditions:\n1. Enrollment Status: Must be a full-time undergraduate student in Year 2, Year 3, or Year 4. First-year students are ineligible.\n2. Academic Standing: Must possess a Cumulative GPA (CGPA) of 3.75 out of 4.0 or higher.\n3. Exclusivity: Must not hold any other active institutional, athletic, or sports scholarship simultaneously.\n\nAward Details: Grants a 50% waiver on tuition fees for the academic year.",
          },
        ],
      },
      {
        title: "Apex University - Financial Assistance Policy",
        sections: [
          {
            heading: "Section 2: Need-Based Assistance",
            body: "Need-based grants are available for students with a verified annual family income below $45,000. Requires submission of previous year tax returns and income affidavits.",
          },
        ],
      },
    ],
  );

  await createPDF(
    path.join(baseDir, "apex_university", "Course_Registration_Procedure.pdf"),
    [
      {
        title: "Apex University - Registration Procedures",
        sections: [
          {
            heading: "Section 1: Add/Drop & Course Withdrawal",
            body: 'Students may add or drop courses during the first 2 weeks of the semester via the student portal without academic penalty. Course withdrawals requested between Week 3 and Week 8 result in a "W" grade recorded on the academic transcript.',
          },
        ],
      },
      {
        title: "Apex University - Academic Load Regulations",
        sections: [
          {
            heading: "Section 2: Credit Overloads",
            body: "Standard full-time credit load is 12 to 18 credits per semester. Overload requests exceeding 18 credits require a minimum CGPA of 3.50 and formal written approval from the Department Chair.",
          },
        ],
      },
    ],
  );

  // --- NexaCorp Solutions Documents ---
  await createPDF(
    path.join(baseDir, "nexacorp_solutions", "Employee_Benefits_Policy.pdf"),
    [
      {
        title: "NexaCorp Solutions - Employee Benefits Policy",
        sections: [
          {
            heading: "Section 1: Health Insurance & Wellness",
            body: "Full-time employees are eligible for comprehensive medical coverage effective on their first day of employment. NexaCorp provides an annual wellness stipend of $1,200 per calendar year, reimbursable for gym memberships, mental health apps, and athletic gear.",
          },
        ],
      },
      {
        title: "NexaCorp Solutions - Home Office Allowance",
        sections: [
          {
            heading: "Section 2: Remote Work Setup",
            body: "All full-time employees receive a one-time $1,000 ergonomic home office equipment setup allowance upon completing their onboarding.",
          },
        ],
      },
    ],
  );

  await createPDF(
    path.join(baseDir, "nexacorp_solutions", "Leave_and_PTO_Rules.pdf"),
    [
      {
        title: "NexaCorp Solutions - Leave Policy",
        sections: [
          {
            heading: "Section 1: Paid Time Off (PTO)",
            body: "Full-time employees accrue 20 days of paid annual leave per calendar year. Sick leave accrues separately at 10 days per year.",
          },
        ],
      },
      {
        title: "NexaCorp Solutions - Parental Leave Policy",
        sections: [
          {
            heading: "Section 2: Paid Primary Parental Leave Eligibility",
            body: "Employees qualify for 16 consecutive weeks of 100% paid primary parental leave if they meet all conditions:\n1. Employment Type: Must be a full-time regular employee (contractors and part-time staff are ineligible).\n2. Service Length: Must have completed at least 12 consecutive months of continuous service prior to the expected birth or adoption date.\n3. Advance Notice: Request must be formally submitted in the HR portal at least 60 days in advance.",
          },
        ],
      },
    ],
  );

  await createPDF(
    path.join(baseDir, "nexacorp_solutions", "Travel_Expense_Policy.pdf"),
    [
      {
        title: "NexaCorp Solutions - Travel Policy",
        sections: [
          {
            heading: "Section 1: Per Diem and Lodging",
            body: "Daily meal per diem allowance is $75 for domestic business travel and $110 for international business travel. Standard lodging cap is $250 per night; amounts exceeding this cap require VP approval prior to booking.",
          },
        ],
      },
      {
        title: "NexaCorp Solutions - Expense Reimbursements",
        sections: [
          {
            heading: "Section 2: Submission Requirements",
            body: "All expense reports must be submitted in the expense portal within 30 days of trip completion accompanied by itemized receipts. Submissions past 30 days will be rejected without executive sign-off.",
          },
        ],
      },
    ],
  );

  // --- Edge Case Files ---
  console.log("⏳ Generating >10MB large PDF file...");
  await createLargePDF(
    path.join(baseDir, "edge_cases", "exceeds_10mb.pdf"),
    10.5,
  );

  console.log("⏳ Generating 0-byte empty file...");
  createEmptyFile(path.join(baseDir, "edge_cases", "empty_document.pdf"));

  console.log(
    "✅ All standard and edge-case PDF test files generated in ./test_pdfs/",
  );
}

generateAllPDFs().catch((err) => console.error("Error generating PDFs:", err));
