import * as FileSystem from "expo-file-system/legacy";
import { addReport, formatForSharing, makeReport, type CrashReport } from "./crashLog";

/** The file that holds the reports, in the app's own private storage. */
export const CRASH_FILE = `${FileSystem.documentDirectory}crash-reports.json`;

export async function readReports(): Promise<CrashReport[]> {
  try {
    const info = await FileSystem.getInfoAsync(CRASH_FILE);
    if (!info.exists) return [];
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(CRASH_FILE)) as unknown;
    return Array.isArray(parsed) ? (parsed as CrashReport[]) : [];
  } catch {
    return [];
  }
}

export async function clearReports(): Promise<void> {
  await FileSystem.deleteAsync(CRASH_FILE, { idempotent: true });
}

export async function reportsText(): Promise<string> {
  return formatForSharing(await readReports());
}

type Handler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = { getGlobalHandler(): Handler; setGlobalHandler(h: Handler): void };

/**
 * Records uncaught errors to the phone, then passes them on to the previous handler (so the app still behaves as usual).
 * Call once, when the app starts.
 */
export function installCrashRecorder(): void {
  const eu = (globalThis as unknown as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!eu) return;
  const previous = eu.getGlobalHandler();
  eu.setGlobalHandler((error, isFatal) => {
    void (async () => {
      const list = await readReports();
      const next = addReport(list, makeReport(error, Boolean(isFatal), new Date()));
      await FileSystem.writeAsStringAsync(CRASH_FILE, JSON.stringify(next));
    })().catch(() => undefined);
    previous(error, isFatal);
  });
}
