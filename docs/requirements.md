# Evalify — Requirements

## 1. Purpose of this document

This document defines the functional and non-functional requirements for Evalify. It translates the approved product decisions in `project-doc.md` and the Web-e-Thon problem statement into requirements that can be implemented and verified.

It defines **what the system must do**, not the detailed implementation plan for each feature. Feature specifications will be written and approved one at a time using the format agreed by the team. A feature specification may add implementation detail, but it must not contradict these requirements or the product decisions in `project-doc.md`.

Requirement identifiers are stable references for feature specifications, implementation discussions and testing.

## 2. Product scope

Evalify is a responsive web application for institutions and competition organizers to create, conduct, monitor and evaluate online examinations.

The system supports three account roles:

- **Administrator (`ADMIN`)** — manages user accounts, role assignments and platform access.
- **Examiner (`EXAMINER`)** — prepares examinations and questions, enrolls candidates, monitors attempts, evaluates submissions, reviews and publishes results.
- **Candidate (`CANDIDATE`)** — accesses assigned examinations, completes and submits attempts, and views their own published results.

The system must support the complete examination lifecycle and all eight secondary features listed in this document. The selected innovation challenge is **Failure-Resilient Examinations**.

## 3. Terminology

| Term | Meaning |
|---|---|
| Examination | An assessment configured by an examiner, with instructions, schedule, duration, marks, questions and eligible candidates. |
| Question bank | The reusable collection of questions maintained for examination creation. |
| Enrollment | The record that a candidate is eligible to take a particular examination. Enrollment is separate from an attempt. |
| Attempt | A candidate's single real sitting of an examination. |
| Attempt snapshot | The fixed questions, question content, options, order, marks and marking rules assigned when an attempt starts. |
| Answer | A candidate's response to a question in an attempt. |
| Server-confirmed answer | An answer accepted and persisted by the server. A local browser change alone is not server-confirmed. |
| Sandbox attempt | An examiner's preview attempt, isolated from official submissions, grading, results and analytics. |
| Incident | A recorded examination event or signal made available to an examiner for review. It is not, by itself, proof of misconduct. |
| Published result | A result that has passed the required grading and examiner review steps and has explicitly been released to candidates. |

## 4. Functional requirements

### 4.1 Authentication and authorization

| ID | Requirement |
|---|---|
| FR-AUTH-01 | The system shall provide secure authentication for administrators, examiners and candidates. |
| FR-AUTH-02 | The system shall associate each account with one of the roles `ADMIN`, `EXAMINER` or `CANDIDATE`. |
| FR-AUTH-03 | Administrators shall be able to manage user accounts and assign roles. |
| FR-AUTH-04 | The system shall provide role-appropriate access and experiences for administrators, examiners and candidates. |
| FR-AUTH-05 | The backend shall authorize every protected operation. Hiding a page, button or control in the client interface shall not be treated as authorization. |
| FR-AUTH-06 | Examiners shall be able to access only examinations, candidates, attempts, records and actions within their authority. |
| FR-AUTH-07 | Candidates shall be able to access only examinations for which they are eligible and their own attempts, answers and published results. |
| FR-AUTH-08 | The system shall reject access to protected data and actions when the user is unauthenticated or lacks the required role or resource-level permission. |
| FR-AUTH-09 | Passwords shall be stored as secure hashes and shall never be stored as plaintext. |
| FR-AUTH-10 | Authenticated sessions shall use opaque random session credentials delivered through appropriately protected HTTP-only cookies. The database shall store a hash of the session credential rather than its raw value. |

### 4.2 Examination management

| ID | Requirement |
|---|---|
| FR-EXAM-01 | Examiners shall be able to create examinations. |
| FR-EXAM-02 | An examination shall support a title, instructions, schedule, duration, total marks and relevant examination settings. |
| FR-EXAM-03 | The system shall support the examination lifecycle states `DRAFT`, `PUBLISHED`, `ONGOING` and `COMPLETED`. |
| FR-EXAM-04 | Examiners shall be able to review examination details before publication. |
| FR-EXAM-05 | Examiners shall be able to manage examinations within their authority. |
| FR-EXAM-06 | Candidates shall not be able to access an examination before its permitted availability window. |
| FR-EXAM-07 | The system shall enforce examination availability and timing rules on the server. |
| FR-EXAM-08 | Publishing an examination shall not allow an unassigned candidate to enter it. Candidate eligibility shall also be checked. |

