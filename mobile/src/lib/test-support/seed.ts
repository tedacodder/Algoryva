import type { SqlDb } from "../db/sql";
import { storeContentSnapshot } from "../content/repository";
import { sampleContent } from "./fixtures";
import type { ContentResponse } from "../api/types";

/** Stores a content snapshot (topics, lessons, problems) so the local rules have something to check against. */
export async function seedContent(db: SqlDb, data: ContentResponse = withExternal(sampleContent())): Promise<void> {
  await storeContentSnapshot(db, { etag: '"test"', data }, new Date("2026-10-01T00:00:00Z"));
}

/** Adds one published EXTERNAL problem, so the external-solve rules can be exercised. */
export function withExternal(data: ContentResponse): ContentResponse {
  return {
    ...data,
    problems: [
      ...data.problems,
      {
        id: "ext-1", slug: "ext-one", title: "External one", kind: "EXTERNAL", difficulty: "MEDIUM", source: "codeforces",
        externalUrl: "https://codeforces.com/problemset/problem/1/A", statement: null, inputSpec: null, outputSpec: null,
        constraints: null, timeLimitMs: null, memoryLimitMb: null, position: 1, topics: [], samples: [], testCount: 0,
      },
    ],
  };
}

export const T0 = new Date("2026-10-20T10:00:00Z");
export const DAY = 86_400_000;
