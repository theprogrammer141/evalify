# Secure Examination Management System (SEMS)

The product decisions behind this build, written before implementation, with the reasoning attached. The reasoning matters as much as the decisions: the feature specifications will describe individual pieces of work, but they cannot anticipate every implementation choice. When a situation is not covered by a spec, use the principles in this document to make a consistent decision.

Read the section relevant to the work in front of you. Do not treat this document as a prompt to implement the entire system at once. Implementation will proceed through one approved specification at a time.

## What it is

SEMS is a web application for institutions and competition organizers to create, conduct, monitor and evaluate online examinations.

An administrator manages users and their roles. An examiner creates an examination, prepares questions, enrolls candidates and publishes the examination. Candidates see the examinations assigned to them, complete an attempt in a focused workspace, and submit their answers. The examiner monitors the examination, reviews submissions, grades written responses, checks the results and publishes them. Candidates can then view their own published results.

The system supports single-answer multiple-choice questions, multiple-select questions and written responses. It also includes the supporting capabilities required by the competition brief: network-aware saving, PDF reports, an examination sandbox, bulk import, question analytics, verifiable reports, a customizable examination workspace and a digital scratchpad.

The central product bet is that an online examination should remain understandable and fair when ordinary things go wrong: a candidate refreshes the page, a request is repeated, a connection drops, an examiner edits a question, or an attempt reaches its deadline while the candidate is disconnected. The system must make the state of an examination clear and must not let the browser decide facts that belong to the server.

## The problem

Online examinations are not just forms with a countdown clock. They are time-bounded assessment workflows involving different roles, sensitive data and decisions that must remain consistent from publication through result release.

Before an examination, organizers need to define its schedule, questions, marking rules and eligible candidates. During an examination, candidates need to know how much time remains, whether their answers have been saved and which questions still need attention. Examiners need to understand which candidates are active, whether attempts are progressing and whether relevant incidents have occurred. After an examination, objective answers need to be graded consistently, written responses need human review, and results need to be checked before publication.

Each stage creates a different way to get the assessment wrong. A candidate may enter an examination they were not assigned. A browser clock may disagree with the server. A refresh or interrupted request may make a candidate believe an answer was saved when it was not. A question may be edited after a candidate has started, changing the meaning of an existing attempt. A duplicate submission may create inconsistent state. An automatically calculated score may be published before written responses have been graded. A report may expose information that its recipient was not authorized to see.

These are not cosmetic bugs. They affect the fairness, trustworthiness and integrity of the examination itself.

## Who it is for

**Administrators** are responsible for platform-level operations. They manage user accounts, assign roles and control access. They should not need to participate in the examiner's assessment workflow to perform those duties.

**Examiners** prepare and conduct examinations. They create and configure examinations, maintain the question bank, enroll candidates, monitor active attempts, communicate announcements, review incidents, grade written responses, review results and publish them.

**Candidates** take examinations assigned to them. They need a clear view of available, upcoming and completed examinations; a focused workspace during an attempt; reliable feedback about saving and connectivity; and access to their own results after publication.

The product is intended for institutions and competition organizers that need a complete examination workflow rather than a collection of disconnected administration screens. The three roles have different responsibilities, and the interface and backend permissions must reflect those differences.

## Why this is difficult to get right

The visible screens are the easy part. The difficult part is keeping the same examination state consistent across the browser, application server and database while multiple people and requests interact with it.

The candidate's browser can display a countdown, but it cannot be trusted to enforce the deadline. A button can be hidden from an unauthorized user, but hiding it does not authorize or protect the underlying operation. A success message can appear after a save request, but it is meaningful only when the server has accepted and persisted the answer. A question can look unchanged in an examiner's editor while an active candidate is answering the version that was originally assigned.

There is also a distinction between monitoring and judgment. A browser event may be relevant to an examiner, but it does not prove misconduct. The system must preserve useful incident information without turning an uncertain signal into an automatic accusation or penalty.

Finally, the competition has a ten-hour development window and expects all eight secondary features as well as a complete core workflow. That makes integration and disciplined scope more important than building many isolated screens. A small, coherent implementation that works end to end is more valuable than a broad interface full of non-functional controls.

## The rule everything rests on

**The server is the source of truth for every consequential examination state.**

The server decides who may perform an action, whether a candidate is eligible to enter an examination, when an attempt starts and expires, which answers have been accepted, whether an attempt has been submitted, how objective answers are scored, whether written grading is complete and whether results have been published.

