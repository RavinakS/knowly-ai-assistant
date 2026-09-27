# Knowly

Knowly is a foundation for a multi-tenant AI knowledge and decision assistant. Organizations will be able to manage their own knowledge and provide grounded answers with document references. The project currently includes the web and API foundations and a PostgreSQL database schema managed with Prisma. Authentication, document processing, and AI are not implemented yet.

## Stack

- **Frontend:** Next.js App Router, React, TypeScript, and Tailwind CSS
- **Backend:** NestJS, TypeScript, Prisma, and PostgreSQL
- **Package management:** npm workspaces

## Requirements

- Node.js 20.9 or later
- npm
- PostgreSQL

## Local setup

Install dependencies from the repository root:

```bash
npm install
```

The frontend reads its API URL from `frontend/.env.local`. Copy the example file
to create it:

```powershell
Copy-Item frontend\.env.example frontend\.env.local
```

Copy the backend environment template and set `DATABASE_URL` to your local
PostgreSQL connection string. Nest loads the backend `.env` file automatically.

```powershell
Copy-Item backend\.env.example backend\.env
```

Create the database (for example, a PostgreSQL database named `knowly`), then
apply the initial migration and generate the Prisma client:

```bash
npm run db:migrate --workspace backend
npm run db:generate --workspace backend
```

The backend reads `PORT` from the environment and defaults to `4000`.

Start the frontend and backend in separate terminals:

```bash
npm run dev:frontend
npm run dev:backend
```

The landing page is available at [http://localhost:3000](http://localhost:3000). The API listens on port `4000` by default; its health check is [http://localhost:4000/health](http://localhost:4000/health).
The database check is available at [http://localhost:4000/health/database](http://localhost:4000/health/database).

Build both applications with:

```bash
npm run build
```

## Project structure

```text
frontend/   Next.js web application
backend/    NestJS API
```
