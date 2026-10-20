import { createHash } from "node:crypto";

/**
 * Deterministic JSON: object keys sorted by code unit, Dates as ISO strings, undefined dropped. The same value always
 * serialises to the same string, whatever order the object's keys or the database rows arrived in. Arrays keep their order,
 * so callers sort arrays that represent sets before hashing.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalise(value));
}

function normalise(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(normalise);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) if (o[k] !== undefined) out[k] = normalise(o[k]);
    return out;
  }
  return v;
}

export const sha256Hex = (s: string): string => createHash("sha256").update(s).digest("hex");
export const sha256Base64Url = (s: string, bytes = 16): string => createHash("sha256").update(s).digest().subarray(0, bytes).toString("base64url");

/** Code-unit string order, so JavaScript sorting never depends on the server's locale. */
export const byCode = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
