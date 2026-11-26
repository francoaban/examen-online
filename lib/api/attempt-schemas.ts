import { z } from "zod";

const eventSchema = z.object({
  type: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const startAttemptSchema = z.object({
  examId: z.string().uuid().optional(),
  preview: z.boolean().optional(),
});

export const saveAnswerSchema = z.object({
  questionId: z.string().uuid().optional(),
  selectedOption: z.number().int().nullable().optional(),
  answerText: z.string().nullable().optional(),
});

export const recordEventsSchema = z.object({
  events: z.array(eventSchema).optional(),
  type: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
