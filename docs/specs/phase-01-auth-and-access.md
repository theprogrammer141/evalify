# Phase 1 — Authentication and role-based access

**Goal.** An administrator, examiner or candidate can sign in to Evalify with an authorized account, and the application consistently knows who they are and what their role allows them to access. Each person lands in the appropriate role workspace. Protected pages and operations remain inaccessible unless the request is authenticated and authorized on the server.

## Build

- **User accounts.** Persist user accounts with a unique email address, a securely hashed password and exactly one role: `ADMIN`, `EXAMINER` or `CANDIDATE`. Account creation and role assignment are controlled by an administrator; there is no public self-registration in this phase.
- **Initial administrator.** Provide a deliberate bootstrap or seed path for creating the first administrator so the system does not depend on an administrator already existing. Bootstrap credentials must come from local or deployment configuration, not from hard-coded production defaults. The bootstrap operation must be safe to run again without creating duplicate accounts.
- **Account management.** Administrators can view the account list, create accounts and assign or change an account's role. Non-administrators cannot access these operations. Account responses and screens never expose password hashes or session credentials.
- **Sign-in and sign-out.** Provide one email-and-password sign-in flow for all three roles. A successful sign-in establishes a server-managed session. Signing out invalidates that session on the server, not just in the browser.
- **Session persistence.** Keep the authenticated session across page refreshes. The server can resolve the current user and role from the session during server rendering and in Route Handlers. A missing, expired or revoked session is treated as signed out.
- **Role-aware landing.** After sign-in, send administrators, examiners and candidates to their respective application areas. Establish the shared application shell and the minimal role-specific workspace entry points that later phases will extend. Do not add examination workflows or decorative placeholder controls.
- **Protected pages.** Requests to protected pages by signed-out visitors are redirected to the sign-in page before protected page content is rendered or sent. An authenticated user attempting to open another role's page is denied access and is not shown that page's protected data.
- **Protected operations.** Every protected Route Handler and server-side operation checks authentication and the required role. Unauthenticated API requests receive an unauthorized response; authenticated users without the required role receive a forbidden response. Client-side route hiding is not an authorization mechanism.
- **Shared identity access.** Provide one server-side way to resolve the current authenticated user and one consistent way to require authentication or a role. Later features use these shared boundaries rather than implementing their own session parsing or role checks.

## Constraints

- **Authentication is application-managed.** Use the agreed email-and-password model. Do not introduce an external identity provider or multiple sign-in systems in this phase.
- **One role per account.** The only roles are `ADMIN`, `EXAMINER` and `CANDIDATE`. Do not add organization membership, team switching, custom roles or permission-editor functionality.
- **The server owns the session.** Generate an opaque, cryptographically random session token, store only its hash in the database, and deliver the token in an appropriately protected HTTP-only cookie. Use secure cookie settings for production. Do not store the raw token in the database or rely on a client-side user object as proof of identity.
- **One session mechanism.** There must be one authoritative session lifecycle. Do not add a second authentication/session library that competes for the same cookie or request middleware.
- **Passwords are never recoverable from storage.** Hash passwords with the selected password-hashing library (`bcryptjs`). Never log, return or persist plaintext passwords.
- **Authorization is server-side and centralized.** Server Components, Route Handlers and server-side feature logic must use the shared authentication boundary. A URL, client state, hidden button or user-supplied account ID does not grant access.
- **Role checks are not a substitute for resource checks later.** This phase establishes identity and role checks. When examinations, enrollments and attempts are introduced, their specifications must additionally enforce examiner ownership and candidate-specific access to each resource.
- **Persist only identity data in this phase.** Create the user and session persistence needed for authentication. Do not create examination, question, enrollment, attempt, answer, grading or reporting tables here.
- **Validate configuration at startup.** Required environment configuration must be checked when the application starts. Missing or malformed required values should produce a clear startup error rather than a delayed authentication or database failure.
- **Keep the shell deliberately small.** Establish the shared layout, current-user display, role-aware entry point and sign-out action. Detailed dashboards and examination navigation belong to their respective phases.

## Acceptance check

1. On a clean database, the documented bootstrap process creates the initial administrator. Running it again does not create a duplicate administrator.
2. Sign in with an administrator account and confirm that it lands in the administrator workspace. Create one examiner and one candidate, assign their respective roles, and confirm each can sign in and lands in the correct workspace.
3. Confirm that passwords are stored as hashes and that neither account-management responses nor rendered pages expose password hashes or session tokens.
4. Refresh each signed-in role's page. The server still resolves the correct user and role without requiring a client-side authentication step.
5. Sign out, then reuse the old session cookie to request a protected page and protected API endpoint. The revoked session is rejected.
6. Visit each role-protected page while signed out. The request is redirected to sign-in before protected page HTML or protected data is returned.
7. Sign in as a candidate and request an administrator or examiner page and its protected API operations directly. The server denies access; changing the URL or modifying client state does not bypass the check.
8. Call a protected API without a valid session and confirm an unauthorized response. Call it with a valid session belonging to the wrong role and confirm a forbidden response.
9. Attempt to create or manage accounts as an examiner or candidate. The operation is denied by the server, not merely hidden in the interface.
10. Remove a required environment value and start the application. Startup fails with a clear configuration error rather than allowing the application to start in a partially configured state.
11. Inspect the database after this phase. It contains the identity/session structures required by this phase and no examination-domain tables.

## Not in this phase

- Examination creation, editing, scheduling or publication.
- Question bank management, question assignment or answer-key storage.
- Candidate enrollment, examination attempts, answer saving or examination timing.
- Monitoring, incident recording, announcements, grading, results or analytics.
- Organization/team creation, membership, invitations or tenant switching. Evalify uses the three agreed application roles; the organization model from the reference specification does not apply.
- OAuth, social sign-in, third-party identity providers or public self-registration.
- Password reset, email verification, multi-factor authentication or advanced account lifecycle workflows unless a later specification explicitly adds them.
- Custom roles, granular permission editing or organization-specific permissions.
- Theme preferences and detailed visual customization.
- Full administrator, examiner or candidate dashboards. This phase establishes only the shared shell and minimal role-specific entry points needed for later work.
