import type { ActionResult } from "@/lib/action-result";

export type { ActionResult } from "@/lib/action-result";
export type { ExamInput, QuestionInput } from "@/lib/exam/types";

export type CreateExamResult = ActionResult<{ examId: string }>;
