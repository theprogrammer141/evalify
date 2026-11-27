"use client";

import { useMemo, useState, type FormEvent } from "react";

type QuestionOption = { id: string; text: string };
type QuestionType =
  | "SINGLE_CHOICE"
  | "MULTIPLE_SELECT"
  | "WRITTEN_RESPONSE";
type Difficulty = "EASY" | "MEDIUM" | "HARD";

type Question = {
  id: string;
  prompt: string;
  category: string;
  difficulty: Difficulty;
  type: QuestionType;
  marks: number;
  options: QuestionOption[];
  answerKey: string[];
  updatedAt: Date | string;
};

type QuestionDraft = Omit<Question, "id" | "updatedAt">;

const EMPTY_OPTION_IDS = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
];

function isQuestionType(value: string): value is QuestionType {
  return (
    value === "SINGLE_CHOICE" ||
    value === "MULTIPLE_SELECT" ||
    value === "WRITTEN_RESPONSE"
  );
}

function isDifficulty(value: string): value is Difficulty {
  return value === "EASY" || value === "MEDIUM" || value === "HARD";
}

function blankDraft(): QuestionDraft {
  const [firstOption, secondOption] = EMPTY_OPTION_IDS;
  return {
    prompt: "",
    category: "",
    difficulty: "MEDIUM",
    type: "SINGLE_CHOICE",
    marks: 1,
    options: [
      { id: firstOption, text: "" },
      { id: secondOption, text: "" },
    ],
    answerKey: [firstOption],
  };
}

function draftFromQuestion(question: Question): QuestionDraft {
  return {
    prompt: question.prompt,
    category: question.category,
    difficulty: question.difficulty,
    type: question.type,
    marks: question.marks,
    options: question.options.map((option) => ({ ...option })),
    answerKey: [...question.answerKey],
  };
}

const fieldClass =
  "mt-2 min-h-11 w-full border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

