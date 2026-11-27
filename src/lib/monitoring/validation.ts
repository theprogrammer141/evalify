import { z } from "zod";

export const announcementInputSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const monitoringEventInputSchema = z.object({
  type: z.enum([
    "CONNECTION_INTERRUPTION",
    "CONNECTION_RESTORED",
    "SAVE_FAILURE",
    "BROWSER_HIDDEN",
  ]),
  context: z.string().trim().min(1).max(500),
});

export const attemptAnswerInputSchema = z.object({
  response: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("options"),
      optionIds: z.array(z.string().uuid()).max(10),
    }),
    z.object({
      type: z.literal("text"),
      text: z.string().max(8000),
    }),
  ]),
  markedForReview: z.boolean(),
});

export type AnnouncementInput = z.infer<typeof announcementInputSchema>;
export type MonitoringEventInput = z.infer<
  typeof monitoringEventInputSchema
>;
export type AttemptAnswerInput = z.infer<typeof attemptAnswerInputSchema>;
