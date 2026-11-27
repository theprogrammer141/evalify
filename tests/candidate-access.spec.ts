import { expect, test } from "@playwright/test";

const attemptId = "00000000-0000-4000-8000-000000000001";
const examinationId = "00000000-0000-4000-8000-000000000002";
const questionId = "00000000-0000-4000-8000-000000000003";

test("sign-in page renders on the local application", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to Evalify" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});

test("candidate attempt pages require authentication", async ({ page }) => {
  await page.goto(`/candidate/attempt/${attemptId}`);

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to Evalify" }),
  ).toBeVisible();
});

test("candidate examination and attempt APIs reject unauthenticated requests", async ({
  request,
}) => {
  const checks = [
    () => request.get("/api/v1/candidate/examinations"),
    () => request.get(`/api/v1/candidate/attempts/${attemptId}`),
    () => request.post(`/api/v1/candidate/examinations/${examinationId}/attempt`),
    () =>
      request.put(
        `/api/v1/candidate/attempts/${attemptId}/answers/${questionId}`,
        {
          data: {
            revision: 1,
            answer: null,
            markedForReview: false,
          },
        },
      ),
    () => request.post(`/api/v1/candidate/attempts/${attemptId}/submit`),
  ];

  for (const check of checks) {
    const response = await check();
    expect(response.status()).toBe(401);
  }
});
