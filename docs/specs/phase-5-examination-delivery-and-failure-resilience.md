Phase 5 — Examination delivery and failure resilience
Goal. A candidate can enter an assigned examination, complete it in a focused workspace, save answers reliably, recover after interruptions and submit without the browser ever becoming the authority for examination state.

This phase turns a published examination into a real assessment experience. It is the most consequential candidate-facing part of Evalify: an incorrect save, deadline or submission decision can compromise the fairness of an examination.

The server remains the source of truth for attempt state, accepted answers and deadlines.
Build
1. Candidate examination entry
- Assigned examinations. Candidates see examinations for which they are enrolled, organized into upcoming, available, in-progress and completed states.
- Examination instructions. Before starting, candidates can inspect the examination title, instructions, duration, total marks, availability window and relevant rules.
- Eligibility checks. Starting an attempt requires an authenticated candidate, a valid enrollment and an examination within its permitted availability window.
- Attempt creation. Starting an examination creates exactly one real attempt for that candidate and examination. Repeated start requests must return the existing attempt rather than create another.
- Attempt initialization. The server records startedAt and expiresAt, assigns the immutable question snapshot and establishes the initial attempt state.
- Returning candidates. If an attempt is already active, entering the examination returns the existing attempt with its original deadline. It never resets the timer.
2. Candidate examination workspace
Build a focused examination interface rather than reusing the examiner's administration dashboard.
- Examination header. Show the examination title, remaining time and connection/save status.
- Question area. Display one question at a time with its question number, content, marks and appropriate answer controls.
- Question navigation. Provide a question navigator that allows candidates to move between questions without losing server-confirmed answers.
- Question states. Clearly distinguish:
  - Unanswered questions.
  - Answered questions.
  - Questions marked for review.
  - Answered questions marked for review.
- Progress overview. Display the number of answered, unanswered and marked-for-review questions.
- Review navigation. Candidates can move between questions and inspect their responses before submission.
- Submission action. Provide an explicit submission action with a confirmation step that communicates the consequences of finalizing an attempt.
The workspace must support all three question types:
- Single-answer MCQ: select exactly one option.
- Multiple-select MCQ: select zero or more options.
- Written response: enter a text response.
Candidate-facing question data must never contain correct answers, marking keys or other grading-only information.
3. Answer persistence and synchronization
Answer persistence is the foundation of this phase.
- Automatic saving. Answer changes are submitted to the server automatically without requiring candidates to press a separate save button.
- Server acknowledgment. An answer is considered saved only after the server confirms that it has accepted and persisted the change.
- Save status. Communicate pending, saving, saved and failed states clearly.
- Safe retries. Interrupted requests can be retried without creating duplicate answers or corrupting existing responses.
- Latest accepted answer. Repeated changes to the same question must not allow an older, delayed request to overwrite a newer accepted response.
- Refresh recovery. Refreshing the page restores the latest server-confirmed answers and attempt state.
- Re-entry recovery. Returning to an active examination restores the existing attempt and its accepted answers.
- Failed changes. If an answer cannot be saved, communicate that it remains unconfirmed. Do not display a false success state.
A local browser change and a server-confirmed answer are two different things. The interface must preserve that distinction.
4. Failure-resilient examination behavior
This is the central innovation of Evalify.
- Connectivity awareness. Detect when the browser loses and regains network connectivity.
- Visible connection state. Inform candidates when they are online, offline or reconnecting.
- Pending changes. Keep track of answer changes that have not received server acknowledgment.
- Retry behavior. Retry interrupted saves safely when connectivity returns.
- Conflict protection. Reconcile pending requests with the latest server-confirmed attempt state rather than blindly overwriting accepted answers.
- Recovery after refresh. Retrieve the attempt from the server and restore its confirmed progress.
- Deadline continuity. The examination clock continues advancing even when the candidate is offline.
- Expiry recovery. If the deadline passes during a disconnection, the server finalizes the attempt. Reconnecting must show the finalized state.
The interface must communicate an important limitation honestly: unacknowledged local changes are not guaranteed to survive device failure or disconnection.