### 4.3 Question management

| ID | Requirement |
|---|---|
| FR-QUESTION-01 | The system shall provide a reusable question bank. |
| FR-QUESTION-02 | Questions shall support categories or topics and difficulty levels. |
| FR-QUESTION-03 | Examiners shall be able to create and edit questions and assign questions to examinations. |
| FR-QUESTION-04 | The system shall support single-answer multiple-choice questions. |
| FR-QUESTION-05 | The system shall support multiple-select questions. |
| FR-QUESTION-06 | The system shall support written-response questions. |
| FR-QUESTION-07 | Each supported question type shall have an appropriate marking scheme. |
| FR-QUESTION-08 | The system shall allow objective questions or answer choices to be randomized where applicable. |
| FR-QUESTION-09 | When an attempt starts, the system shall preserve an immutable snapshot of the questions, question content, options, order, marks and marking rules assigned to that attempt. |
| FR-QUESTION-10 | Editing a question-bank item after an attempt starts shall not change the content or marking rules in that active attempt's snapshot. |
| FR-QUESTION-11 | Candidate-facing data and APIs shall not expose correct answers or marking keys. |

### 4.4 Candidate and enrollment management

| ID | Requirement |
|---|---|
| FR-CAND-01 | Examiners shall be able to enroll candidates in examinations. |
| FR-CAND-02 | Examiners shall be able to view enrollment information for examinations within their authority. |
| FR-CAND-03 | Candidates shall be able to view their available, upcoming and completed examinations. |
| FR-CAND-04 | Candidate examination listings shall communicate relevant instructions and access status. |
| FR-CAND-05 | The system shall restrict examination entry to enrolled or otherwise eligible candidates. |
| FR-CAND-06 | The system shall prevent a candidate from starting an examination outside its permitted availability window. |
| FR-CAND-07 | Enrollment shall be represented separately from an examination attempt. |
| FR-CAND-08 | The initial release shall permit no more than one real attempt for a given candidate and examination. |

### 4.5 Examination delivery and attempt management

| ID | Requirement |
|---|---|
| FR-DELIVERY-01 | The system shall provide an examination workspace for candidates with access to questions, marks, remaining time and question navigation controls. |
| FR-DELIVERY-02 | The workspace shall distinguish answered, unanswered and marked-for-review questions. |
| FR-DELIVERY-03 | Candidates shall be able to navigate between questions and review their progress before submission. |
| FR-DELIVERY-04 | The system shall automatically save candidate answers during an active attempt. |
| FR-DELIVERY-05 | The interface shall distinguish answer changes that are pending, accepted by the server or failed. |
| FR-DELIVERY-06 | The system shall restore the last server-confirmed answers and attempt state when a candidate refreshes the page or returns to an active attempt. |
| FR-DELIVERY-07 | The system shall allow a candidate to submit an active attempt. |
| FR-DELIVERY-08 | The system shall finalize an attempt automatically when its permitted time expires. |
| FR-DELIVERY-09 | The server shall record the authoritative attempt start time and expiry time. The browser clock and client-side countdown shall not determine whether answers or submissions are accepted. |
| FR-DELIVERY-10 | The server shall accept an answer only when the attempt is active and the answer is received within the permitted examination time. |
| FR-DELIVERY-11 | The server shall reject answer changes after an attempt has been finalized or its permitted time has expired. |
| FR-DELIVERY-12 | Manual submission and automatic expiry finalization shall result in one consistent finalized attempt state. |
| FR-DELIVERY-13 | Repeated save or submission requests shall not create duplicate answers, duplicate attempts or contradictory final states. |
| FR-DELIVERY-14 | The finalized attempt shall contain the answers accepted by the server within the permitted period. |
| FR-DELIVERY-15 | A candidate returning after the deadline shall see the finalized attempt state and shall not receive a new timer or additional time. |

### 4.6 Examination monitoring and communication

