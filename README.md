# Evalify

An online examination management platform — a Next.js application for administrators,
examiners and candidates.

## Local setup

1. Install the project dependencies with `npm install`.
2. Set `DATABASE_URL` in `.env.local` to a PostgreSQL connection URL. The
   application validates that it includes a PostgreSQL protocol, host, username
   and password when the server starts.
3. Apply the identity, examination and monitoring schemas with `npm run db:migrate`.
3. Apply the database schema with `npm run db:migrate`.
4. Configure `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in
   `.env.local`, then run `npm run db:bootstrap-admin`. Use a unique password of
   at least 12 bytes and no more than bcrypt's 72-byte limit. The bootstrap
   command is safe to repeat for the same administrator email; it will not
   replace an existing password or role.
5. Remove the bootstrap password from `.env.local` after creating the account.
6. Start the development server with `npm run dev`, then sign in at
   [http://localhost:3000/sign-in](http://localhost:3000/sign-in).

Administrators create examiner and candidate accounts from the People & roles
workspace. There is no public registration. Sessions are stored in PostgreSQL
as hashes of random tokens and are revoked server-side on sign-out.

Examiners can create and publish examinations, manage reusable questions,
assign question snapshots, configure randomization, enroll candidates and
monitor published examinations. Candidates can start one server-timed attempt,
save answers and review marks, and receive announcements inside the examination
workspace. The monitoring view reports persisted attempt progress and
browser-level events; it does not infer a candidate's connection state or make
misconduct decisions. Examination totals are calculated from assigned question
marks and persisted with each change. Schedule availability is evaluated on
the server in UTC.
Configure `CRON_SECRET` in the deployment environment so the scheduled Vercel
expiry route can finalize disconnected attempts. The route also checks expiry
on candidate access and answer/submission requests.

## Available commands

- `npm run dev` — start the development server.
- `npm run build` — create a production build.
- `npm run start` — serve the production build.
- `npm run lint` — run ESLint on application and configuration code.
- `npm test` — run focused authentication and attempt-validation tests.
- `npm run db:migrate` — apply all idempotent database migrations in order.
- `npm run db:bootstrap-admin` — create the configured initial administrator.

Phase 2 adds examination setup, question-bank management, enrollment and
candidate-facing examination listings. Phase 4 adds the minimum attempt
delivery needed to persist and monitor progress, incident review, and
candidate/examiner announcements. Grading and result publication remain out of
scope.
The database currently includes identity/session tables and the minimal
examination, question, enrollment and attempt records required for candidate
delivery. Examination authoring, grading and result publication are separate
phases.
