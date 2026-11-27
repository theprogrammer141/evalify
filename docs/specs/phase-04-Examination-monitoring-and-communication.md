Phase 4 — Examination monitoring and communication
Goal. Examiners can understand what is happening during an active examination, monitor candidate progress, review relevant incidents and communicate important information to candidates without interfering with their attempts.

This phase builds the examiner's operational view of an examination while it is running. It builds on the attempt and delivery system from Phase 3. It does not introduce automated proctoring or attempt to determine whether a candidate is cheating.
Build
- Examiner monitoring dashboard. Examiners can open a published examination and view its live operational status. The dashboard shows the total number of enrolled candidates, candidates who have started, candidates who have submitted, candidates whose attempts have expired, and candidates who have not started.

- Active attempt overview. Examiners can inspect individual candidate attempts, including the candidate's identity, attempt status, start time, remaining time, submission state and question progress. Progress information is read-only; examiners cannot modify candidate answers through the monitoring interface.

- Candidate progress. Show how many questions each candidate has answered, left unanswered or marked for review. Progress must come from persisted attempt data rather than assumptions based on browser activity.

- Attempt status. Clearly distinguish between candidates who have not started, are actively attempting, have submitted, or have reached expiry. The interface must not treat a disconnected candidate as automatically inactive or assume that an apparently active browser means the candidate is still connected.

- Incident recording. Record relevant examination events, such as repeated connection interruptions, unexpected navigation events, repeated failed save attempts and other supported browser-level signals. Each event should include its associated candidate, examination, attempt, event type and timestamp.

- Incident review. Examiners can inspect recorded events associated with an examination or individual candidate. Events should be presented with sufficient context to help examiners understand what happened and when it happened.

- Examiner announcements. Examiners can compose and send announcements to candidates participating in an examination. Announcements may communicate examination instructions, clarifications, corrections or general updates.

- Candidate announcement interface. Candidates receive announcements inside their examination workspace without losing their current question, answer state or navigation position. New announcements should be distinguishable from previously viewed announcements.

- Announcement history. Examiners can inspect previously sent announcements, including their content and publication timestamps.

- Monitoring updates. The monitoring interface should refresh examination information regularly so examiners can follow changes without manually reloading the entire page. Updates must not interfere with candidate answer saving or attempt timing.

- Access-controlled monitoring. Only the examiner responsible for an examination and authorized administrators can access its monitoring information. Candidates must never access another candidate's monitoring records or incidents.
Constraints
- Monitoring is not proctoring. This phase provides visibility into examination activity. It does not implement AI-based proctoring, face recognition, automated cheating detection or misconduct verdicts.

- Incidents are not evidence of misconduct by themselves. A browser losing focus, a connection interruption or an unexpected navigation event must not automatically be interpreted as cheating. Examiners make their own judgments using available context.

- Server-authoritative information. Attempt status, submission state, answer progress and examination timing must come from server-side records. The monitoring dashboard must not rely on client-reported countdowns or unverified browser state.

- Monitoring is read-only. Examiners cannot change candidate answers, extend deadlines, reopen expired attempts or manipulate attempt progress through the monitoring interface.

- No interference with delivery. Monitoring and announcements must not interrupt answer synchronization, change attempt snapshots or modify examination rules.

- No additional examination time. Network interruptions and other incidents do not pause or extend the examination deadline.

- Announcements are not examination edits. Sending an announcement must not silently modify published questions, marking schemes, examination duration or candidate enrollment.

- Resource-level authorization. Every monitoring, incident and announcement operation must enforce server-side authorization against the relevant examination and candidate relationships.

- No unnecessary infrastructure. Implement monitoring using the existing Next.js application and PostgreSQL architecture. Do not introduce microservices, separate worker fleets or mandatory paid real-time services.
Acceptance checks
1. An examiner can open an examination and see accurate counts of enrolled, started, submitted, expired and not-started candidates.

2. An examiner can inspect an individual candidate's attempt and see its current server-recorded status, timing and question progress.

3. Answered, unanswered and marked-for-review question counts match the persisted attempt data.

4. When a candidate submits an attempt, the monitoring interface reflects the updated submission status.

5. When an attempt expires, the monitoring interface reflects its finalized state without requiring the candidate to reconnect.

6. Relevant examination events are recorded with the correct candidate, examination, attempt, event type and timestamp.

7. An examiner can inspect incidents associated with an examination and understand the context in which they occurred.

8. Recording an incident does not automatically flag a candidate as guilty, invalidate an attempt or alter a result.

9. An examiner can compose and send an announcement to candidates participating in an examination.

10. Candidates can see announcements in their examination workspace without losing their current answers, navigation position or remaining examination time.

11. Previously sent announcements remain available in the examiner's announcement history.

12. Monitoring updates do not interfere with answer synchronization, submission or expiry handling.

13. Unauthorized examiners cannot inspect another examiner's examination monitoring data or send announcements to examinations outside their authority.

14. Candidate accounts cannot access monitoring dashboards, other candidates' incidents or examiner-only information.
Not in this phase
- Automatic objective-question grading.
- Manual grading of written responses.
- Examiner grading queues and marking interfaces.
- Result calculation, review and publication.
- Candidate result dashboards and performance analytics.
- PDF examination reports.
- Bulk candidate or question imports.
- Examination sandbox.
- Question-level performance analytics.
- Verifiable result reports.
- Advanced proctoring or surveillance.
- Live video, screen recording or biometric collection.