export function QuestionBankManager({
  initialQuestions,
}: {
  initialQuestions: Question[];
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [draft, setDraft] = useState<QuestionDraft>(blankDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  const filteredQuestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return questions;
    return questions.filter((question) =>
      `${question.prompt} ${question.category}`.toLowerCase().includes(term),
    );
  }, [questions, search]);

  function resetForm() {
    setDraft(blankDraft());
    setEditingId(null);
    setIssues([]);
  }

  function changeQuestionType(type: QuestionType) {
    setDraft((current) => {
      if (type === "WRITTEN_RESPONSE") {
        return { ...current, type, options: [], answerKey: [] };
      }

      const options =
        current.options.length >= 2
          ? current.options
          : [
              { id: EMPTY_OPTION_IDS[0], text: "" },
              { id: EMPTY_OPTION_IDS[1], text: "" },
            ];
      return {
        ...current,
        type,
        options,
        answerKey: current.answerKey.filter((id) =>
          options.some((option) => option.id === id),
        ),
      };
    });
  }

  function toggleCorrectAnswer(optionId: string, checked: boolean) {
    setDraft((current) => {
      if (current.type === "SINGLE_CHOICE") {
        return { ...current, answerKey: checked ? [optionId] : [] };
      }
      if (current.type === "MULTIPLE_SELECT") {
        const answerKey = checked
          ? [...current.answerKey, optionId]
          : current.answerKey.filter((id) => id !== optionId);
        return { ...current, answerKey };
      }
      return current;
    });
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setIssues([]);
    setPending(true);
    try {
      const response = await fetch(
        editingId
          ? `/api/v1/examiner/questions/${editingId}`
          : "/api/v1/examiner/questions",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        setIssues(
          Array.isArray(result.issues)
            ? result.issues.map((issue: { message?: string }) => issue.message ?? "Check this question.")
            : [],
        );
        if (!result.issues?.length) {
          setNotice("The question could not be saved.");
        }
        return;
      }

      setQuestions((current) =>
        editingId
          ? current.map((question) =>
              question.id === editingId ? result.question : question,
            )
          : [result.question, ...current],
      );
      setNotice(editingId ? "Question updated." : "Question added to the bank.");
      resetForm();
    } catch {
      setNotice("The question could not be saved. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-12">
      <section className="border border-border bg-card p-5 sm:p-8">
        <div className="mb-7">
          <p className="text-sm font-medium text-muted-foreground">
            Reusable assessment content
          </p>
          <h2 className="mt-2 font-heading text-2xl">
            {editingId ? "Edit question" : "Create a question"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Each question is validated for its answer type. Examination copies
            keep their own wording, options and marks when this bank entry is
            changed.
          </p>
        </div>

        <form className="grid gap-5 md:grid-cols-2" onSubmit={saveQuestion}>
          <label className="block text-sm font-medium md:col-span-2">
            Question
            <textarea
              className={`${fieldClass} min-h-28 resize-y py-3`}
              maxLength={8000}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  prompt: event.target.value,
                }))
              }
              required
              rows={3}
              value={draft.prompt}
            />
          </label>

          <label className="block text-sm font-medium">
            Category or topic
            <input
              className={fieldClass}
              maxLength={120}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
              required
              value={draft.category}
            />
          </label>
          <label className="block text-sm font-medium">
            Question type
            <select
              className={fieldClass}
              onChange={(event) => {
                if (isQuestionType(event.target.value)) {
                  changeQuestionType(event.target.value);
                }
              }}
              value={draft.type}
            >
              <option value="SINGLE_CHOICE">Single-answer MCQ</option>
              <option value="MULTIPLE_SELECT">Multiple-select</option>
              <option value="WRITTEN_RESPONSE">Written response</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Difficulty
            <select
              className={fieldClass}
              onChange={(event) => {
                const difficulty = event.target.value;
                if (isDifficulty(difficulty)) {
                  setDraft((current) => ({
                    ...current,
                    difficulty,
                  }));
                }
              }}
              value={draft.difficulty}
            >
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Marks
            <input
              className={fieldClass}
              max={10000}
              min={1}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  marks: Number(event.target.value),
                }))
              }
              required
              type="number"
              value={draft.marks}
            />
          </label>

          {draft.type !== "WRITTEN_RESPONSE" && (
            <fieldset className="space-y-4 md:col-span-2">
              <legend className="text-sm font-medium">
                Answer options and correct answer
              </legend>
              <p className="text-sm text-muted-foreground">
                {draft.type === "SINGLE_CHOICE"
                  ? "Select one correct option."
                  : "Select one or more correct options."}
              </p>
              <div className="space-y-3">
                {draft.options.map((option, index) => (
                  <div
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"
                    key={option.id}
                  >
                    <span className="grid size-9 place-items-center border border-border text-sm font-medium">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <label className="sr-only" htmlFor={`option-${option.id}`}>
                      Option {String.fromCharCode(65 + index)} text
                    </label>
                    <input
                      className="min-h-11 min-w-0 border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      id={`option-${option.id}`}
                      maxLength={500}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          options: current.options.map((item) =>
                            item.id === option.id
                              ? { ...item, text: event.target.value }
                              : item,
                          ),
                        }))
                      }
                      required
                      value={option.text}
                    />
                    <div className="flex items-center gap-3">
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input
                          checked={draft.answerKey.includes(option.id)}
                          className="size-4 accent-[#182d2b]"
                          name="correct-answer"
                          onChange={(event) =>
                            toggleCorrectAnswer(option.id, event.target.checked)
                          }
                          type={
                            draft.type === "SINGLE_CHOICE"
                              ? "radio"
                              : "checkbox"
                          }
                        />
                        Correct
                      </label>
                      <button
                        aria-label={`Remove option ${String.fromCharCode(65 + index)}`}
                        className="min-h-11 px-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-40"
                        disabled={draft.options.length <= 2}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            options: current.options.filter(
                              (item) => item.id !== option.id,
                            ),
                            answerKey: current.answerKey.filter(
                              (id) => id !== option.id,
                            ),
                          }))
                        }
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="min-h-11 border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
                disabled={draft.options.length >= 10}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    options: [
                      ...current.options,
                      { id: crypto.randomUUID(), text: "" },
                    ],
                  }))
                }
                type="button"
              >
                Add answer option
              </button>
            </fieldset>
          )}

          {draft.type === "WRITTEN_RESPONSE" && (
            <p className="border-l-2 border-[#182d2b] pl-4 text-sm leading-6 text-muted-foreground md:col-span-2">
              Written responses use the assigned marks for examiner review and
              do not have objective answer options.
            </p>
          )}

          <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:items-center">
            <button
              className="min-h-11 bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
              disabled={pending}
              type="submit"
            >
              {pending
                ? "Saving"
                : editingId
                  ? "Save question"
                  : "Add to question bank"}
            </button>
            {editingId && (
              <button
                className="min-h-11 border border-border px-5 text-sm font-semibold transition-colors hover:bg-muted"
                onClick={resetForm}
                type="button"
              >
                Cancel edit
              </button>
            )}
            {notice && (
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {notice}
              </p>
            )}
          </div>
          {issues.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-destructive md:col-span-2">
              {issues.map((issue, index) => (
                <li key={`${issue}-${index}`}>{issue}</li>
              ))}
            </ul>
          )}
        </form>
      </section>

      <section>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl">Question bank</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {questions.length} reusable{" "}
              {questions.length === 1 ? "question" : "questions"}
            </p>
          </div>
          <label className="block text-sm font-medium sm:w-80">
            Search questions
            <input
              className={`${fieldClass} mt-1`}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              value={search}
            />
          </label>
        </div>

        {filteredQuestions.length > 0 ? (
          <ul className="divide-y divide-border border-y border-border">
            {filteredQuestions.map((question) => (
              <li
                className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto]"
                key={question.id}
              >
                <div>
                  <p className="font-medium leading-6">{question.prompt}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {question.category} · {question.difficulty.toLowerCase()} ·{" "}
                    {question.marks} {question.marks === 1 ? "mark" : "marks"}{" "}
                    ·{" "}
                    {question.type === "SINGLE_CHOICE"
                      ? "Single-answer MCQ"
                      : question.type === "MULTIPLE_SELECT"
                        ? "Multiple-select"
                        : "Written response"}
                  </p>
                </div>
                <button
                  className="min-h-11 border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted"
                  onClick={() => {
                    setDraft(draftFromQuestion(question));
                    setEditingId(question.id);
                    setNotice("");
                    setIssues([]);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  type="button"
                >
                  Edit question
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-y border-border py-8 text-sm text-muted-foreground">
            {questions.length === 0
              ? "No questions have been added to the bank."
              : "No questions match this search."}
          </p>
        )}
      </section>
    </div>
  );
}