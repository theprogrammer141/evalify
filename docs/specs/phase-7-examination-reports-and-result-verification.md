Phase 7 — Examination reports and result verification
Goal. Examiners can generate trustworthy reports from completed examinations, while candidates can access their own published results and verify that an issued report is authentic.

This phase turns examination data into reliable, shareable records. Reports must reflect persisted examination data rather than browser calculations or manually assembled summaries.

The system must preserve the distinction between an examination result, an examiner's internal review, a published result and an externally verifiable report.
Build
- Examination performance reports. Examiners can generate a report for an examination they are authorized to manage. The report uses persisted examination data and includes relevant examination details, candidate performance, marks, completion information and overall performance summaries.

- Candidate result reports. Examiners can generate an individual candidate report containing the candidate's identity, examination details, awarded marks, maximum marks and final result. The report must reflect the published result rather than independently recalculating scores.

- PDF generation. Provide downloadable PDF reports with a consistent, professional layout. Reports should have clear examination identification, readable tables, appropriate formatting and a generation date. Long reports must handle page breaks without losing or overlapping information.

- Report issuance. Issuing a report creates a persistent record of the issued document and its verification identity. A report must not be considered officially issued merely because someone generated a temporary PDF preview.

- Unique verification identity. Every issued report receives a unique, sufficiently unpredictable verification identifier. Include that identifier and a QR code or equivalent verification reference in the PDF.

- Public report verification. Provide a verification page where someone can enter or scan a report's verification identifier. The system confirms whether the report corresponds to a genuine issued record and communicates its verification status.

- Privacy-conscious verification. A successful verification must disclose only the minimum information necessary to establish authenticity. Do not expose complete candidate records, private answers, marking keys or unnecessary personal information through the public verification endpoint.

- Report status. The system distinguishes valid, revoked and nonexistent verification records. Revoking an issued report prevents it from being presented as currently valid.

- Examiner report access. Examiners can access reports belonging to examinations within their authority. They cannot generate or retrieve reports for another examiner's examinations.

- Candidate access. Candidates can access their own published result reports where the examiner has issued them. They cannot access another candidate's reports by changing an identifier or URL.
Constraints
- Persisted data is authoritative. Report contents must come from database records. Never use client-submitted scores or browser-calculated totals as the source of truth.

- Publication is a prerequisite. An official candidate result report can only be issued after the result has passed grading, examiner review and explicit publication.

- Keep generation separate from issuance. Generating a preview must not automatically create an official verification record. Issuance must be an explicit operation.

- Verification is not result access. A public verification request confirms authenticity; it does not grant access to the underlying result or examination.

- Verification identifiers must be secure. Do not use sequential database IDs, candidate IDs or examination IDs as verification tokens. Verification identifiers must be sufficiently unpredictable.

- Revocation is authoritative. A revoked report must fail verification even if someone still possesses its original PDF.

- Do not expose sensitive information. Public verification responses must not reveal candidate contact details, answers, marking keys, internal examiner notes or other unnecessary information.

- Authorization remains server-side. Every report-generation, issuance, download and revocation operation must enforce the user's role and relationship to the examination or candidate.

- Keep reports consistent. A report must identify the result and examination it represents. Repeated issuance requests must not accidentally create contradictory records or duplicate verification identities.

- No external paid dependency. PDF generation and report verification must work without paid APIs, paid services or billing-dependent integrations.
Acceptance check
1. An authorized examiner generates an examination performance report using actual persisted examination data.
2. An examiner generates an individual candidate result report and confirms that its marks match the published result.
3. A generated PDF contains the correct examination details, candidate information, marks and relevant performance information.
4. Large reports render correctly across multiple pages without overlapping content or missing records.
5. An examiner generates a report preview without automatically issuing an official report.
6. Issuing a report creates a persistent report record and a unique verification identifier.
7. The issued PDF contains its verification identifier and a working QR code or equivalent verification reference.
8. A valid verification identifier produces a successful authenticity response.
9. A nonexistent or modified verification identifier does not produce a successful verification response.
10. Revoking an issued report causes subsequent verification requests to report that the report is no longer valid.
11. An examiner cannot generate, retrieve, issue or revoke reports belonging to an examination outside their authority.
12. A candidate cannot retrieve another candidate's report by modifying a URL, request parameter or report identifier.
13. An unpublished result cannot be issued as an official candidate result report.
14. Public verification responses do not expose unnecessary candidate information or confidential examination data.
15. Repeated report-generation, issuance and revocation requests do not create contradictory report states.
Not in this phase
- Bulk candidate and question imports.
- Question-level analytics and difficulty analysis.
- Examination sandbox and preview attempts.
- Customizable candidate examination workspace.
- Digital scratchpad.
- Additional monitoring and proctoring functionality.
- AI-generated examination summaries or AI grading.
- Email delivery and automated distribution of reports.
- Institutional certificates, digital signatures or external accreditation integrations.
- Advanced report-builder functionality and custom report templates.