The browser may present state and request changes. It may not independently establish authoritative state. In particular:

- Hiding a control is not authorization. Every protected operation must be authorized on the server.
- A client countdown is a display. The server's recorded start and expiry times determine whether an answer or submission is still permitted.
- A local answer is not a confirmed saved answer. The interface must distinguish pending changes from changes acknowledged by the server.
- A candidate-facing response must never reveal correct answers or marking keys.
- A monitoring event is information for review, not conclusive evidence of misconduct.
- A result is not visible to candidates merely because a score has been calculated. It becomes visible only after the examiner's review and publication step.

This rule should decide implementation questions whenever convenience conflicts with correctness.

## Scope

The following capabilities are in scope for this version. The competition problem statement expects all eight core functional areas and all eight secondary features. These are product requirements, not optional future enhancements.

### Core examination workflow

- **Authentication and authorization.** Support secure sign-in for administrators, examiners and candidates. Administrators manage user accounts and role assignments. The backend enforces role permissions and resource ownership; examiners and candidates can access only the examinations, records and actions assigned to them.
- **Examination management.** Examiners create examinations with a title, instructions, schedule, duration, total marks and relevant settings. The lifecycle uses draft, published, ongoing and completed states. Candidates cannot enter before the examination is available to them.
- **Question management.** Provide a reusable question bank with categories or topics and difficulty levels. Support single-answer MCQs, multiple-select questions and written responses, with suitable marking schemes. Objective questions or answer choices may be randomized where applicable.
- **Candidate management.** Examiners enroll candidates and inspect enrollment information. Candidates see their available, upcoming and completed examinations, including instructions and access status. Entry is restricted to eligible candidates and the permitted examination window.
- **Examination interface.** Present questions, marks, remaining time and navigation controls. Distinguish answered, unanswered and marked-for-review questions. Save answers automatically, preserve accepted progress across refreshes and returns, allow candidates to review progress and submit, and finalize attempts at expiry.
- **Examination monitoring.** Show examiners active attempts, candidate progress and relevant events or incidents. Examiners can inspect examination status and send announcements during an examination. Incidents are recorded for review and are not treated as automatic proof of misconduct.
- **Evaluation and grading.** Grade objective responses automatically according to the configured marking scheme. Examiners review and manually grade written responses. Validate awarded marks against the marks assigned to each question, calculate totals consistently and allow result review before publication.
- **Results and analytics.** Examiners publish results through a controlled action. Candidates see only their own published results. Examiners receive examination-level performance summaries and candidate-level scores based on actual submission data. Completed attempts and results remain available to authorized users.

### Secondary features

All eight secondary features are expected by the competition brief. Each must have a working, integrated use in the product; a placeholder screen does not satisfy the requirement.

- **Network-aware interface.** Detect and communicate connectivity problems and the state of answer saving or synchronization. Show whether changes are pending, accepted or failed. Retry interrupted saves safely and restore the last server-confirmed progress when a candidate returns.
- **PDF report generation.** Generate readable, downloadable reports from actual examination and candidate performance data. Enforce the same access restrictions that apply to the underlying records.
- **Examination sandbox.** Let examiners preview and experience an examination as a candidate. Sandbox attempts are isolated from real submissions, grading, results and examination statistics.
- **Bulk data import.** Import candidate records and questions from structured CSV or JSON files. Validate the content and report invalid rows or fields clearly rather than silently accepting incomplete data.
- **Question analytics.** Present useful insights from actual responses, such as skipped questions, frequently incorrect answers and observed question difficulty. The interface must make clear what the available data can and cannot establish.
- **Verifiable reports.** Give an issued report a unique verification identifier or QR code. Verification must confirm the report's authenticity without exposing unnecessary candidate information.
- **Customizable examination workspace.** Let candidates retain meaningful workspace preferences, such as layout or viewing settings, without changing examination rules or the content being assessed.
- **Digital scratchpad.** Provide a usable space for candidates to perform rough work during an examination. It belongs inside the examination workflow and must not interfere with answer saving or submission.

### Chosen innovation challenge: Failure-Resilient Examinations

The selected innovation challenge is failure resilience. Internet outages, refreshes and interrupted requests should have as little impact on a candidate's work as the system can reasonably provide without creating extra time or an unfair advantage.

