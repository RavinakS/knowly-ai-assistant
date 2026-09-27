# Knowly

Knowly is a foundation for a multi-tenant AI knowledge and decision assistant. Organizations will be able to manage their own knowledge and provide grounded answers with document references. The project includes the web and API foundations, PostgreSQL database schema managed with Prisma, and JWT-based account authentication. Document processing and AI are not implemented yet.

## Stack

- **Frontend:** Next.js App Router, React, TypeScript, and Tailwind CSS
- **Backend:** NestJS, TypeScript, Prisma, and PostgreSQL
- **Package management:** npm workspaces

## Requirements

- Node.js 20.16+ or 22.3+
- npm
- PostgreSQL

## Local setup

Install dependencies from the repository root:

```bash
npm install
```

The frontend reads its API and public application URLs from
`frontend/.env.local`. Copy the example file to create it:

```powershell
Copy-Item frontend\.env.example frontend\.env.local
```

Copy the backend environment template and set `DATABASE_URL` to your local
PostgreSQL connection string. Set `JWT_SECRET` to a random secret of at least
32 characters. `FRONTEND_URL` controls credentialed API access, and
`COOKIE_SAME_SITE` defaults to `lax` for local development. For a cross-site
production frontend/API deployment, set it to `none` and use HTTPS; the cookie
will then be marked Secure. `UPLOAD_DIR` defaults to `./uploads`, relative to
the backend working directory. Nest loads the backend `.env` file automatically.

```powershell
Copy-Item backend\.env.example backend\.env
```

Create the database (for example, a PostgreSQL database named `knowly`), then
apply the initial migration and generate the Prisma client:

```bash
npm run db:migrate --workspace backend
npm run db:generate --workspace backend
```

This applies the initial schema and subsequent migrations, including nullable
document page counts and the page-level `DocumentPage` table.

The backend reads `PORT` from the environment and defaults to `4000`.

Start the frontend and backend in separate terminals:

```bash
npm run dev:frontend
npm run dev:backend
```

The landing page is available at [http://localhost:3000](http://localhost:3000). The API listens on port `4000` by default; its health check is [http://localhost:4000/health](http://localhost:4000/health).
The database check is available at [http://localhost:4000/health/database](http://localhost:4000/health/database).
Register at [http://localhost:3000/register](http://localhost:3000/register) or
sign in at [http://localhost:3000/login](http://localhost:3000/login). A
successful login or registration sets an HttpOnly cookie and opens
[http://localhost:3000/dashboard](http://localhost:3000/dashboard). The
organization dashboard loads the user's organization and assistant from
`GET /organization/me`, and its documents from
`GET /organization/me/documents`. Both endpoints derive the organization from
the authenticated user. The dashboard uploads PDFs through the protected
`POST /documents` endpoint. Uploads are limited to 10 MB and stored under the
configured backend `UPLOAD_DIR`, using the authenticated organization ID and a
server-generated document UUID.

## PDF Processing

The database migration for PDF pages is named
`20260927160000_document_pages`. Apply new migrations and regenerate Prisma
Client after pulling schema changes:

```bash
npm run db:migrate --workspace backend
npm run db:generate --workspace backend
```

PDF upload is followed by synchronous backend text extraction:

```text
PDF upload
→ local tenant-scoped storage
→ page-by-page PDF text extraction
→ page text stored in DocumentPage
→ Document marked READY
```

Each PDF page is stored separately in `DocumentPage`, including pages with no
extractable text. Successful processing sets the actual page count and changes
the document status to `READY`. If extraction fails, the document is marked
`FAILED` and the original PDF is retained. Processing is synchronous and
intended for this MVP; chunking, retrieval, embeddings, and LLM processing are
future steps. Authenticated users can inspect pages for their own documents via
`GET /documents/:id/pages`.

You can also verify the API from PowerShell. Registration/login set an
HttpOnly cookie in the web session; `/auth/me` uses that cookie:

```powershell
$api = "http://localhost:4000"
$body = @{
  name = "Ada Lovelace"
  organizationName = "Analytical Engines"
  email = "ada@example.com"
  password = "use-a-unique-password"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$api/auth/register" -Method Post `
  -ContentType "application/json" -Body $body -SessionVariable knowlySession
Invoke-RestMethod -Uri "$api/auth/me" -WebSession $knowlySession
```

To verify login, use a new web session with the same email/password at
`POST /auth/login`, then call `GET /auth/me` with that session.

If you use the VS Code REST Client extension, open
[`backend/requests/auth.http`](./backend/requests/auth.http) and
[`backend/requests/health.http`](./backend/requests/health.http), and
[`backend/requests/organization.http`](./backend/requests/organization.http).
Run the register request with a new email, then run login and the organization
requests; REST Client retains the HttpOnly cookie for requests to the local API.
Change the sample email/password at the top of `auth.http` for your test
account. Use [`backend/requests/documents.http`](./backend/requests/documents.http)
to test authenticated PDF uploads; update its sample file path to a local PDF.

## Generate test PDFs

The backend includes a script that creates sample university and company PDFs,
along with files for upload validation (a PDF larger than 10 MB and an empty
file). From the repository root, run:

```bash
npm run seed:pdfs --workspace backend
```

The generated files are written to `backend/test_pdfs/`, grouped into
`apex_university/`, `nexacorp_solutions/`, and `edge_cases/`. For example, use
`backend/test_pdfs/apex_university/Scholarship_and_Aid_Rules.pdf` to test a
valid upload. Set `@pdfPath` in
[`backend/requests/documents.http`](./backend/requests/documents.http) to the
absolute path of the generated PDF you want to upload. The empty and oversized
files in `edge_cases/` should be rejected by the upload endpoint.

Build both applications with:

```bash
npm run build
```

## Project structure

```text
frontend/   Next.js web application
backend/    NestJS API
```
