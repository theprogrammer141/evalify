# Phase 2 — Examination setup and candidate enrollment

**Goal.** An examiner can prepare an examination, build its question set from a reusable question bank, assign eligible candidates, and publish it when it is ready. Candidates can see examinations assigned to them and understand when they are available. Every examination and its related records remain accessible only to authorized users.

This phase establishes the administrative side of the examination lifecycle. It does not yet allow candidates to start or take an examination.

## Build

- **Examination creation.** Examiners can create an examination with a title, instructions, scheduled availability, duration, total marks and relevant settings. A newly created examination starts as a draft.
- **Examination management.** Examiners can view, edit and manage examinations within their authority. The interface makes draft, published, ongoing and completed states clear. Availability is determined using the configured schedule and server time.
- **Question bank.** Examiners can create, view, edit and organize reusable questions. Each question supports a category or topic, difficulty level, marks and one of the three required types:
  - Single-answer MCQ.
  - Multiple-select question.
  - Written-response question.
- **Question configuration.** Objective questions support answer options and a configured correct answer or correct set. Written questions support the question content and assigned marks. Validation prevents incomplete or invalid question configurations from being saved.
- **Examination question set.** Examiners can add questions from the question bank to an examination, remove them, and configure their order and marks for that examination. The system calculates the examination's total marks from its assigned questions and keeps that value consistent with the configured total.
- **Randomization settings.** Examiners can configure randomization of objective questions or answer choices where applicable. The setting is stored with the examination; actual candidate-specific ordering is handled when an attempt is created in a later phase.
- **Candidate enrollment.** Examiners can find existing candidate accounts, enroll candidates in an examination, view its enrollment list and remove an enrollment where no attempt has started. The same candidate cannot be enrolled twice in the same examination.
- **Publication.** An examiner can review an examination before publishing it. Publication is allowed only when the examination has valid instructions, schedule, duration, questions and eligible candidates. Published examinations become available to enrolled candidates according to their configured availability window.
- **Candidate examination listing.** Candidates can see examinations assigned to them, including relevant instructions, schedule and availability status. They cannot access examination questions or begin an attempt in this phase.
- **Resource ownership.** Examiners can manage only examinations and related question/enrollment records within their authority. Candidates can see only examinations in which they are enrolled.

## Constraints

- **The server owns examination state and availability.** Client clocks, disabled buttons and client-side status calculations are not authoritative. The server determines whether an examination can be published or is available to a candidate.
- **Drafts are not candidate-accessible.** A candidate must never see a draft examination, its questions or its answer keys, even if they know an examination ID or call an endpoint directly.
- **Authorization is resource-scoped.** Checking that a user has the `EXAMINER` role is not enough. Every operation must also verify that the examiner has authority over the specific examination and its related records. Candidate access must be checked against enrollment.
- **Question bank records are reusable, but examination assignments are explicit.** Editing a question-bank question must not silently change the marks, order or configuration already assigned to an examination. The examination's assigned question configuration is its own record.
- **Correct answers remain private.** Answer keys and marking data are available only to authorized examiner-side operations. Candidate-facing pages and APIs must not return them.
- **Question types have distinct validation rules.** A single-answer question must have one valid correct option; a multiple-select question must have a valid correct set; a written-response question must not require objective answer options.
- **Marks must be consistent.** Question marks must be valid positive values. The examination total must agree with the sum of its assigned question marks; the client cannot submit an arbitrary total.
- **Publication is a controlled state transition.** Invalid or incomplete drafts cannot be published. Publishing must be an explicit server-authorized action and repeated requests must not create inconsistent state.
- **Enrollment is separate from an attempt.** Enrolling a candidate grants eligibility; it does not create an attempt or start the examination clock. Attempt creation belongs to a later phase.
- **No candidate-specific attempt snapshot is created here.** The immutable question and marking snapshot is created when a candidate starts an attempt, not when an examiner creates or publishes an examination.
- **Keep the scope focused.** Use the existing Next.js, TypeScript, Drizzle, PostgreSQL and Zod architecture. Keep business rules in server-side feature logic and use database constraints to protect uniqueness and relationships.
- **No bulk import in this phase.** Candidate and question bulk import is a separate secondary feature and should not delay the manual end-to-end setup workflow.

## Acceptance check

1. Sign in as an examiner and create a draft examination with a title, instructions, schedule, duration and relevant settings. Confirm that it appears in the examiner's examination list as a draft.
2. Create one question of each supported type. Confirm that invalid configurations are rejected with useful validation feedback.
3. Edit and organize questions in the question bank. Assign questions to an examination, change their order and marks, and confirm that the examination's total marks are recalculated and persisted correctly.
4. Configure objective question or option randomization. Confirm that the configuration is saved and can be reviewed. Candidate-specific randomized delivery is not expected in this phase.
5. Enroll an existing candidate account. Confirm that the enrollment appears in the examiner's enrollment list and that attempting to enroll the same candidate again is rejected or handled idempotently.
6. Sign in as that candidate. Confirm that the assigned draft examination is not visible and cannot be retrieved through a direct page or API request.
7. Attempt to publish an incomplete examination. The server rejects it and explains which required configuration is missing.
8. Complete the examination configuration and publish it. Confirm that the candidate can now see the examination and its schedule, instructions and availability status, but cannot see questions or answer keys.
9. Attempt to access or modify another examiner's examination and its question or enrollment records by changing route IDs or request payloads. The server denies the operation.
10. Attempt to view an examination as a candidate who is not enrolled. The server denies access even when the candidate knows the examination ID.
11. Test the availability window using server time. An enrolled candidate cannot access an examination before its permitted start or after its permitted availability window.
12. Inspect the database and confirm that examination, question, assignment and enrollment relationships are consistent, with no duplicate enrollment for the same candidate and examination and no attempt created by enrollment.

## Not in this phase

- Starting, resuming or taking an examination.
- Candidate-specific attempt creation and immutable attempt snapshots.
- Candidate answer entry, autosave, navigation, marking for review or submission.
- Countdown timer, expiry handling and automatic submission.
- Network-aware answer synchronization and recovery.
- Active-attempt monitoring, incident recording or examination announcements.
- Automatic grading, manual written-response grading, result review or publication.
- Question analytics, PDF reports or report verification.
- Examination sandbox.
- Bulk candidate or question import.
- Candidate workspace customization or digital scratchpad.
- Advanced examination dispute workflows, AI proctoring or automated misconduct decisions.
