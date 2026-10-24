/**
 * Response and request types for /api/v1, written from the server's allowlisted serializers and strict schemas
 * (src/lib/mobile/*.ts in the website repo). If the server contract changes, these must change with it.
 */

export type ApiUser = { id: string; email: string; username: string; emailVerified: boolean; preferredLanguage: string };
export type AuthResponse = { token: string; expiresAt: string; user: ApiUser };
export type MeResponse = { user: ApiUser };

// ---- content ----
export type TopicStatus = "PUBLISHED" | "COMING_SOON";
export type ContentTopic = { slug: string; title: string; level: string; prereqs: string[]; status: TopicStatus; position: number };

export type SectionKind = "intuition" | "concept" | "naive" | "observation" | "viz" | "example" | "code" | "complexity" | "edge" | "mistakes" | "recognize" | "worked";
/** The union of fields the server may send for any section kind (each kind uses a subset). */
export type LessonSection = {
  kind: SectionKind;
  id: string;
  title: string;
  paras?: string[];
  bullets?: string[];
  code?: string;
  cost?: string;
  viz?: string;
  steps?: { title: string; body: string }[];
  table?: { head: string[]; rows: string[][] };
  walkthrough?: string[];
  pseudocode?: string;
  rows?: { what: string; time: string; space: string; why: string }[];
  items?: { case?: string; handle?: string; mistake?: string; fix?: string }[];
  signals?: string[];
  notThis?: string[];
  problem?: string;
  approach?: string[];
  takeaway?: string;
};

/** A quiz question. `answer` is the index of the correct option; `why` is shown after answering. Both come with the content. */
export type QuizQuestion = { q: string; options: string[]; answer: number; why: string; kind?: "concept" | "trace" | "recognize" | "complexity" };

export type BuiltinLesson = {
  topicSlug: string;
  source: "builtin";
  minutes: number;
  hook: string;
  objectives: string[];
  prereqNote?: string;
  sections: LessonSection[];
  cheatSheet: { label: string; value: string }[];
  summary: string[];
  /** Quiz questions only. Answers and explanations are never sent; the server scores quizzes. */
  checks: QuizQuestion[];
  nextNote?: string;
};
export type CustomLesson = { topicSlug: string; source: "custom"; markdown: string };
export type ContentLesson = BuiltinLesson | CustomLesson;

export type ProblemSample = { input: string; expected: string; explanation: string | null };
export type ContentProblem = {
  id: string; slug: string; title: string; kind: "INTERNAL" | "EXTERNAL"; difficulty: string;
  source: string | null; externalUrl: string | null; statement: string | null; inputSpec: string | null;
  outputSpec: string | null; constraints: string | null; timeLimitMs: number | null; memoryLimitMb: number | null;
  position: number; topics: string[]; samples: ProblemSample[]; testCount: number;
};

export type ContentResponse = { version: string; topics: ContentTopic[]; lessons: ContentLesson[]; problems: ContentProblem[] };

// ---- submissions (the website's checker, behind a bearer token) ----
export type SubmissionRequest = { problemId: string; clientId: string; output: string | string[] };
export type CheckResult = { isSample: boolean; pass: boolean; input?: string; expected?: string; actual?: string };
export type SubmissionResponse = {
  clientId: string;
  verdict: "accepted" | "wrong_answer" | "not_recorded";
  allPass: boolean;
  solved: boolean;
  results: CheckResult[];
  note?: string;
  replayed?: boolean;
};

// ---- sync ----
export type MistakePayload = {
  id: string;
  type: string;
  reason?: string | null;
  problemId?: string | null;
  outsideTitle?: string | null;
  outsideUrl?: string | null;
  misunderstood: string;
  correctIdea: string;
  recognizeNextTime: string;
};
export type SyncEventInput = { id: string; at: string } & (
  | { type: "topic.complete"; payload: { slug: string } }
  | { type: "topic.review"; payload: { slug: string; rating: "good" | "again" } }
  | { type: "quiz.submit"; payload: { slug: string; answers: number[] } }
  | { type: "solve.external"; payload: { problemId: string; solved: boolean } }
  | { type: "mistake.create"; payload: MistakePayload }
  | { type: "mistake.delete"; payload: { id: string } }
  | { type: "note.create"; payload: { id: string; title: string; body: string; tags: string[] } }
  | { type: "note.delete"; payload: { id: string } }
  | { type: "revisit.report_outside"; payload: { id: string; note: string } }
);
export type PushResponse = {
  accepted: string[];
  rejected: { id: string; reason: string }[];
  results: Record<string, Record<string, unknown>>;
};

export type SyncState = {
  topicProgress: { slug: string; completedAt: string | null }[];
  reviewItems: { slug: string; step: number; dueAt: string }[];
  quizResults: { slug: string; bestScore: number; total: number; attempts: number; passedAt: string | null }[];
  solves: { problemId: string; solvedAt: string }[];
  revisits: { id: string; problemId: string | null; outsideTitle: string | null; outsideUrl: string | null; dueAt: string | null; step: number; passedAt: string | null; passedBy: string | null; note: string | null }[];
};
export type ServerNote = { id: string; title: string; body: string; tags: string[]; createdAt: string };
export type ServerMistake = {
  id: string; problemId: string | null; outsideTitle: string | null; outsideUrl: string | null; type: string; reason: string | null;
  misunderstood: string; correctIdea: string; recognizeNextTime: string; createdAt: string;
};
export type PullResponse =
  | { cursor: string; unchanged: true }
  | { cursor: string; unchanged: false; state: SyncState | null; notes: ServerNote[]; mistakes: ServerMistake[]; next: string | null };

export type ApiErrorBody = { error: { code: string; message: string } };
