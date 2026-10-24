import type { Frame, GraphFrame, GridFrame } from "../../lib/viz/steps";
import type { Palette } from "../../lib/ui/palette";

/** What the player draws: a title plus frames of one kind. Lesson visualizations and interactive algorithms both map to this. */
export type VizView =
  | { kind: "array"; title: string; frames: Frame[] }
  | { kind: "graph"; title: string; frames: GraphFrame[] }
  | { kind: "grid"; title: string; frames: GridFrame[] };

/** Colours for array marks, per theme. A mark is a short label such as "lo", "hi", "mid", "L", "R", "win", "new". */
export function markStyle(c: Palette, label: string | undefined): { bg: string; border: string } {
  const dark = c.mode === "dark";
  const pick = (light: [string, string], darkPair: [string, string]) => ({ bg: dark ? darkPair[0] : light[0], border: dark ? darkPair[1] : light[1] });
  switch (label) {
    case "lo": case "hi": return pick(["#DBEAFE", "#2563EB"], ["#1E3A5F", "#60A5FA"]);
    case "mid": return pick(["#EDE9FE", "#7C3AED"], ["#4C1D95", "#A78BFA"]);
    case "L": case "R": return pick(["#D1FAE5", "#059669"], ["#064E3B", "#34D399"]);
    case "win": return pick(["#DCFCE7", "#16A34A"], ["#1C3A2E", "#4ADE80"]);
    case "new": case "add": case "cur": return pick(["#FEF3C7", "#D97706"], ["#713F12", "#FBBF24"]);
    case "pick": return pick(["#E0F2FE", "#0284C7"], ["#0C4A6E", "#38BDF8"]);
    case "from": case "skip": return pick(["#E4E4E7", "#71717A"], ["#3F3F46", "#A1A1AA"]);
    default: return { bg: c.sunken, border: c.lineStrong };
  }
}
