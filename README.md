# Evalify

Evalify is a web-based examination management platform for institutions and competition organizers. It supports the examination lifecycle—from setup and candidate enrollment through secure delivery, grading, result publication, and report verification.

## What it does

Evalify provides separate workspaces for three roles:

- **Administrators** manage user accounts and assign roles.
- **Examiners** create examinations, maintain a question bank, enroll candidates, monitor attempts, grade submissions, and publish results.
- **Candidates** access assigned examinations, complete timed attempts, and view their own published results and reports.

Core capabilities include:

- Server-enforced examination schedules, attempt deadlines, and role-based access.
- Single-answer multiple-choice, multiple-select, and written-response questions.
- Attempt question snapshots, so edits to the question bank do not change an active attempt.
- Autosaved answers with server-confirmed progress and recovery when candidates return.
- Examination monitoring, candidate announcements, manual grading, and controlled result publication.
- Examination performance summaries, PDF reports, and public report verification.

Monitoring events are provided for examiner review; they are not treated as proof of misconduct. Candidate results are available only after an examiner publishes them.

## Technology

- Next.js 16 with the App Router
- React 19 and TypeScript
- PostgreSQL with Drizzle ORM
- Tailwind CSS and shadcn/ui
- Zod for input validation
- Playwright for browser-based end-to-end tests

## Getting started

### Prerequisites

- Node.js and npm
- A PostgreSQL database accessible from the application

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the database

Create a `.env.local` file in the project root and set `DATABASE_URL` to a PostgreSQL connection URL. The URL must include the protocol, host, username, and password.

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
```

### 3. Apply database migrations

```bash
npm run db:migrate
```

### 4. Create the initial administrator

Add the bootstrap credentials to `.env.local`:

```dotenv
BOOTSTRAP_ADMIN_EMAIL="admin@example.com"
BOOTSTRAP_ADMIN_PASSWORD="use-a-unique-password-of-at-least-12-bytes"
```

Then create the administrator:

```bash
npm run db:bootstrap-admin
```

The password must be at least 12 bytes and no more than bcrypt's 72-byte limit. The bootstrap command does not overwrite an existing account's password or role. Remove `BOOTSTRAP_ADMIN_PASSWORD` from the environment after bootstrapping.

There is no public registration flow. Administrators create examiner and candidate accounts in the application.

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000/sign-in](http://localhost:3000/sign-in) to sign in.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by the application and database scripts. |
| `BOOTSTRAP_ADMIN_EMAIL` | For initial setup | Email address for the initial administrator. |
| `BOOTSTRAP_ADMIN_PASSWORD` | For initial setup | Initial administrator password; remove it after bootstrapping. |
| `CRON_SECRET` | For scheduled expiry processing | Secret used to authorize the scheduled attempt-expiry endpoint in deployment. |

Set production secrets through your hosting provider's environment configuration rather than committing them to the repository. The scheduled expiry route is configured in `vercel.json`; candidate access and answer/submission requests also check for expired attempts.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run ESLint on application and configuration code. |
| `npm test` | Run unit tests for validation, attempts, monitoring, grading, and reports. |
| `npm run test:e2e` | Run Playwright end-to-end tests. |
| `npm run db:migrate` | Apply database migrations. |
| `npm run db:bootstrap-admin` | Create the configured initial administrator. |

To run the browser tests, install Playwright's Chromium browser if it is not already available:

```bash
npx playwright install chromium
```

By default, Playwright starts the app on `http://127.0.0.1:3100`. To use an already-running app, set `PLAYWRIGHT_BASE_URL`:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

The Phase 5 acceptance test creates and removes test records using `DATABASE_URL`. Run end-to-end tests only against a migrated, disposable PostgreSQL database; if a test process is interrupted, cleanup may not complete.

## Data and security notes

- Authentication sessions use random credentials; the database stores hashes of session tokens.
- The server authorizes protected operations and enforces examination availability and deadlines. Browser clocks are display-only.
- Candidates can access only their own attempts, published results, and issued reports.
- Report verification confirms whether a report is valid or revoked without exposing candidate details or marks.
- A connection failure does not pause or extend an examination deadline. The application restores server-confirmed progress, not unacknowledged browser edits.

## Project structure

```text
src/
  app/          Next.js pages, layouts, and API routes
  components/   Application and reusable UI components
  lib/          Authentication, database, examination, attempt, grading, and report logic
migrations/     PostgreSQL schema migrations
scripts/       Database migration and administrator bootstrap scripts
tests/          Playwright end-to-end tests and fixtures
docs/           Product decisions, requirements, and feature specifications
```

## License

See [LICENSE](./LICENSE).
