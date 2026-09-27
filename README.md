# Knowly

Knowly is a foundation for a multi-tenant AI knowledge and decision assistant. Organizations will be able to manage their own knowledge and provide grounded answers with document references. This first step contains only the web and API project foundations; authentication, persistence, document processing, and AI are not implemented yet.

## Stack

- **Frontend:** Next.js App Router, React, TypeScript, and Tailwind CSS
- **Backend:** NestJS and TypeScript
- **Package management:** npm workspaces

## Requirements

- Node.js 20.9 or later
- npm

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

The backend reads `PORT` from the process environment and defaults to `4000`.
`backend/.env.example` documents the available setting; Nest does not load `.env`
files automatically in this foundation.

Start the frontend and backend in separate terminals:

```bash
npm run dev:frontend
npm run dev:backend
```

The landing page is available at [http://localhost:3000](http://localhost:3000). The API listens on port `4000` by default; its health check is [http://localhost:4000/health](http://localhost:4000/health).

Build both applications with:

```bash
npm run build
```

## Project structure

```text
frontend/   Next.js web application
backend/    NestJS API
```
