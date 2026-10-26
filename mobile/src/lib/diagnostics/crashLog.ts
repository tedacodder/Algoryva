/**
 * Crash reports, kept on the phone only. Nothing is sent anywhere by the app: the user chooses to share a report.
 * Emails, tokens and long numbers are removed before a report is stored, and only the most recent reports are kept.
 */
export const MAX_REPORTS = 20;
const MAX_TEXT = 2000;

export type CrashReport = { at: string; fatal: boolean; name: string; message: string; stack: string };

/** Removes anything that could identify a person or a session. */
export function redact(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/(bearer\s+|token[=:]\s*|password[=:]\s*)[^\s,;"']+/gi, "$1[removed]")
    .replace(/\b[0-9a-f]{32,}\b/gi, "[id]")
    .replace(/\b\d{9,}\b/g, "[number]")
    .slice(0, MAX_TEXT);
}

export function makeReport(error: unknown, fatal: boolean, now: Date): CrashReport {
  const e = error instanceof Error ? error : new Error(String(error));
  return {
    at: now.toISOString(),
    fatal,
    name: redact(e.name || "Error"),
    message: redact(e.message || ""),
    stack: redact(e.stack ?? ""),
  };
}

/** Adds a report and keeps only the newest MAX_REPORTS. */
export function addReport(existing: CrashReport[], report: CrashReport): CrashReport[] {
  return [...existing, report].slice(-MAX_REPORTS);
}

/** The text the user can share: one block per report, oldest first. */
export function formatForSharing(reports: CrashReport[]): string {
  if (reports.length === 0) return "No crash reports on this phone.";
  return reports
    .map((r) => `[${r.at}] ${r.fatal ? "FATAL" : "error"} ${r.name}: ${r.message}\n${r.stack}`)
    .join("\n\n");
}
