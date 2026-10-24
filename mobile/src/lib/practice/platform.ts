/**
 * Names the practice site behind an external problem link, so the app can say where a problem opens. Only https links are accepted;
 * anything else is shown as a plain link, never opened.
 */
export type Platform = { name: string; host: string } | null;

const KNOWN: { host: string; name: string }[] = [
  { host: "leetcode.com", name: "LeetCode" },
  { host: "codeforces.com", name: "Codeforces" },
  { host: "hackerrank.com", name: "HackerRank" },
];

export function platformOf(url: string | null | undefined): Platform {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "");
  const known = KNOWN.find((k) => host === k.host || host.endsWith(`.${k.host}`));
  return { name: known?.name ?? host, host };
}

/** Only https links are opened from the app. */
export function isOpenableLink(url: string | null | undefined): boolean {
  return platformOf(url) !== null;
}
