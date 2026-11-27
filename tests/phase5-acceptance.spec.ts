import { expect, test, type Page } from "@playwright/test";
import {
  createPhase5Fixture,
  type Phase5Fixture,
} from "./fixtures/phase5-data";

type CandidateAttemptPayload = {
  attempt: {
    id: string;
    status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
    startedAt: string;
    expiresAt: string;
    questions: Array<{
      id: string;
      answer: unknown;
      revision: number;
      markedForReview: boolean;
      markingRules?: unknown;
    }>;
  };
};

async function getJson(
  page: Page,
  path: string,
  method = "GET",
  body?: unknown,
) {
  return page.evaluate(
    async ({ requestPath, requestMethod, requestBody }) => {
      const response = await fetch(requestPath, {
        method: requestMethod,
        headers:
          requestBody === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        body:
          requestBody === undefined
            ? undefined
            : JSON.stringify(requestBody),
      });
      return {
        status: response.status,
        payload: await response.json(),
      };
    },
    { requestPath: path, requestMethod: method, requestBody: body },
  );
}

async function signIn(
  page: Page,
  email: string,
  password: string,
) {
  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  const signInResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/auth/sign-in") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const signInResponse = await signInResponsePromise;
  expect(signInResponse.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Your examinations", exact: true }),
  ).toBeVisible();
  await page.goto("/candidate");
  await expect(page).toHaveURL(/\/candidate\/?$/);
}