| ID | Requirement |
|---|---|
| FR-MON-01 | Examiners shall be able to view active attempts for examinations within their authority. |
| FR-MON-02 | The monitoring interface shall show candidate progress and relevant examination status. |
| FR-MON-03 | The system shall record relevant examination events or incidents and make them available to authorized examiners for review. |
| FR-MON-04 | Examiners shall be able to send announcements to candidates during an examination. |
| FR-MON-05 | Announcements shall be associated with the relevant examination and its eligible candidates. |
| FR-MON-06 | The system shall not present a browser event or monitoring indicator as conclusive evidence of misconduct. |
| FR-MON-07 | The system shall not automatically penalize a candidate or declare misconduct solely because of a recorded monitoring event. |

### 4.7 Evaluation and grading

| ID | Requirement |
|---|---|
| FR-GRADE-01 | The system shall automatically grade objective responses according to the marking scheme assigned to the attempt. |
| FR-GRADE-02 | Single-answer multiple-choice responses shall be evaluated against the correct answer in the attempt's marking snapshot. |
| FR-GRADE-03 | Multiple-select responses shall use exact-set matching: the submitted selection must match the configured correct set to receive the question's marks. |
| FR-GRADE-04 | The system shall allow examiners to review and manually grade written responses. |
| FR-GRADE-05 | The system shall validate that a manually awarded mark is not less than zero and does not exceed the question's assigned maximum marks. |
| FR-GRADE-06 | The system shall calculate examination totals consistently from the attempt snapshot, accepted answers and awarded marks. |
| FR-GRADE-07 | A result containing written-response questions shall not be ready for publication until all required written responses have been manually graded. |
| FR-GRADE-08 | Examiners shall be able to review results before publication. |
| FR-GRADE-09 | Attempt completion, grading completion, examiner review and result publication shall remain distinguishable states or steps. |

### 4.8 Results and examination analytics

| ID | Requirement |
|---|---|
| FR-RESULT-01 | Examiners shall be able to publish results through an explicit, controlled action. |
| FR-RESULT-02 | Candidates shall be able to view only their own results after those results have been published. |
| FR-RESULT-03 | Candidates shall not be able to view calculated but unpublished results. |
| FR-RESULT-04 | Examiners shall be able to view examination-level performance summaries based on actual submission data. |
| FR-RESULT-05 | Examiners shall be able to view candidate-level scores for examinations within their authority. |
| FR-RESULT-06 | The system shall retain completed attempts and their results for later review by authorized users. |

## 5. Secondary feature requirements

All eight secondary features are expected. Each must provide working functionality integrated with the application. A visual placeholder or non-functional control does not satisfy a requirement.

### 5.1 Network-aware interface

| ID | Requirement |
|---|---|
| FR-NET-01 | The candidate interface shall detect and communicate connectivity problems. |
| FR-NET-02 | The interface shall communicate the current answer-saving or synchronization state. |
| FR-NET-03 | The interface shall make pending, server-accepted and failed answer changes distinguishable. |
| FR-NET-04 | The system shall safely retry interrupted answer-save requests. |
| FR-NET-05 | After reconnection or return to an attempt, the system shall restore server-confirmed progress. |
| FR-NET-06 | A network interruption shall not pause the server's examination clock or extend the attempt deadline. |
| FR-NET-07 | The interface shall not claim that an unacknowledged local answer change has been saved. |

### 5.2 PDF report generation

| ID | Requirement |
|---|---|
| FR-PDF-01 | The system shall generate downloadable PDF reports using actual examination and candidate performance data. |
| FR-PDF-02 | Generated reports shall be readable and suitable for review. |
| FR-PDF-03 | Report generation and access shall enforce the authorization rules applicable to the underlying examination and result data. |

### 5.3 Examination sandbox

| ID | Requirement |
|---|---|
| FR-SAND-01 | Examiners shall be able to preview an examination and experience it as a candidate. |
| FR-SAND-02 | The system shall distinguish sandbox attempts from real examination attempts. |
| FR-SAND-03 | Sandbox attempts shall not affect official submissions, grading, results or examination statistics. |

### 5.4 Bulk data import

| ID | Requirement |
|---|---|
| FR-IMPORT-01 | The system shall support importing candidate records from a structured CSV or JSON file. |
| FR-IMPORT-02 | The system shall support importing questions from a structured CSV or JSON file. |
| FR-IMPORT-03 | The system shall validate imported data before committing records. |
| FR-IMPORT-04 | The system shall communicate invalid rows or fields clearly so that the user can identify and correct import problems. |
| FR-IMPORT-05 | The system shall not silently present a partially invalid import as a complete successful import. |