The implementation will make connection and save status visible, distinguish pending changes from server-accepted answers, retry interrupted saves safely and restore the last confirmed attempt state when the candidate resumes. The server's expiry time continues to advance during a disconnection. Reconnecting does not pause the clock, extend the deadline or reopen an expired attempt. At expiry, the server finalizes the attempt using the answers it accepted within the permitted period.

This is deliberately a resilience mechanism, not a promise that an examination can be completed fully offline or that an unacknowledged browser edit is guaranteed to survive every device failure. The system must communicate that distinction honestly.

## Out of scope, and why

These are plausible additions, but they are not part of this version. Each would add risk, distract from the required examination lifecycle or require assumptions the competition brief does not make.

- **AI-based proctoring, face recognition or automated misconduct verdicts.** The selected innovation is failure resilience, not surveillance. Browser events may be recorded for examiner review, but the system will not claim that they prove cheating or automatically penalize a candidate.
- **AI grading of written responses.** Written responses are manually evaluated by examiners. Automated grading would introduce a separate accuracy, fairness and explainability problem that is not required for the core workflow.
- **Guaranteed full offline examinations.** The product will provide network awareness, safe retries and recovery of server-confirmed progress. It will not promise that a candidate can complete and submit an entire examination without connectivity.
- **Extra time after an outage.** The deadline remains server-enforced. Connectivity failure does not grant additional examination time.
- **Multiple attempts or retakes for the same candidate and examination.** The initial model allows one real attempt per candidate per examination. A retake policy requires explicit product rules and is not assumed.
- **Partial credit for multiple-select questions.** The initial marking rule is exact-set matching: the submitted selection must match the configured correct set. Partial-credit policies are outside this version.
- **Live video surveillance, screen recording or biometric collection.** These create privacy and operational concerns and are not required to demonstrate a fair examination workflow.
- **Native mobile applications.** The deliverable is a responsive web application.
- **External LMS integrations, payments and institutional billing.** They are not necessary for the required workflows or the competition demonstration.
- **Microservices, separate worker fleets and mandatory paid APIs.** The delivery window does not justify distributed infrastructure. Required features must work without billing-dependent external services.

If a later specification appears to require one of these capabilities, treat it as a scope decision that needs explicit review rather than silently adding it.

## How it works

The architecture is intentionally a modular monolith: one deployable Next.js application and one PostgreSQL database. The system needs clear boundaries inside the codebase, not the operational overhead of multiple services.

### Application structure

The agreed stack is:

- Next.js 16 App Router for the web application and server-side request handling.
- TypeScript for application code and shared contracts.
- PostgreSQL for persistent relational data.
- Drizzle ORM for schema definition, queries and migrations.
- Zod for validating untrusted input at application boundaries.
- Tailwind CSS and shadcn/ui for the interface and reusable UI primitives.
- Vercel as the deployment target.

Route Handlers expose the application's REST-style API under `/api/v1`. Server Components are used for data-heavy pages and dashboards. Client Components are used where the interface needs interaction, such as answering questions, navigating an attempt, editing forms or displaying live save state.

Business rules belong in server-side feature/service logic, not in React components or database-specific UI code. Database access should be kept behind the appropriate data-access modules. The feature boundaries should reflect the product areas: authentication and access, examination administration, question bank, candidate and enrollment management, examination delivery, monitoring, grading and results/reporting.

The database hosting provider is an infrastructure choice; PostgreSQL is the requirement. The application uses Drizzle for database access. No required workflow should depend on a paid API, paid API key or a service that requires billing information.

### Identity and access

The system has three roles: `ADMIN`, `EXAMINER` and `CANDIDATE`. An account has one role in this version. The administrator manages accounts and role assignments; examiners manage examinations and candidates within their authority; candidates access only their own assigned examinations, attempts and published results.

Use application-managed credentials and server-side sessions. Passwords are stored as secure hashes, never as plaintext. The session credential is an opaque random token delivered in an appropriately protected HTTP-only cookie; the database stores a hash of the token rather than the raw token. Cookie settings must be appropriate for the deployment environment.

Every API operation and protected server-rendered data access checks the authenticated user, role and relevant resource relationship. A candidate-supplied ID is not proof of ownership. Authorization must be enforced where data is accessed, not inferred from the route a user opened or the controls displayed in the browser.

### Examination and attempt data

The database is relational because users, examinations, enrollments, questions, attempts, answers, grades and reports have explicit relationships and integrity rules.

