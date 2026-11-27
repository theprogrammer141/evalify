"use client";

import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CirclePlus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useToast } from "@/components/feedback-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";

type ExamSettings = {
  id: string;
  title: string;
  instructions: string;
  startsAt: Date | string;
  endsAt: Date | string;
  durationMinutes: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  status: "DRAFT" | "PUBLISHED" | "COMPLETED";
};

type QuestionOption = { id: string; text: string };
type Question = {
  id: string;
  sourceQuestionId?: string | null;
  prompt: string;
  category: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  type: "SINGLE_CHOICE" | "MULTIPLE_SELECT" | "WRITTEN_RESPONSE";
  marks: number;
  options: QuestionOption[];
  answerKey: string[];
};

type Assignment = Question & {
  position: number;
  marksInput: string;
};

type EnrolledCandidate = {
  id: string;
  email: string;
  enrolledAt: Date | string;
};

type CandidateMatch = { id: string; email: string };

function toUtcInput(value?: Date | string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}

function issueMessages(result: { issues?: unknown }) {
  if (!Array.isArray(result.issues)) return [];
  return result.issues.map((issue) =>
    typeof issue === "object" &&
    issue !== null &&
    "message" in issue &&
    typeof issue.message === "string"
      ? issue.message
      : String(issue),
  );
}

const fieldClass =
  "mt-2 min-h-11 w-full border border-border bg-background px-3 text-base outline-none transition focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/40";
const labelClass = "block text-sm font-medium";

