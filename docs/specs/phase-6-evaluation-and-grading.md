Phase 6 — Evaluation and grading
Goal. Examinations that have been submitted can be evaluated consistently, whether answers can be graded automatically or require an examiner's judgment. Examiners can review submissions, award marks, provide feedback, and finalize results without modifying the original examination or candidate responses.

This phase turns completed examination attempts into assessed outcomes. It establishes a reliable grading workflow while keeping objective marking separate from human evaluation.
Build
- Submission queue. Examiners can access submitted attempts that require evaluation. The queue provides useful context, including examination, candidate, submission time, evaluation status, and outstanding work. Examiners can filter and search submissions without accessing attempts outside their authorization.

- Automatic grading. Objective questions are evaluated against the answer keys stored in the examination's published question snapshots. Single-choice and multiple-choice questions receive marks according to their configured marking rules. Automatic grading must not depend on the current question-bank version.

- Manual grading. Written responses are presented to examiners in a focused evaluation workspace. Examiners can review the original question, its marking criteria, the candidate's submitted response, maximum marks, and any relevant examination instructions. They can award marks and provide question-level feedback.

- Marking criteria. Questions that require manual evaluation can include marking guidelines or rubrics. These help examiners apply consistent standards without forcing every question into an unnecessarily complex grading model.

- Evaluation progress. An examination's submissions have clear evaluation states. Examiners can distinguish between automatically graded, awaiting manual evaluation, partially evaluated, and fully evaluated attempts.

- Marks calculation. The system calculates awarded marks from individual question evaluations and applies the examination's configured scoring rules. Examiners can see the breakdown between automatically awarded and manually awarded marks.

- Review and correction. Authorized examiners can revisit an evaluation before it is finalized, correct awarded marks, and update feedback. Changes must be recorded so that evaluation history remains traceable.

- Evaluation finalization. An examiner can finalize a completed evaluation. Finalization records the resulting score and prevents ordinary editing of the evaluation. Any subsequent correction must follow an explicitly authorized correction process.

- Evaluation ownership. The system records which examiner performed each evaluation and who finalized it. Where multiple examiners have access to the same examination, the system must prevent conflicting evaluation updates.

- Evaluation history. The system preserves an auditable record of grading activity, including awarded marks, feedback changes, evaluation status transitions, and finalization.
Constraints
- The submitted attempt and its question snapshots are immutable evaluation inputs. Grading must never modify candidate answers or the original examination.
- Automatic grading must use the answer key and marking rules captured in the published examination snapshot.
- Manual grading must validate awarded marks against the maximum marks configured for the question.
- The server is the source of truth for all scores, evaluation states, and finalization decisions.
- Score calculations must be performed on the server. Client-submitted totals must never be trusted.
- Evaluation operations must enforce examiner permissions and examination-level access.
- Concurrent evaluation changes must not silently overwrite one another.
- Retrying an evaluation or finalization request must not create duplicate evaluation records or duplicate state transitions.
- Finalized evaluations must not be editable through ordinary grading operations.
- Evaluation history must remain attributable to the user responsible for each change.
- The system must distinguish between an unanswered question and an answer that has not yet been evaluated.
- A submission must not be considered fully evaluated while any required manual grading remains outstanding.
- Automatic grading must be deterministic and independently testable.
- AI-generated grading suggestions, if introduced later, must never become authoritative marks without an explicitly authorized human decision.
Acceptance check
- An examiner can find submitted attempts that require evaluation.
- Objective questions are graded using the published examination's answer keys and marking rules.
- Written responses can be evaluated individually with awarded marks and feedback.
- The system rejects marks outside the permitted range.
- Partially evaluated attempts are distinguishable from fully evaluated attempts.
- Total marks are calculated correctly from individual question evaluations.
- Examiners cannot access or evaluate submissions belonging to examinations they are not authorized to manage.
- Concurrent grading changes cannot silently overwrite another examiner's work.
- An examiner can finalize a completed evaluation, and ordinary grading operations can no longer modify it.
- Evaluation changes and finalization actions are recorded in an auditable history.
- Retrying grading or finalization requests does not produce duplicate results.
- The candidate's original submitted answers remain unchanged throughout evaluation.
Not in this phase
- Candidate-facing result publication and result visibility.
- Result analytics, performance reports, and examination statistics.
- Re-evaluation requests, appeals, and formal review workflows.
- AI-assisted grading or automatic assessment of written responses.
- Plagiarism detection and similarity analysis.
- Advanced examiner assignment and multi-stage moderation workflows.
- Grade curves, normalization, and institution-wide grading policies.
- Certificates and downloadable transcripts.
- Examination creation, question-bank management, and candidate examination delivery (already covered in earlier phases).