### 5.5 Question analytics

| ID | Requirement |
|---|---|
| FR-QAN-01 | The system shall provide useful performance insights for individual questions using actual examination response data. |
| FR-QAN-02 | Question insights shall include relevant measures such as frequently skipped questions, commonly incorrect responses or observed question difficulty. |
| FR-QAN-03 | Question analytics shall exclude sandbox attempts and shall not use placeholder values presented as real examination statistics. |
| FR-QAN-04 | The interface shall not imply that the available response data proves more than it can establish. |

### 5.6 Verifiable reports

| ID | Requirement |
|---|---|
| FR-VERIFY-01 | The system shall provide a verification mechanism for issued result reports. |
| FR-VERIFY-02 | Each issued report shall have a unique verification identifier or equivalent QR-based verification mechanism. |
| FR-VERIFY-03 | A verification request shall confirm the authenticity of the issued report. |
| FR-VERIFY-04 | Report verification shall not expose unnecessary candidate or assessment information. |

### 5.7 Customizable examination workspace

| ID | Requirement |
|---|---|
| FR-WORKSPACE-01 | Candidates shall be able to customize meaningful examination workspace preferences, such as layout or viewing settings. |
| FR-WORKSPACE-02 | The system shall retain a candidate's workspace preferences for subsequent use. |
| FR-WORKSPACE-03 | Workspace preferences shall not change examination rules, assigned questions, marks or the content being assessed. |

### 5.8 Digital scratchpad

| ID | Requirement |
|---|---|
| FR-SCRATCH-01 | The examination workspace shall provide candidates with a dedicated digital scratchpad for rough work. |
| FR-SCRATCH-02 | The scratchpad shall be usable during the examination workflow. |
| FR-SCRATCH-03 | Scratchpad interaction shall not interfere with answer saving or attempt submission. |

## 6. Innovation requirements: Failure-Resilient Examinations

The selected innovation challenge is **Failure-Resilient Examinations**. The system shall reduce the impact of connectivity interruptions, refreshes and interrupted requests without granting additional examination time or an unfair advantage.

| ID | Requirement |
|---|---|
| FR-RESILIENCE-01 | The system shall make connectivity and answer-save state visible to the candidate during an attempt. |
| FR-RESILIENCE-02 | The system shall safely retry interrupted saves and prevent retries from creating duplicate or contradictory answer state. |
| FR-RESILIENCE-03 | The system shall restore the last server-confirmed attempt state when a candidate refreshes or returns. |
| FR-RESILIENCE-04 | The server's examination deadline shall continue to advance during a candidate's disconnection. |
| FR-RESILIENCE-05 | Reconnection shall not pause, reset or extend the examination deadline. |
| FR-RESILIENCE-06 | At expiry, the system shall finalize the attempt using only answers accepted by the server within the permitted period. |
| FR-RESILIENCE-07 | The interface shall communicate honestly that unacknowledged local changes are not guaranteed to survive a device or connectivity failure. |

The system is not required to support completing and submitting an entire examination while fully offline.

## 7. Non-functional requirements

### 7.1 Security and privacy

| ID | Requirement |
|---|---|
| NFR-SEC-01 | All protected data and operations shall be subject to server-side authentication and authorization checks. |
| NFR-SEC-02 | Authorization shall consider both the user's role and their relationship to the requested resource, including the relevant examination, enrollment, attempt or ownership. |
| NFR-SEC-03 | Credentials, session tokens, answer keys, personal information and examination records shall be protected from unauthorized access. |
| NFR-SEC-04 | Candidate-facing responses shall not contain correct answers or marking keys, even when those values are hidden in the user interface. |
| NFR-SEC-05 | Reports and report-verification responses shall expose only information the requesting user is authorized to access and that is necessary for the report or verification purpose. |
| NFR-SEC-06 | Passwords and session credentials shall be handled according to FR-AUTH-09 and FR-AUTH-10. |

### 7.2 Data integrity and consistency

