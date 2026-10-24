import type { ContentResponse } from "../api/types";

/** A small but structurally complete content snapshot, for tests of storage and refresh. */
export function sampleContent(version = "v1"): ContentResponse {
  return {
    version,
    topics: [
      { slug: "python-basics", title: "Python basics", level: "Foundations", prereqs: [], status: "PUBLISHED", position: 0 },
      { slug: "lists-tuples", title: "Lists and tuples", level: "Foundations", prereqs: ["python-basics"], status: "PUBLISHED", position: 1 },
    ],
    lessons: [
      {
        topicSlug: "python-basics",
        source: "builtin",
        minutes: 10,
        hook: "Variables hold values.",
        objectives: ["Assign a variable"],
        sections: [{ kind: "intuition", id: "s1", title: "Idea", paras: ["A variable is a name."] }],
        cheatSheet: [{ label: "assign", value: "x = 1" }],
        summary: ["Names point at values."],
        checks: [{ q: "Which assigns?", options: ["x = 1", "x == 1"], answer: 0, why: "A single = assigns." }],
      },
      { topicSlug: "lists-tuples", source: "custom", markdown: "# Custom lesson" },
    ],
    problems: [
      {
        id: "p1", slug: "sum-two", title: "Sum two", kind: "INTERNAL", difficulty: "EASY", source: null, externalUrl: null,
        statement: "Add two numbers.", inputSpec: "two ints", outputSpec: "their sum", constraints: null,
        timeLimitMs: 1000, memoryLimitMb: 256, position: 0, topics: ["python-basics"],
        samples: [{ input: "1 2", expected: "3", explanation: null }], testCount: 3,
      },
    ],
  };
}