export function ExaminationSettingsForm({
  examination,
}: {
  examination?: ExamSettings;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState(examination?.title ?? "");
  const [instructions, setInstructions] = useState(
    examination?.instructions ?? "",
  );
  const [startsAt, setStartsAt] = useState(
    toUtcInput(examination?.startsAt),
  );
  const [endsAt, setEndsAt] = useState(toUtcInput(examination?.endsAt));
  const [durationMinutes, setDurationMinutes] = useState(
    String(examination?.durationMinutes ?? 60),
  );
  const [randomizeQuestions, setRandomizeQuestions] = useState(
    examination?.randomizeQuestions ?? false,
  );
  const [randomizeOptions, setRandomizeOptions] = useState(
    examination?.randomizeOptions ?? false,
  );
  const toast = useToast();

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");

    if (!startsAt || !endsAt) {
      setNotice("Enter both the availability start and end times.");
      return;
    }

    const startDate = new Date(`${startsAt}:00Z`);
    const endDate = new Date(`${endsAt}:00Z`);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      setNotice("The end time must be after the start time.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch(
        examination
          ? `/api/v1/examiner/examinations/${examination.id}`
          : "/api/v1/examiner/examinations",
        {
          method: examination ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            instructions,
            startsAt: startDate.toISOString(),
            endsAt: endDate.toISOString(),
            durationMinutes: Number(durationMinutes),
            randomizeQuestions,
            randomizeOptions,
          }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        setNotice(
          issueMessages(result).join(" ") ||
            result.message ||
            "The examination settings could not be saved.",
        );
        return;
      }

      if (!examination) {
        router.push(`/examiner/examinations/${result.examination.id}`);
        return;
      }

      setNotice("");
      toast("Examination settings saved.");
      router.refresh();
    } catch {
      setNotice("The examination settings could not be saved. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="border border-border bg-card p-5 sm:p-8">
      <div className="mb-7">
        <p className="text-sm font-medium text-muted-foreground">
          Examination details
        </p>
        <h2 className="mt-2 font-heading text-2xl">Settings and schedule</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Availability is checked against server time. Enter schedule times in
          UTC.
        </p>
      </div>

      <form className="grid gap-x-6 gap-y-5 md:grid-cols-2" onSubmit={saveSettings}>
        <label className={`${labelClass} md:col-span-2`}>
          Examination title
          <input
            className={fieldClass}
            maxLength={180}
            name="title"
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </label>

        <label className={`${labelClass} md:col-span-2`}>
          Candidate instructions
          <textarea
            className={`${fieldClass} min-h-32 resize-y py-3`}
            maxLength={8000}
            name="instructions"
            onChange={(event) => setInstructions(event.target.value)}
            required
            rows={4}
            value={instructions}
          />
        </label>

        <label className={labelClass}>
          Available from (UTC)
          <input
            className={fieldClass}
            onChange={(event) => setStartsAt(event.target.value)}
            required
            step="60"
            type="datetime-local"
            value={startsAt}
          />
        </label>
        <label className={labelClass}>
          Available until (UTC)
          <input
            className={fieldClass}
            onChange={(event) => setEndsAt(event.target.value)}
            required
            step="60"
            type="datetime-local"
            value={endsAt}
          />
        </label>

        <label className={labelClass}>
          Duration (minutes)
          <input
            className={fieldClass}
            max={1440}
            min={1}
            name="durationMinutes"
            onChange={(event) => setDurationMinutes(event.target.value)}
            required
            type="number"
            value={durationMinutes}
          />
        </label>

        <div className="space-y-4 md:col-span-2">
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              checked={randomizeQuestions}
              className="size-4 accent-[#182d2b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onChange={(event) => setRandomizeQuestions(event.target.checked)}
              type="checkbox"
            />
            Randomize objective question order
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              checked={randomizeOptions}
              className="size-4 accent-[#182d2b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onChange={(event) => setRandomizeOptions(event.target.checked)}
              type="checkbox"
            />
            Randomize objective answer choices
          </label>
        </div>

        <div className="flex flex-col items-start gap-3 md:col-span-2 sm:flex-row sm:items-center">
          <button
            className="min-h-11 w-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            disabled={pending}
            type="submit"
          >
            {pending
              ? <Spinner label="Saving examination" />
              : examination
                ? "Save settings"
                : "Create draft"}
          </button>
          {notice && (
            <p aria-live="polite" className="text-sm text-destructive" role="alert">
              {notice}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

export function ExaminationContents({
  examination,
  questionBank,
}: {
  examination: ExamSettings & {
    availability: "draft" | "upcoming" | "ongoing" | "completed";
    questions: (Question & { id: string; position: number })[];
    candidates: EnrolledCandidate[];
    totalMarks: number;
  };
  questionBank: Question[];
}) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>(
    examination.questions.map((question) => ({
      ...question,
      marksInput: String(question.marks),
    })),
  );
  const [candidates, setCandidates] = useState(examination.candidates);
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateMatches, setCandidateMatches] = useState<CandidateMatch[]>(
    [],
  );
  const [message, setMessage] = useState("");
  const [publicationMessage, setPublicationMessage] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [searching, setSearching] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<
    | "add-question"
    | "save-questions"
    | "remove-question"
    | "enroll"
    | "remove-candidate"
    | "publish"
    | null
  >(null);
  const [removalPrompt, setRemovalPrompt] = useState<{
    type: "question" | "candidate";
    id: string;
    label: string;
  } | null>(null);
  const [publishPromptOpen, setPublishPromptOpen] = useState(false);
  const toast = useToast();

  const assignedQuestionIds = useMemo(
    () => new Set(assignments.map((question) => question.sourceQuestionId ?? question.id)),
    [assignments],
  );
  const availableQuestions = questionBank.filter(
    (question) => !assignedQuestionIds.has(question.id),
  );
  const totalMarks = assignments.reduce(
    (total, question) => total + (Number(question.marksInput) || 0),
    0,
  );
  const isCompleted = examination.availability === "completed";

  async function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedQuestion) return;
    setPending(true);
    setPendingOperation("add-question");
    setMessage("");
    try {
      const response = await fetch(
        `/api/v1/examiner/examinations/${examination.id}/questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: selectedQuestion }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        setMessage(
          result.error === "question_already_assigned"
            ? "This question is already assigned."
            : "That question could not be added.",
        );
        return;
      }
      setAssignments((current) => [
        ...current,
        { ...result.question, marksInput: String(result.question.marks) },
      ]);
      setSelectedQuestion("");
      setMessage("");
      toast("Question added to this examination.");
      router.refresh();
    } catch {
      setMessage("The question could not be added. Try again.");
    } finally {
      setPending(false);
      setPendingOperation(null);
    }
  }

  function moveQuestion(index: number, offset: -1 | 1) {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= assignments.length) return;
    setAssignments((current) => {
      const updated = [...current];
      [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
      return updated.map((question, position) => ({
        ...question,
        position: position + 1,
      }));
    });
  }

  async function saveQuestions() {
    setPending(true);
    setPendingOperation("save-questions");
    setMessage("");
    const items = assignments.map((question) => ({
      id: question.id,
      marks: Number(question.marksInput),
    }));
    if (
      items.some(
        (item) => !Number.isInteger(item.marks) || item.marks < 1,
      )
    ) {
      setMessage("Enter a positive whole-number mark for each question.");
      setPending(false);
      setPendingOperation(null);
      return;
    }

    try {
      const response = await fetch(
        `/api/v1/examiner/examinations/${examination.id}/questions`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "The question order could not be saved.");
        return;
      }
      setAssignments((current) =>
        current.map((question, position) => ({
          ...question,
          marks: items[position].marks,
          position: position + 1,
        })),
      );
      setMessage("");
      toast("Question order and marks saved.");
      router.refresh();
    } catch {
      setMessage("The question order could not be saved. Try again.");
    } finally {
      setPending(false);
      setPendingOperation(null);
    }
  }

  async function removeQuestion(assignmentId: string) {
    setPending(true);
    setPendingOperation("remove-question");
    setMessage("");
    try {
      const response = await fetch(
        `/api/v1/examiner/examinations/${examination.id}/questions/${assignmentId}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok) {
        setMessage(
          result.error === "published_question_required"
            ? "A published examination must keep at least one question."
            : "The question could not be removed.",
        );
        return;
      }
      setAssignments((current) =>
        current
          .filter((question) => question.id !== assignmentId)
          .map((question, index) => ({ ...question, position: index + 1 })),
      );
      setMessage("");
      toast("Question removed.");
      router.refresh();
    } catch {
      setMessage("The question could not be removed. Try again.");
    } finally {
      setPending(false);
      setPendingOperation(null);
    }
  }

  async function findCandidates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/v1/examiner/candidates?search=${encodeURIComponent(candidateSearch)}`,
      );
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "Enter at least two characters to search.");
        return;
      }
      setCandidateMatches(result.candidates);
      if (result.candidates.length === 0) setMessage("No matching accounts.");
    } catch {
      setMessage("Candidate accounts could not be searched. Try again.");
    } finally {
      setSearching(false);
    }
  }

  async function enroll(candidateId: string) {
    setPending(true);
    setPendingOperation("enroll");
    setMessage("");
    try {
      const response = await fetch(
        `/api/v1/examiner/examinations/${examination.id}/enrollments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        setMessage(
          result.error === "already_enrolled"
            ? "This candidate is already enrolled."
            : "This candidate could not be enrolled.",
        );
        return;
      }
      const candidate = candidateMatches.find((item) => item.id === candidateId);
      if (candidate) {
        setCandidates((current) =>
          [...current, { ...candidate, enrolledAt: new Date() }].sort((a, b) =>
            a.email.localeCompare(b.email),
          ),
        );
      }
      setCandidateMatches((current) =>
        current.filter((item) => item.id !== candidateId),
      );
      setMessage("");
      toast("Candidate enrolled.");
      router.refresh();
    } catch {
      setMessage("The candidate could not be enrolled. Try again.");
    } finally {
      setPending(false);
      setPendingOperation(null);
    }
  }

  async function removeCandidate(candidateId: string) {
    setPending(true);
    setPendingOperation("remove-candidate");
    setMessage("");
    try {
      const response = await fetch(
        `/api/v1/examiner/examinations/${examination.id}/enrollments/${candidateId}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok) {
        setMessage(
          result.error === "published_candidate_required"
            ? "A published examination must keep at least one enrolled candidate."
            : "This enrollment could not be removed.",
        );
        return;
      }
      setCandidates((current) =>
        current.filter((candidate) => candidate.id !== candidateId),
      );
      setMessage("");
      toast("Enrollment removed.");
      router.refresh();
    } catch {
      setMessage("This enrollment could not be removed. Try again.");
    } finally {
      setPending(false);
      setPendingOperation(null);
    }
  }

  async function publish() {
    setPending(true);
    setPendingOperation("publish");
    setMessage("");
    setPublicationMessage("");
    setIssues([]);
    try {
      const response = await fetch(
        `/api/v1/examiner/examinations/${examination.id}/publish`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok) {
        setIssues(result.issues ?? []);
        setPublicationMessage(
          result.issues?.length
            ? "Complete these items before publishing:"
            : "The examination could not be published.",
        );
        return;
      }
      setPublicationMessage("");
      toast("Examination published.");
      router.refresh();
    } catch {
      setPublicationMessage(
        "The examination could not be published. Try again.",
      );
    } finally {
      setPending(false);
      setPendingOperation(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="border border-border bg-card p-5 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Question set
            </p>
            <h2 className="mt-2 font-heading text-2xl">Assigned questions</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {assignments.length} questions ·{" "}
            <strong className="font-semibold text-foreground">
              {totalMarks} total marks
            </strong>
          </p>
        </div>

        {assignments.length > 0 ? (
          <ol className="mt-6 divide-y divide-border border-y border-border">
            {assignments.map((question, index) => (
              <li
                className="grid gap-4 py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                key={question.id}
              >
                <span className="grid size-9 place-items-center border border-border text-sm tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium leading-6">{question.prompt}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {question.category} ·{" "}
                    {question.type === "SINGLE_CHOICE"
                      ? "Single answer"
                      : question.type === "MULTIPLE_SELECT"
                        ? "Multiple select"
                        : "Written response"}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <label className="text-sm text-muted-foreground">
                    Marks
                    <input
                      aria-label={`Marks for question ${index + 1}`}
                      className="ml-2 h-10 w-20 border border-border bg-background px-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      min={1}
                      onChange={(event) =>
                        setAssignments((current) =>
                          current.map((item) =>
                            item.id === question.id
                              ? { ...item, marksInput: event.target.value }
                              : item,
                          ),
                        )
                      }
                      type="number"
                      value={question.marksInput}
                    />
                  </label>
                  <button
                    aria-label={`Move question ${index + 1} up`}
                    className="grid size-10 place-items-center border border-border transition hover:bg-muted disabled:opacity-40"
                    disabled={pending || index === 0 || isCompleted}
                    onClick={() => moveQuestion(index, -1)}
                    type="button"
                  >
                    <ArrowUp aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    aria-label={`Move question ${index + 1} down`}
                    className="grid size-10 place-items-center border border-border transition hover:bg-muted disabled:opacity-40"
                    disabled={
                      pending || index === assignments.length - 1 || isCompleted
                    }
                    onClick={() => moveQuestion(index, 1)}
                    type="button"
                  >
                    <ArrowDown aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    aria-label={`Remove question ${index + 1}`}
                    className="grid size-10 place-items-center border border-border text-muted-foreground transition hover:border-destructive hover:text-destructive disabled:opacity-40"
                    disabled={pending || isCompleted}
                    onClick={() =>
                      setRemovalPrompt({
                        type: "question",
                        id: question.id,
                        label: question.prompt.slice(0, 100),
                      })
                    }
                    type="button"
                  >
                    {pendingOperation === "remove-question" ? (
                      <Spinner label="Removing question" />
                    ) : (
                      <Trash2 aria-hidden="true" className="size-4" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-6 border-y border-border py-8 text-sm text-muted-foreground">
            No questions assigned. Add a reusable question below.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={addQuestion}>
            <label className="sr-only" htmlFor="question-bank-select">
              Question from the bank
            </label>
            <select
              className="min-h-11 min-w-0 border border-border bg-background px-3 text-sm sm:min-w-72"
              disabled={pending || isCompleted || availableQuestions.length === 0}
              id="question-bank-select"
              onChange={(event) => setSelectedQuestion(event.target.value)}
              required
              value={selectedQuestion}
            >
              <option value="">
                {availableQuestions.length
                  ? "Choose a question"
                  : "No unassigned bank questions"}
              </option>
              {availableQuestions.map((question) => (
                <option key={question.id} value={question.id}>
                  {question.category} · {question.prompt.slice(0, 64)}
                </option>
              ))}
            </select>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
              disabled={pending || isCompleted || !selectedQuestion}
              type="submit"
            >
              <CirclePlus aria-hidden="true" className="size-4" />
              {pendingOperation === "add-question" ? <Spinner label="Adding question" /> : "Add question"}
            </button>
          </form>
          <button
            className="min-h-11 bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/85 disabled:opacity-50"
            disabled={pending || isCompleted || assignments.length === 0}
            onClick={saveQuestions}
            type="button"
          >
            {pendingOperation === "save-questions" ? <Spinner label="Saving questions" /> : "Save order and marks"}
          </button>
        </div>
      </section>

      <section className="border border-border bg-card p-5 sm:p-8">
        <div className="mb-6">
          <p className="text-sm font-medium text-muted-foreground">
            Candidate access
          </p>
          <h2 className="mt-2 font-heading text-2xl">Enrollment list</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Enrollment grants eligibility only. It does not create an attempt
            or start the examination clock.
          </p>
        </div>

        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={findCandidates}
        >
          <label className="sr-only" htmlFor="candidate-search">
            Search candidate accounts by email
          </label>
          <input
            className={`${fieldClass} mt-0`}
            id="candidate-search"
            minLength={2}
            onChange={(event) => setCandidateSearch(event.target.value)}
            placeholder="Search candidate email"
            value={candidateSearch}
          />
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-border px-5 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
            disabled={searching || candidateSearch.trim().length < 2}
            type="submit"
          >
            <Search aria-hidden="true" className="size-4" />
            {searching ? <Spinner label="Searching candidates" /> : "Find candidate"}
          </button>
        </form>

        {candidateMatches.length > 0 && (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {candidateMatches.map((candidate) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 py-3"
                key={candidate.id}
              >
                <span className="text-sm">{candidate.email}</span>
                <button
                  className="inline-flex min-h-10 items-center gap-2 border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
                  disabled={
                    pending ||
                    isCompleted ||
                    candidates.some((item) => item.id === candidate.id)
                  }
                  onClick={() => enroll(candidate.id)}
                  type="button"
                >
                  {pendingOperation === "enroll" ? (
                    <Spinner label="Enrolling candidate" />
                  ) : (
                    <>
                      <CirclePlus aria-hidden="true" className="size-4" />
                      Enroll
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {candidates.length > 0 ? (
          <ul className="mt-7 divide-y divide-border border-y border-border">
            {candidates.map((candidate) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 py-4"
                key={candidate.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Check
                    aria-hidden="true"
                    className="size-4 shrink-0 text-[#182d2b]"
                  />
                  <span className="truncate text-sm font-medium">
                    {candidate.email}
                  </span>
                </div>
                <button
                  className="min-h-10 px-3 text-sm text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline disabled:opacity-40"
                  disabled={pending || isCompleted}
                  onClick={() =>
                    setRemovalPrompt({
                      type: "candidate",
                      id: candidate.id,
                      label: candidate.email,
                    })
                  }
                  type="button"
                >
                  {pendingOperation === "remove-candidate" ? (
                    <Spinner label="Removing enrollment" />
                  ) : (
                    "Remove enrollment"
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            No candidates enrolled yet.
          </p>
        )}

      </section>

      {message && (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {message}
        </p>
      )}
      <PublicationReview
        examination={examination}
        isCompleted={isCompleted}
        pending={pending}
        loading={pendingOperation === "publish"}
        publish={() => setPublishPromptOpen(true)}
        issues={issues}
        message={publicationMessage}
      />
      <ConfirmDialog
        confirmLabel="Publish examination"
        description="Publishing makes this examination available to its enrolled candidates according to the schedule."
        onConfirm={() => {
          setPublishPromptOpen(false);
          void publish();
        }}
        onOpenChange={setPublishPromptOpen}
        open={publishPromptOpen}
        title="Publish this examination?"
      />
      <ConfirmDialog
        confirmLabel={removalPrompt?.type === "question" ? "Remove question" : "Remove enrollment"}
        destructive
        description={
          removalPrompt?.type === "question"
            ? `Remove "${removalPrompt.label}" from this examination?`
            : `Remove ${removalPrompt?.label ?? "this candidate"} from the examination? They will lose eligibility to start an attempt.`
        }
        onConfirm={() => {
          const removal = removalPrompt;
          setRemovalPrompt(null);
          if (removal?.type === "question") void removeQuestion(removal.id);
          if (removal?.type === "candidate") void removeCandidate(removal.id);
        }}
        onOpenChange={(open) => {
          if (!open) setRemovalPrompt(null);
        }}
        open={removalPrompt !== null}
        pending={pending}
        title={removalPrompt?.type === "question" ? "Remove this question?" : "Remove enrollment?"}
      />
    </div>
  );
}

function PublicationReview({
  examination,
  isCompleted,
  pending,
  loading,
  publish,
  issues,
  message,
}: {
  examination: ExamSettings & {
    availability: "draft" | "upcoming" | "ongoing" | "completed";
    questions: Question[];
    candidates: EnrolledCandidate[];
    totalMarks: number;
  };
  isCompleted: boolean;
  pending: boolean;
  loading: boolean;
  publish: () => void;
  issues: string[];
  message: string;
}) {
  const checks = [
    { label: "Candidate instructions", ready: examination.instructions.trim().length > 0 },
    { label: "Schedule and duration", ready: examination.durationMinutes > 0 && new Date(examination.endsAt) > new Date(examination.startsAt) },
    { label: "Question set", ready: examination.questions.length > 0 },
    { label: "Enrolled candidates", ready: examination.candidates.length > 0 },
  ];

  return (
    <section className="border border-border bg-[#182d2b] p-5 text-white sm:p-8">
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="text-sm font-medium text-white/65">Final review</p>
          <h2 className="mt-2 font-heading text-2xl">Publication checklist</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {checks.map((check) => (
              <li className="flex items-center gap-2 text-sm" key={check.label}>
                <span
                  aria-hidden="true"
                  className={`grid size-5 place-items-center border ${check.ready ? "border-white/30 bg-white/15" : "border-white/30"}`}
                >
                  {check.ready ? <Check className="size-3.5" /> : null}
                </span>
                <span>{check.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-white/70">
            The server checks every requirement again when you publish. Enrolled
            candidates will see instructions and availability, but no questions
            in this phase.
          </p>
        </div>
        {examination.status === "DRAFT" ? (
          <button
            className="min-h-12 bg-white px-6 text-sm font-semibold text-[#182d2b] transition hover:-translate-y-0.5 hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
            disabled={pending || isCompleted}
            onClick={publish}
            type="button"
          >
            {loading ? <Spinner label="Checking requirements" /> : "Publish examination"}
          </button>
        ) : (
          <p className="border border-white/30 px-5 py-3 text-sm font-semibold">
            Published
          </p>
        )}
      </div>
      {message && (
        <p aria-live="polite" className="mt-5 text-sm text-white" role="alert">
          {message}
        </p>
      )}
      {issues.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/85" role="alert">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