An enrollment represents permission to take an examination; it is separate from an attempt. The initial model allows one real attempt for a given candidate and examination. Database constraints should protect uniqueness and prevent duplicate records when requests are retried.

When an attempt starts, the system records the authoritative start and expiry times and creates an immutable snapshot of the questions, question text, options, ordering, marks and marking rules assigned to that attempt. Editing a question-bank item later must not change an attempt already in progress. Candidate-facing question data excludes correct answers and marking keys.

Answers are associated with the attempt's question snapshot. State-changing operations such as starting, saving, submitting and grading use appropriate database transactions and constraints so concurrent or repeated requests cannot create contradictory results. Repeating a save or submission should not create a second answer or a second finalized attempt.

Attempt state and result publication state are separate concerns. An attempt can be in progress, submitted, auto-submitted or graded. A calculated or graded result can remain under examiner review until it is explicitly published. A candidate sees a result only after publication.

### Time and submission

The server records `startedAt` and `expiresAt`. The candidate's timer is a view of the remaining time, not the authority for the deadline. The server checks the deadline when accepting answers and when processing submission. The server finalizes an expired attempt even if the candidate's browser is no longer connected; a returning candidate must see the resulting finalized state, not a fresh timer.

Manual submission and automatic finalization must converge on one valid final state. A race between an answer save, manual submission and expiry must not produce duplicate submissions or accept answers after the deadline. The finalized attempt contains only answers accepted within the permitted period.

### Grading and publication

Single-answer objective questions are graded against the stored marking scheme. Multiple-select questions use exact-set matching in this version. Written responses remain pending until an examiner assigns and saves a valid mark. A mark cannot be less than zero or exceed the question's assigned maximum.

The system calculates totals from the attempt snapshot and accepted answers. Where an examination includes written responses, the result cannot be treated as ready for publication until manual grading is complete and the examiner has reviewed it. Publication is an explicit action, not an automatic consequence of submission or score calculation.

### Failure resilience and monitoring

The candidate interface communicates whether the browser is online and whether the latest answer changes are pending, accepted or failed. Saves can be retried safely. On refresh or return, the server-confirmed attempt state is restored. The server clock continues during an outage; no reconnect operation extends the deadline.

Examiners see active attempts, progress and relevant incidents. Incidents are recorded with enough context to support review, but no browser event should be translated into an automatic misconduct verdict. Announcements are delivered through the examination workflow and must be associated with the correct examination and eligible candidates.

### Reports, imports and sandbox isolation

PDF reports are generated from persisted examination and result data after authorization checks. Verification identifiers are unique and resolve to a limited authenticity response; they must not expose unnecessary personal or assessment information.

Imports are validated before records are committed. The user receives actionable feedback about invalid or rejected rows. A partially invalid file must not silently create a dataset that appears complete.

Sandbox data is distinguishable from real examination data at the data and business-rule levels. Sandbox attempts never contribute to official submissions, grades, published results or question analytics. Hiding sandbox rows in the interface is not enough; calculations and queries must exclude them as well.

## The interface

This is an examination product, not a generic administration dashboard. Each role should see the information and actions needed for its work without being exposed to unrelated controls.

**Administrators** need straightforward user and role management. **Examiners** need a workspace organized around preparing, publishing, monitoring, grading and reviewing examinations. **Candidates** need a simple view of their examination availability and a focused examination workspace.

The candidate examination workspace deserves particular care. The question, marks, remaining time, navigation state, save status and submission action must be easy to locate. Answered, unanswered and marked-for-review questions need distinct visual states. Connectivity and saving feedback must be understandable without forcing the candidate to interpret technical error messages. The scratchpad and workspace preferences should support the task rather than compete with the question content.

Use clear hierarchy, consistent interaction patterns, readable typography, sufficient contrast, keyboard-accessible controls and responsive layouts. The examination screen should avoid distracting visual effects. Important states such as an expired attempt, a failed save or a published result must be communicated plainly; colour alone must not carry their meaning.

The exact shell and screen layouts will be settled in the relevant feature specifications. Later specifications should extend the established interface rather than repeatedly rearrange it without a product reason.

## Where this is likely to go wrong

**Authorization across resource boundaries.** A candidate may change an ID in a request, or an examiner may request another examiner's records. Checking only the role is insufficient; access must also be scoped to the relevant examination, enrollment, attempt or ownership relationship.

**Deadline enforcement and concurrent requests.** The browser timer can drift, and save, submit and expiry requests can arrive close together. The server must make the final decision using authoritative time and transactional state changes. This deserves direct tests, not just a visual timer check.

