# Phase 3 — Examination attempts and candidate delivery

**Goal.** An enrolled candidate can start an available examination, complete it in a focused examination workspace, and submit it before the server-enforced deadline. Their assigned questions and marking rules remain fixed for the attempt, and the system restores the last server-confirmed progress if the candidate refreshes or loses connectivity.

## Build

- **Starting an attempt.** An enrolled candidate can start an examination only while it is available. Starting creates the candidate's one permitted real attempt. Repeated start requests return the existing attempt rather than creating another one.
- **Attempt snapshot.** At start, assign and persist the exact questions, question content, options, order, marks and marking rules for that candidate. Apply the examination's configured question and option randomization when creating the snapshot. Later edits to the question bank or examination must not alter an existing attempt.
- **Candidate-safe question delivery.** Return only the question content and information needed to answer. Correct answers, marking keys and private examiner data must never be included in candidate-facing responses.
- **Examination workspace.** Present the current question, its marks, the remaining time and clear navigation between questions. Provide a question overview that distinguishes unanswered, answered and marked-for-review questions.
- **Answering.** Support the three configured question types: one selected option for single-answer MCQs, a selected set for multiple-select questions, and text for written responses. Validate answer shape and question membership on the server.
- **Navigation and review.** Candidates can move between questions, change answers while the attempt is active, mark or unmark questions for review, and inspect their progress before submission. Review status is attempt-specific and does not change an answer's grading.
- **Automatic saving.** Persist answer changes during the attempt. Clearly distinguish pending changes, changes confirmed by the server and failed saves. A local browser change must never be described as saved until the server confirms it.
- **Recovery.** Refreshing the page or returning to an active attempt restores its persisted question order, answers, review markers and authoritative remaining time. After reconnection, the client reconciles with server-confirmed state rather than assuming unacknowledged local changes were saved.
- **Timer and expiry.** The server records the attempt start time and deadline. The workspace displays a countdown derived from server-provided timing information, but the browser clock never decides whether an answer or submission is accepted. The server finalizes an attempt when its deadline expires.
- **Manual submission.** Candidates can review their progress and explicitly submit. Provide a clear confirmation step before final submission and show the resulting finalized state.
- **Finalized attempt.** Once submitted or expired, the attempt becomes read-only. A candidate returning later sees its final status and cannot restart it, change answers or receive additional time.
- **Failure-resilient interaction.** Detect and communicate connectivity changes, retry interrupted answer saves safely, and show when synchronization is pending or has failed. The interface must explain that unconfirmed local changes are not guaranteed to survive a device or connectivity failure.
- **Scratchpad.** Provide a usable, attempt-associated rough-work area within the examination workspace. Scratchpad content must not be treated as an answer or affect marks. Its persistence behavior must be clear to the candidate.
- **Access boundaries.** Candidates can access only their own eligible attempts. Examiners can access attempt records only for examinations within their authority. Every attempt and answer operation checks these relationships on the server.

## Constraints