Do not promise full offline examination functionality.
5. Examination timing and expiry
The server owns examination timing.
- Record the authoritative attempt start and expiry timestamps.
- Calculate remaining time using server-provided timestamps.
- Display a countdown in the candidate workspace.
- Synchronize the displayed countdown with authoritative server time.
- Reject answer changes received after the permitted deadline.
- Reject manual submissions that arrive after expiry as new submissions; process them through the same finalization rules as expiry.
- Automatically finalize expired attempts.
- Preserve all answers accepted within the permitted examination period.
- Prevent browser refreshes, reconnects or repeated requests from extending the deadline.
The countdown is a visual representation of the deadline, not an enforcement mechanism.
6. Submission and finalization
- Manual submission. Candidates can explicitly submit their examination before the deadline.
- Confirmation. Before submission, show a summary of answered and unanswered questions and require confirmation.
- Finalization. The server transitions the attempt into a finalized state.
- Automatic submission. An expired active attempt is automatically finalized by the server.
- Idempotency. Repeated submission requests return the existing finalized state.
- Concurrent operations. Answer saving, manual submission and automatic expiry must not produce contradictory attempt states.
- Read-only state. Once finalized, the candidate can inspect the submitted attempt but cannot modify answers.
- Completion feedback. Show whether the examination was submitted manually or finalized because time expired.
Manual submission and automatic expiry must converge on one consistent finalization process.
7. Examination workspace preferences
Introduce the basic candidate workspace customization capability.
- Allow candidates to adjust meaningful viewing preferences, such as comfortable question display density or text size.
- Retain preferences for subsequent examinations.
- Apply preferences without changing question content, marks, examination rules or attempt state.
- Keep the default workspace usable without requiring customization.
This is a usability feature, not a separate theme-building system.
8. Digital scratchpad
Provide a dedicated rough-work area inside the examination workspace.
- Candidates can write and edit notes while answering questions.
- The scratchpad can be opened and closed without losing its current content.
- It must not interfere with question navigation, answer saving or submission.
- Scratchpad content must remain separate from official examination answers and grading.
- Do not expose scratchpad content as a submitted answer.
Keep the implementation lightweight. A full document editor is unnecessary.
Constraints
- The server is the source of truth for attempt state, answers and deadlines.
- An examination permits only one real attempt per candidate.
- Attempt question snapshots are immutable once created.
- Candidate APIs must never expose answer keys or marking schemes.
- Every protected operation must enforce authentication, role and resource-level authorization.
- Answer saving and submission must be safe under repeated and concurrent requests.
- Network interruptions must never extend examination time.
- Sandbox attempts must remain separate from official attempts and results.
- Scratchpad content must never be included in official answers.
- Workspace preferences must never affect examination rules.
- No paid APIs, billing-dependent services or external infrastructure are required.
- Follow the established Evalify visual design system and responsive behavior.
Acceptance checks
The phase is complete when the following behaviors can be demonstrated:
Candidate entry
- [ ] A candidate sees only examinations assigned to them.
- [ ] An unassigned candidate cannot enter an examination by changing its identifier.
- [ ] A candidate cannot start before the permitted availability window.
- [ ] Starting an examination creates one attempt.
- [ ] Repeated start requests do not create duplicate attempts.
- [ ] Returning to an active attempt preserves its original deadline.
Examination workspace
- [ ] All three question types render and accept appropriate responses.
- [ ] Candidates can navigate between questions.
- [ ] Answered, unanswered and marked-for-review states are distinguishable.
- [ ] Progress indicators reflect the actual attempt state.
- [ ] Candidates can review their responses before submission.
- [ ] Correct answers and marking keys are absent from candidate-facing responses.
Saving and recovery
- [ ] Answers are automatically saved.
- [ ] The interface distinguishes pending, accepted and failed changes.
- [ ] Refreshing restores server-confirmed answers.
- [ ] Repeated save requests do not create duplicate records.
- [ ] Older requests cannot overwrite newer accepted answers.
- [ ] Failed saves never produce false success messages.
Failure resilience
- [ ] Connectivity loss is communicated clearly.
- [ ] Connectivity recovery triggers safe retry behavior.
- [ ] Reconnection restores server-confirmed progress.
- [ ] Unconfirmed changes are not represented as saved.
- [ ] Disconnecting does not pause or extend the examination deadline.
- [ ] An attempt that expires offline is finalized by the server.
Submission and timing
- [ ] Candidates can manually submit an active attempt.
- [ ] Submission requires confirmation.
- [ ] Repeated submissions do not create inconsistent states.
- [ ] Expired attempts are automatically finalized.
- [ ] Answers cannot be changed after finalization.
- [ ] Manual submission and expiry cannot produce contradictory states.
Secondary features
- [ ] Workspace preferences persist across examinations.
- [ ] Workspace customization does not change assessment content.
- [ ] The scratchpad supports writing and editing notes.
- [ ] Scratchpad content remains separate from official answers.
- [ ] Sandbox activity does not affect official results.
Security and reliability
- [ ] Candidates cannot access another candidate's attempt or answers.
- [ ] Examiners cannot access attempts outside their authority.
- [ ] Server-side authorization protects all attempt operations.
- [ ] Concurrent save, submit and expiry requests preserve consistent state.
- [ ] Critical deadline and persistence behaviors have automated tests.
Not in this phase
The following capabilities belong to subsequent phases:
- Examiner live monitoring dashboards.
- Candidate activity and incident review.
- Examination announcements.
- Automatic objective grading.
- Manual written-response grading.
- Result calculation and examiner review.
- Result publication and candidate result viewing.
- PDF reports and report verification.
- Bulk candidate and question imports.
- Question performance analytics.
These should build on the attempt and answer records established here rather than introduce competing implementations.