| ID | Requirement |
|---|---|
| NFR-DATA-01 | The server shall be authoritative for examination timing and attempt expiry. |
| NFR-DATA-02 | The system shall preserve the question and marking snapshot assigned to an attempt. |
| NFR-DATA-03 | The system shall prevent duplicate real attempts for the same candidate and examination in the initial release. |
| NFR-DATA-04 | The system shall prevent duplicate answers for the same attempt question. |
| NFR-DATA-05 | Starting, saving, submitting, grading and other state-changing operations shall preserve consistent state when requests are repeated or overlap. |
| NFR-DATA-06 | Manual submission and automatic expiry finalization shall not result in conflicting finalized states. |
| NFR-DATA-07 | Sandbox attempts shall remain excluded from official grading, results and analytics. |
| NFR-DATA-08 | Calculated scores shall be derived from persisted attempt data, accepted answers and the applicable marking snapshot. |

### 7.3 Reliability and failure handling

| ID | Requirement |
|---|---|
| NFR-REL-01 | The system shall handle interrupted requests, page refreshes and repeated actions without creating contradictory examination state. |
| NFR-REL-02 | The system shall provide clear feedback when an operation fails or an answer has not been confirmed as saved. |
| NFR-REL-03 | Retrying an interrupted save or submission shall not create duplicate records or extend an examination deadline. |
| NFR-REL-04 | The system shall restore server-confirmed attempt progress when a candidate returns to an active or finalized attempt. |
| NFR-REL-05 | Required functionality shall not depend on paid APIs, paid API keys, proprietary datasets, specialized hardware or external services that require billing information. |

### 7.4 Validation

| ID | Requirement |
|---|---|
| NFR-VAL-01 | Untrusted input shall be validated on the frontend and backend. |
| NFR-VAL-02 | The system shall reject invalid data and communicate validation failures clearly. |
| NFR-VAL-03 | Imported records and manually awarded marks shall be validated before they affect persisted examination data or results. |
| NFR-VAL-04 | The system shall enforce applicable data constraints so invalid or duplicate state cannot be introduced solely by repeating a request. |

### 7.5 Usability, accessibility and responsive behavior

| ID | Requirement |
|---|---|
| NFR-UX-01 | Each role shall be presented with navigation and actions appropriate to its responsibilities. |
| NFR-UX-02 | The candidate examination workspace shall make the question, marks, remaining time, navigation state, saving status and submission action easy to locate. |
| NFR-UX-03 | Important states shall be communicated clearly and shall not rely on colour alone. |
| NFR-UX-04 | The interface shall use clear information hierarchy, consistent interactions, readable typography and sufficient contrast. |
| NFR-UX-05 | Interactive controls shall support keyboard access. |
| NFR-UX-06 | The application shall provide responsive layouts suitable for the web devices on which it is used. |
| NFR-UX-07 | The examination workspace shall avoid distracting visual effects and keep the scratchpad and workspace preferences secondary to the examination content. |
| NFR-UX-08 | The application shall not present non-functional placeholders as completed features. |

### 7.6 Architecture and maintainability

| ID | Requirement |
|---|---|
| NFR-ARCH-01 | The application shall use a modular-monolith architecture with one deployable web application and one PostgreSQL database. |
| NFR-ARCH-02 | The application shall use Next.js 16 App Router and TypeScript. |
| NFR-ARCH-03 | PostgreSQL shall be used for persistent relational data, with Drizzle ORM for schema definition, queries and migrations. |
| NFR-ARCH-04 | Zod shall be used to validate untrusted application input at appropriate boundaries. |
| NFR-ARCH-05 | The interface shall use Tailwind CSS and shadcn/ui. |
| NFR-ARCH-06 | Business rules shall reside in server-side feature or service logic rather than React components. |
| NFR-ARCH-07 | Data access shall be separated from presentation and organized behind appropriate data-access modules. |
| NFR-ARCH-08 | The application shall expose its REST-style API through Next.js Route Handlers under `/api/v1`. |
| NFR-ARCH-09 | The system shall be structured into clear feature boundaries for authentication and access, examination administration, question bank, candidate and enrollment management, examination delivery, monitoring, grading and results/reporting. |
| NFR-ARCH-10 | The application shall be deployable to the agreed Vercel hosting target. |

## 8. Out of scope for this release

The following capabilities are explicitly excluded from the current release. They shall not be introduced implicitly by a feature specification or implementation choice.