**False save confirmation.** An optimistic interface can make a candidate believe an answer is safe before it has reached the database. The interface must distinguish pending from accepted changes and make failures visible. Retried requests must be safe to repeat.

**Changing questions during an active attempt.** If an attempt reads from the live question bank, an examiner edit can change an assessment after it has started. The attempt snapshot is the record of what that candidate was assigned and must remain stable.

**Leaking answer keys.** It is not enough to hide correct answers in the interface. Candidate API payloads and server-rendered data must not contain the marking key in the first place.

**Grading and publication states.** Objective scoring, manual written grading, examiner review and publication are different steps. Collapsing them into a single `completed` flag can expose incomplete or unreviewed results.

**Sandbox contamination.** A sandbox attempt that enters a shared grading or analytics query can corrupt the apparent performance of a real examination. Isolation must be enforced in the data model and every relevant calculation.

**Import and report privacy.** Bulk import must not silently accept malformed records. PDF and verification endpoints must not become a way to retrieve another candidate's personal data or unpublished results.

**Overbuilding secondary features.** Each secondary feature is expected, but a separate elaborate subsystem is not. The right implementation is the smallest genuinely useful feature integrated into the full workflow. A non-functional card, button or demo-only screen does not meet the requirement.

## What has to be true before this ships

Not "the screens look complete". The following behaviors must be demonstrated with test data and real application flows:

- An administrator can create and manage accounts and roles. Protected operations reject unauthenticated users and users without the required role or resource access.
- An examiner can create an examination, add questions of all three supported types, configure its schedule and marks, enroll candidates, review it and publish it.
- A candidate cannot enter an examination before it is available or unless they are enrolled. A candidate cannot retrieve another candidate's attempt, answers or results by changing an identifier.
- An active attempt uses a stable question and marking snapshot. Candidate-facing responses contain no correct answers or marking keys.
- The server, not the browser clock, enforces the examination deadline. Refreshing or returning restores server-confirmed progress and the correct remaining time. Expiry finalizes the attempt without granting extra time.
- Answer saves, manual submission and automatic finalization remain consistent under repeated requests and timing races. An attempt cannot be submitted twice or accept an answer after finalization.
- The interface accurately distinguishes pending, saved and failed answer changes. A network interruption and recovery can be demonstrated without falsely claiming that unacknowledged changes were saved.
- Monitoring, announcements and incident review work for the correct examination. Incident indicators are not presented as conclusive evidence of misconduct.
- Objective grading follows the configured rules; multiple-select grading uses exact-set matching; written responses can be manually graded with marks bounded by the question maximum.
- Results remain unavailable to candidates until the examiner has completed the required grading and review and explicitly publishes them.
- All eight secondary features have working implementations connected to real application data. Sandbox attempts are excluded from official results and analytics.
- PDF reports contain actual data and respect access rules. Report verification confirms authenticity without disclosing unnecessary candidate information.
- Bulk imports validate their contents and communicate errors clearly. Question analytics are calculated from real attempts rather than sample values presented as live statistics.
- The deployed application can be demonstrated end to end with fictional or test accounts for all three roles. The repository includes setup instructions, test credentials and an explanation of the selected innovation challenge.

The competition evaluation gives 30 marks to core functionality, 15 to secondary features, 20 to technical quality and reliability, 15 to innovation and 20 to UI/UX and product design. The build should therefore prioritize a complete, reliable examination lifecycle while ensuring that the eight secondary features are not left as placeholders. The final 15-minute demonstration should show the same integrated workflow a judge can test, not a sequence of disconnected mock screens.

## Delivery constraints

The competition provides ten hours for development and allows a team of one to three participants. This project is being delivered by a team of three. The implementation should remain one deployable application and one database so that the team can integrate continuously and demonstrate the complete system within the available time.

Work will be organized through feature specifications written one at a time. Each specification must use the format agreed by the team and must fit the product decisions in this document. The shared schema, API contracts and state transitions must be agreed before parallel work depends on them. Changes to shared contracts should be communicated rather than introduced independently by separate contributors.

The repository and deployed application are both deliverables. The README must explain setup, dependencies, test credentials for each role and the implemented innovation. The application must work with fictional or test data and must not require paid services or billing-dependent credentials for required functionality. The official competition deadline is a hard boundary: no commits, pushes, builds or deployments are permitted after it.
