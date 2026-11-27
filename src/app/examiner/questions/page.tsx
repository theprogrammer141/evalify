import { AppShell } from "@/components/app-shell";
import { QuestionBankManager } from "@/components/examinations/question-bank-manager";
import { requirePageRole } from "@/lib/auth/authorization";
import { listQuestionBank } from "@/lib/examinations/service";

export const instant = false;

export default async function QuestionBankPage() {
  const user = await requirePageRole("EXAMINER");
  const questions = await listQuestionBank(user.id);

  return (
    <AppShell user={user}>
      <div className="space-y-8">
        <header className="max-w-3xl border-b border-border pb-8">
          <p className="text-sm font-medium text-muted-foreground">
            Examiner workspace
          </p>
          <h1 className="mt-3 font-heading text-4xl tracking-tight sm:text-5xl">
            Question bank
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Create and organize reusable questions. Assigned examinations keep
            a separate copy of their question wording, options and marks.
          </p>
        </header>
        <QuestionBankManager initialQuestions={questions} />
      </div>
    </AppShell>
  );
}