- AI-based proctoring, face recognition or automated misconduct verdicts.
- AI grading of written responses.
- Guaranteed full offline examination completion and submission.
- Pausing or extending examination time because of a network outage.
- Multiple real attempts or retakes for the same candidate and examination.
- Partial-credit marking for multiple-select questions; exact-set matching applies.
- Live video surveillance, screen recording or biometric data collection.
- Native mobile applications; the deliverable is a responsive web application.
- External learning-management-system integrations, payments and institutional billing.
- Microservices, separate worker fleets and required paid or billing-dependent services.

Any proposal to add an excluded capability requires an explicit scope decision and an update to the project documentation before implementation.

## 9. Acceptance expectations

The requirements will be considered implemented only when the following end-to-end behaviors can be demonstrated using the application and test data:

1. An administrator can manage accounts and roles, and unauthorized users are prevented from accessing protected operations and records.
2. An examiner can create and configure an examination, prepare questions of all three supported types, enroll candidates, review the examination and publish it.
3. A candidate sees assigned examinations, cannot enter before the permitted window, and cannot access another candidate's attempts, answers or results by changing an identifier.
4. An active attempt retains its assigned question and marking snapshot, and candidate-facing data contains no answer keys.
5. A candidate can answer, navigate, mark questions for review, refresh or return, see server-confirmed progress and submit an attempt.
6. The server enforces the deadline independently of the browser clock, safely handles expiry and does not grant extra time after disconnection.
7. Repeated saves, submissions and overlapping save/submit/expiry requests do not create duplicate or contradictory state.
8. The interface accurately communicates connectivity and pending, accepted and failed answer changes.
9. Examiners can monitor active attempts, inspect incidents and send announcements. Incident indicators are not treated as conclusive proof of misconduct.
10. Objective responses are automatically graded according to the assigned marking scheme; multiple-select responses use exact-set matching; written responses can be manually graded within their permitted marks.
11. Candidates cannot view results until required grading and examiner review are complete and the result has been explicitly published.
12. All eight secondary features work with real application data. Sandbox activity does not affect official results or analytics.
13. PDF reports contain actual data and respect access permissions. Report verification confirms authenticity without unnecessary disclosure.
14. Bulk imports validate data and communicate invalid records. Question analytics are based on real examination responses.
15. The application can be deployed and demonstrated end to end using fictional or test accounts for all three roles. The repository includes setup instructions, dependencies, role-based test credentials and an explanation of the innovation challenge.

## 10. Competition constraints and evaluation context

The system is being developed for a ten-hour hackathon by a team of three. The deliverables are a Git repository containing the application and its version history, and a deployed, functional web application. The README must include setup instructions, required dependencies, test credentials for each role and a description of the implemented innovation challenge.

Required functionality must not rely on paid APIs, paid API keys or services that require billing information. The application must be demonstrable with fictional or test data. No commits, pushes, builds or deployments may be made after the official competition deadline.

The competition evaluation is weighted as follows:

| Evaluation category | Weight |
|---|---:|
| Core functionality | 30% |
| Secondary features | 15% |
| Technical quality and reliability | 20% |
| Open innovation challenge | 15% |
| UI/UX and product design | 20% |
| **Total** | **100%** |

All eight secondary features are expected. Non-functional placeholders do not receive full functional credit. The final demonstration is 15 minutes and should show an integrated examination lifecycle rather than disconnected screens.

## 11. Decisions intentionally left to feature specifications

The following details are not fully prescribed by the competition problem statement or current project decisions. They should be resolved in the relevant feature specification before implementation, without weakening any requirement above:

- Exact examination schedule-boundary behavior, including the relationship between the examination availability window and an individual attempt's duration.
- The exact editable fields and permitted lifecycle transitions for an examination after publication or after attempts have started.
- The exact import behavior when a file contains both valid and invalid rows, including whether valid rows can be committed independently.
- The precise incident event types and the context shown to an examiner.
- The formulas and minimum data conditions used for each question-analytics measure.
- The fields, layout and audience for each PDF report type and the public information returned by report verification.
- The exact set of candidate workspace preferences retained by the application.
- The scratchpad's content model and persistence behavior.
- The exact screens and navigation layout for each role.

These are implementation-level decisions to be made deliberately in the corresponding specifications. Until resolved, contributors must not assume behavior that changes examination fairness, authorization, data integrity or the scope defined above.
