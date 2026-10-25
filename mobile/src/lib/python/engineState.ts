/**
 * The Python engine's state, and how each message from the runtime page changes it. Pure, so it is tested without a phone.
 */
import { startPercent } from "./startup";

export type EngineStage = "idle" | "copying" | "starting" | "ready" | "error";

export type EngineState = {
  stage: EngineStage;
  copyPct: number;
  copyName: string;
  uri: string | null;
  stagePct: number;
  stageText: string | null;
  loaded: string[];
  lastFetch: string | null;
  pageLoaded: boolean;
  startedAt: number;
  error: string | null;
};

export const INITIAL_ENGINE: EngineState = {
  stage: "idle", copyPct: 0, copyName: "", uri: null, stagePct: 0, stageText: null,
  loaded: [], lastFetch: null, pageLoaded: false, startedAt: 0, error: null,
};

export type PageMessage =
  | { kind: "stage"; text?: string; pct?: number }
  | { kind: "fetch"; text?: string; status?: string }
  | { kind: "ready" }
  | { kind: "error"; text?: string };

export function reduceEngine(s: EngineState, m: PageMessage): EngineState {
  switch (m.kind) {
    case "stage":
      return s.stage === "starting" ? { ...s, stageText: m.text ?? s.stageText, stagePct: m.pct ?? s.stagePct } : s;
    case "fetch": {
      if (s.stage !== "starting" && s.stage !== "ready") return s;
      const name = m.text;
      const loaded = m.status === "done" && name && !s.loaded.includes(name) ? [...s.loaded, name] : s.loaded;
      return { ...s, loaded, lastFetch: `${name ?? "file"}: ${m.status ?? ""}` };
    }
    case "ready":
      return s.stage === "starting" ? { ...s, stage: "ready", stagePct: 100, stageText: null, error: null } : s;
    case "error":
      return s.stage === "starting" ? { ...s, stage: "error", error: m.text ?? "Python could not start." } : s;
  }
}

/** Percentage to show while starting. */
export function startingPercent(s: EngineState): number {
  return startPercent(s.loaded, s.stagePct, s.stage === "ready");
}