- **One real attempt.** Enforce one real attempt per candidate and examination at the database and service levels. Enrollment is not an attempt, and retrying a start request must not create a second attempt.
- **Snapshot at start.** The attempt snapshot is the authoritative source for the questions, displayed order, marks and grading rules used throughout that attempt. Do not read mutable question-bank content to reconstruct an active attempt.
- **Server-owned timing.** Store authoritative start and expiry timestamps. The examination duration determines the attempt deadline after a valid start; the availability window controls whether the candidate may start. A disconnection, refresh, hidden tab or client clock change must not pause or extend the deadline.
- **Define one finalization path.** Manual submission and expiry must converge on one atomic, idempotent finalization operation. If they race, only one finalized state is persisted. The finalized attempt contains only answers accepted by the server within the permitted period.
- **Enforce answer deadlines.** Accept an answer only while the attempt is active and the server receives it before the deadline. Reject changes after finalization or expiry, even if the browser still displays an active countdown.
- **Safe repeated saves.** Saving the same answer repeatedly must not create duplicate answer records. Handle overlapping or out-of-order requests so an older request cannot silently overwrite a newer accepted answer.
- **Server-confirmed recovery.** Persist answers and review markers on the server. Do not treat browser memory, local storage or an offline queue as authoritative examination progress. A retry must not create duplicate or contradictory state.
- **Keep answer keys private.** Candidate routes, server-rendered payloads, client bundles and API responses must not expose correct answers or marking rules that reveal them.
- **Validate by snapshot.** Validate each answer against the question type and options in that attempt's snapshot, not against a subsequently edited question-bank record.
- **Scratchpad isolation.** Scratchpad content is not a submitted answer, is not graded and is not included in official result calculations. Do not imply persistence unless it is actually implemented and confirmed.
- **No offline-time advantage.** The application does not pause the clock, grant grace time or accept late answers because of network or device failure. The UI must communicate this honestly.
- **Use the agreed architecture.** Keep business rules in server-side services, validate untrusted input with Zod, and enforce persistence constraints in PostgreSQL through Drizzle. Use the agreed Next.js App Router and TypeScript stack.
- **Preserve phase boundaries.** This phase creates and finalizes attempts but does not implement examiner monitoring, grading workflows or result publication.

## Acceptance check

1. An enrolled candidate can start an available examination. A candidate who is not enrolled, or who attempts to start before or after the permitted start window, is denied by the server.
2. Repeating or concurrently sending the start request results in exactly one real attempt for that candidate and examination.
3. Starting an attempt creates a persisted snapshot containing its assigned questions, content, options, order, marks and marking rules. Configured randomization is reflected in that snapshot.
4. Editing or deleting a question-bank item after an attempt starts does not change the active attempt's displayed questions, options, order or marks.
5. Candidate-facing page data and API responses contain no correct answers, answer keys or private examiner fields.
6. The candidate can answer each supported question type, navigate between questions, change an answer while the attempt is active, and mark or unmark questions for review.
7. The question overview accurately reflects answered, unanswered and marked-for-review states after navigation and refresh.
8. Answer changes are persisted automatically. The interface visibly distinguishes pending, server-confirmed and failed saves, and never labels an unconfirmed change as saved.
9. Refreshing or reopening an active attempt restores its original question order, last server-confirmed answers, review markers and remaining time.
10. Simulate a disconnected save followed by reconnection. The system retries safely, reconciles with server state, and does not create duplicate answers or overwrite a newer accepted answer with an older request.
11. Change the browser clock and manipulate the client countdown. Neither action changes the server's acceptance of answers or the attempt deadline.
12. An answer received by the server before the deadline can be accepted; an answer received after expiry or after finalization is rejected.
13. Manual submission finalizes the attempt and makes it read-only. Repeating submission returns the same final state without creating another submission.
14. Allow the deadline to expire. The server finalizes the attempt using only answers accepted within the permitted period. A simultaneous manual submission and expiry cannot produce conflicting final states.
15. Returning after submission or expiry shows the finalized attempt and does not issue a new timer or allow answer changes.
16. Scratchpad use does not alter answers, marks or grading data. Its persistence or non-persistence is communicated accurately.
17. Attempts and answers cannot be accessed or changed by another candidate through identifier manipulation. An examiner cannot access attempts belonging to an examination outside their authority.
18. Database constraints and server-side validation prevent duplicate attempt-question answers and invalid answer shapes.

## Not in this phase

- Examiner live monitoring dashboards, attempt activity feeds or incident review.
- Examiner announcements during an examination.
- Objective auto-grading or manual grading of written responses.
- Examiner result review, result publication or candidate result views.
- Examination-level or question-level analytics.
- PDF reports or report verification.
- Examination sandbox and sandbox-attempt isolation.
- Bulk candidate or question import.
- Candidate workspace preference customization beyond the functional examination layout.
- AI proctoring, face recognition, automated misconduct verdicts or automatic penalties.
- Full offline examination completion, offline submission, paused timers or deadline extensions.
- Multiple real attempts, retakes or candidate-requested resets.