test.describe("Phase 5 examination delivery acceptance", () => {
  test.setTimeout(180_000);

  let fixture: Phase5Fixture;

  test.beforeAll(async () => {
    fixture = await createPhase5Fixture();
  });

  test.afterAll(async () => {
    await fixture?.cleanup();
  });

  test("candidate entry, resilience, answer lifecycle, preferences, scratchpad, and expiry", async ({
    page,
    browser,
    request,
  }) => {
    await signIn(page, fixture.candidateEmail, fixture.candidatePassword);

    await expect(
      page.getByRole("heading", { name: "Available now", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Upcoming", exact: true }),
    ).toBeVisible();

    const primaryCard = page
      .getByRole("listitem")
      .filter({ hasText: fixture.examinationTitles.primary });
    await expect(primaryCard).toContainText("4 marks");
    await expect(primaryCard).toContainText("60 minutes");
    await expect(primaryCard).toContainText("Read each question carefully");
    await expect(
      page.getByText(fixture.examinationTitles.unassigned),
    ).toHaveCount(0);

    const unassignedStart = await getJson(
      page,
      `/api/v1/candidate/examinations/${fixture.examinationIds.unassigned}/attempt`,
      "POST",
    );
    expect(unassignedStart.status).toBe(403);
    expect(unassignedStart.payload).toMatchObject({ error: "not_enrolled" });

    const earlyStart = await getJson(
      page,
      `/api/v1/candidate/examinations/${fixture.examinationIds.upcoming}/attempt`,
      "POST",
    );
    expect(earlyStart.status).toBe(409);
    expect(earlyStart.payload).toMatchObject({ error: "exam_not_available" });

    const startResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(
          `/api/v1/candidate/examinations/${fixture.examinationIds.primary}/attempt`,
        ) && response.request().method() === "POST",
    );
    await primaryCard
      .getByRole("button", { name: "Start examination" })
      .click();
    const startResponse = await startResponsePromise;
    expect(startResponse.status()).toBe(200);
    await expect(page).toHaveURL(/\/candidate\/attempt\/[0-9a-f-]+$/);
    const appOrigin = new URL(page.url()).origin;

    const attemptId = new URL(page.url()).pathname.split("/").at(-1);
    expect(attemptId).toBeTruthy();

    const firstAttempt = await getJson(
      page,
      `/api/v1/candidate/attempts/${attemptId}`,
    );
    expect(firstAttempt.status).toBe(200);
    const initialAttempt = (
      firstAttempt.payload as CandidateAttemptPayload
    ).attempt;
    expect(initialAttempt.status).toBe("IN_PROGRESS");
    expect(initialAttempt.questions).toHaveLength(4);
    expect(JSON.stringify(initialAttempt)).not.toContain("markingRules");
    expect(JSON.stringify(initialAttempt)).not.toContain(fixture.markingMarker);

    const repeatedStart = await getJson(
      page,
      `/api/v1/candidate/examinations/${fixture.examinationIds.primary}/attempt`,
      "POST",
    );
    expect(repeatedStart.status).toBe(200);
    const repeatedAttempt = (
      repeatedStart.payload as CandidateAttemptPayload
    ).attempt;
    expect(repeatedAttempt.id).toBe(initialAttempt.id);
    expect(repeatedAttempt.expiresAt).toBe(initialAttempt.expiresAt);

    const answerPath =
      `/api/v1/candidate/attempts/${attemptId}/answers/` +
      fixture.questionIds.single;
    let delayedRevisionOne = false;
    let finishDelayedRequest!: () => void;
    const delayedRequestFinished = new Promise<void>((resolve) => {
      finishDelayedRequest = resolve;
    });
    await page.route(`**${answerPath}`, async (route) => {
      const requestBody = route.request().postDataJSON() as {
        revision: number;
      };
      if (requestBody.revision === 1 && !delayedRevisionOne) {
        delayedRevisionOne = true;
        await new Promise((resolve) => setTimeout(resolve, 1_200));
      }
      try {
        const response = await route.fetch();
        await route.fulfill({ response });
      } finally {
        if (requestBody.revision === 1) finishDelayedRequest();
      }
    });

    const revisionOneRequest = page.waitForRequest(
      (candidateRequest) =>
        candidateRequest.url().includes(answerPath) &&
        (candidateRequest.postDataJSON() as { revision: number }).revision ===
          1,
    );
    await page.getByRole("radio").nth(0).check();
    await revisionOneRequest;
    await page.getByRole("radio").nth(1).check();
    await delayedRequestFinished;
    await page.unroute(`**${answerPath}`);
    await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();

    let attemptResult = await getJson(
      page,
      `/api/v1/candidate/attempts/${attemptId}`,
    );
    let candidateAttempt = (attemptResult.payload as CandidateAttemptPayload)
      .attempt;
    expect(candidateAttempt.questions[0].answer).toEqual({
      kind: "single",
      optionId: fixture.optionIds.singleAlternate,
    });
    expect(candidateAttempt.questions[0].revision).toBe(2);

    await page.getByRole("button", { name: "Mark for review" }).click();
    await expect(page.getByRole("button", { name: "Remove review mark" })).toBeVisible();
    await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Question 2, unanswered/ }).click();
    attemptResult = await getJson(
      page,
      `/api/v1/candidate/attempts/${attemptId}`,
    );
    const confirmedAttempt = attemptResult.payload;

    await page.context().setOffline(true);
    await page.getByRole("checkbox").nth(0).check();
    await expect(
      page.getByText("Offline — changes may not reach the server"),
    ).toBeVisible();
    await expect(
      page.getByText(/Unconfirmed local changes are not guaranteed/),
    ).toBeVisible();

    let releaseReconnect!: () => void;
    const reconnectDelay = new Promise<void>((resolve) => {
      releaseReconnect = resolve;
    });
    await page.route(
      `**/api/v1/candidate/attempts/${attemptId}`,
      async (route) => {
        if (route.request().method() === "GET") {
          await reconnectDelay;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(confirmedAttempt),
          });
          return;
        }
        await route.continue();
      },
    );
    await page.context().setOffline(false);
    await expect(
      page.getByText("Reconnecting and checking saved answers…"),
    ).toBeVisible();
    releaseReconnect();
    await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
    await page.unroute(`**/api/v1/candidate/attempts/${attemptId}`);

    attemptResult = await getJson(
      page,
      `/api/v1/candidate/attempts/${attemptId}`,
    );
    candidateAttempt = (attemptResult.payload as CandidateAttemptPayload)
      .attempt;
    expect(candidateAttempt.questions[1].answer).toEqual({
      kind: "multiple",
      optionIds: [fixture.optionIds.multipleFirst],
    });

    await page.getByRole("button", { name: /Question 3, unanswered/ }).click();
    await page.getByLabel("Your response").fill("A persisted written response");
    await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();

    await page.getByLabel("Question text").selectOption("large");
    await page.getByLabel("Answer spacing").selectOption("compact");
    const scratchpadNote = "Private rough work must not be submitted";
    await page.getByLabel("Scratchpad notes").fill(scratchpadNote);
    await page.getByRole("button", { name: "Hide" }).click();
    await expect(page.getByLabel("Scratchpad notes")).toHaveCount(0);
    await page.getByRole("button", { name: "Show" }).click();
    await expect(page.getByLabel("Scratchpad notes")).toHaveValue(scratchpadNote);

    await page.reload();
    await expect(page.getByRole("radio").nth(1)).toBeChecked();
    await expect(page.getByLabel("Question text")).toHaveValue("large");
    await expect(page.getByLabel("Answer spacing")).toHaveValue("compact");
    await expect(page.getByLabel("Scratchpad notes")).toHaveValue(scratchpadNote);
    await expect(
      page.getByRole("button", {
        name: "Question 1, answered, marked for review",
      }),
    ).toBeVisible();
    await expect(page.getByText("3 of 4 answered")).toBeVisible();
    attemptResult = await getJson(
      page,
      `/api/v1/candidate/attempts/${attemptId}`,
    );
    candidateAttempt = (attemptResult.payload as CandidateAttemptPayload)
      .attempt;
    expect(candidateAttempt.questions[1].answer).toEqual({
      kind: "multiple",
      optionIds: [fixture.optionIds.multipleFirst],
    });
    expect(candidateAttempt.questions[2].answer).toEqual({
      kind: "written",
      text: "A persisted written response",
    });
    expect(candidateAttempt.questions[3].answer).toBeNull();

    await page.getByRole("button", { name: "Review and submit" }).click();
    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation).toContainText("3 of 4 questions");
    await expect(confirmation).toContainText("1 unanswered");
    await confirmation
      .getByRole("button", { name: "Submit examination" })
      .click();
    await expect(
      page.getByText("Your examination has been submitted"),
    ).toBeVisible();
    await expect(page.getByRole("radio").nth(1)).toBeDisabled();
    await expect(page.getByLabel("Scratchpad notes")).toBeDisabled();

    const repeatedSubmit = await getJson(
      page,
      `/api/v1/candidate/attempts/${attemptId}/submit`,
      "POST",
    );
    expect(repeatedSubmit.status).toBe(200);
    expect(
      (repeatedSubmit.payload as CandidateAttemptPayload).attempt.status,
    ).toBe("SUBMITTED");

    const rejectedFinalAnswer = await getJson(
      page,
      answerPath,
      "PUT",
      {
        revision: 3,
        answer: null,
        markedForReview: false,
      },
    );
    expect(rejectedFinalAnswer.status).toBe(409);
    expect(rejectedFinalAnswer.payload).toMatchObject({
      error: "attempt_finalized",
    });
    attemptResult = await getJson(
      page,
      `/api/v1/candidate/attempts/${attemptId}`,
    );
    expect(JSON.stringify(attemptResult.payload)).not.toContain(scratchpadNote);

    const otherContext = await browser.newContext({ baseURL: appOrigin });
    try {
      const otherPage = await otherContext.newPage();
      await signIn(
        otherPage,
        fixture.otherCandidateEmail,
        fixture.otherCandidatePassword,
      );
      const otherCandidateAttempt = await getJson(
        otherPage,
        `/api/v1/candidate/attempts/${attemptId}`,
      );
      expect(otherCandidateAttempt.status).toBe(404);
      await expect(
        otherPage.getByText(fixture.examinationTitles.primary),
      ).toHaveCount(0);
    } finally {
      await otherContext.close();
    }

    await page.goto("/candidate");
    const followupCard = page
      .getByRole("listitem")
      .filter({ hasText: fixture.examinationTitles.followup });
    await followupCard
      .getByRole("button", { name: "Start examination" })
      .click();
    await expect(page).toHaveURL(/\/candidate\/attempt\/[0-9a-f-]+$/);
    await expect(page.getByLabel("Question text")).toHaveValue("large");
    await expect(page.getByLabel("Answer spacing")).toHaveValue("compact");

    await page.goto("/candidate");
    const expiryCard = page
      .getByRole("listitem")
      .filter({ hasText: fixture.examinationTitles.expiry });
    await expiryCard
      .getByRole("button", { name: "Start examination" })
      .click();
    await expect(page).toHaveURL(/\/candidate\/attempt\/[0-9a-f-]+$/);
    const expiryAttemptId = new URL(page.url()).pathname.split("/").at(-1);
    if (!expiryAttemptId) throw new Error("Expiry attempt ID is missing.");

    const originalStartedAt = (
      (
        (await getJson(
          page,
          `/api/v1/candidate/attempts/${expiryAttemptId}`,
        )).payload as CandidateAttemptPayload
      ).attempt
    ).startedAt;
    const acceleratedDeadline = await fixture.setAttemptExpiry(
      expiryAttemptId,
      8,
    );
    await page.goto(`/candidate/attempt/${expiryAttemptId}`);
    await page.context().setOffline(true);
    await expect(page.getByRole("timer")).toHaveAttribute(
      "aria-label",
      "Time remaining 00:00:00",
      { timeout: 15_000 },
    );

    if (fixture.cronSecret) {
      const expiryCron = await request.get(
        new URL("/api/internal/attempts/expire", appOrigin).toString(),
        {
          headers: { authorization: `Bearer ${fixture.cronSecret}` },
        },
      );
      expect(expiryCron.status()).toBe(200);
    }

    await page.context().setOffline(false);
    await expect(
      page.getByText("The examination time has ended"),
    ).toBeVisible({ timeout: 15_000 });
    const expiredAttemptResult = await getJson(
      page,
      `/api/v1/candidate/attempts/${expiryAttemptId}`,
    );
    const expiredAttempt = (
      expiredAttemptResult.payload as CandidateAttemptPayload
    ).attempt;
    expect(expiredAttempt.status).toBe("EXPIRED");
    expect(expiredAttempt.startedAt).toBe(originalStartedAt);
    expect(Date.parse(expiredAttempt.expiresAt)).toBe(
      Date.parse(acceleratedDeadline),
    );
    await expect(page.getByRole("radio").nth(0)).toBeDisabled();
  });
});
