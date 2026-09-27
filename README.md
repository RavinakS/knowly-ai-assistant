# Knowly

Knowly is a foundation for a multi-tenant AI knowledge and decision assistant. Organizations will be able to manage their own knowledge and provide grounded answers with document references. The project includes the web and API foundations, PostgreSQL database schema managed with Prisma, and JWT-based account authentication. Document processing and AI are not implemented yet.

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
PostgreSQL connection string. Set `JWT_SECRET` to a random secret of at least
32 characters. `FRONTEND_URL` controls credentialed API access, and
`COOKIE_SAME_SITE` defaults to `lax` for local development. For a cross-site
production frontend/API deployment, set it to `none` and use HTTPS; the cookie
will then be marked Secure. Nest loads the backend `.env` file automatically.

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
Register at [http://localhost:3000/register](http://localhost:3000/register) or
sign in at [http://localhost:3000/login](http://localhost:3000/login). A
successful login or registration sets an HttpOnly cookie and opens
[http://localhost:3000/dashboard](http://localhost:3000/dashboard), which loads
the authenticated account from `GET /auth/me`.

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
[`backend/requests/health.http`](./backend/requests/health.http). Run the
register request with a new email, then run login and `/auth/me`; REST Client
retains the HttpOnly cookie for requests to the local API. Change the sample
email/password at the top of `auth.http` for your test account.

Build both applications with:

```bash
npm run build
```

## Project structure

```text
frontend/   Next.js web application
backend/    NestJS API
```
