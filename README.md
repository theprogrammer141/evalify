# SEMS

Secure Examination Management System — a Next.js application for administrators,
examiners and candidates.

## Local setup

1. Install the project dependencies with `npm install`.
2. Set `DATABASE_URL` in `.env.local` to a PostgreSQL connection URL. The
   application validates that it includes a PostgreSQL protocol, host, username
   and password when the server starts.
3. Apply the identity and examination schemas with `npm run db:migrate`.
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
assign question snapshots, configure randomization and enroll existing
candidates. Candidates see only published examinations assigned to their
account; this phase does not include starting or taking an examination.
Examination totals are calculated from assigned question marks and persisted
with each change. Schedule availability is evaluated on the server in UTC.

## Available commands

- `npm run dev` — start the development server.
- `npm run build` — create a production build.
- `npm run start` — serve the production build.
- `npm run lint` — run ESLint on application and configuration code.
- `npm test` — run authentication and examination validation tests.
- `npm run db:migrate` — apply the idempotent identity and examination migrations.
- `npm run db:bootstrap-admin` — create the configured initial administrator.

Phase 2 adds examination setup, question-bank management, enrollment and
candidate-facing examination listings. Attempt delivery and grading are
introduced in later phases.
