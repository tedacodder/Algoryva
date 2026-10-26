/**
 * The Python engine for the whole app. It lives outside any screen, so leaving the Python Runner does not reload the runtime.
 * The runtime files are copied and the page is written once per install; the WebView that runs Python is mounted by PythonHost.
 */
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { PYTHON_FILES } from "./pythonFiles";
import { copyPercent, INLINED_FILES } from "./startup";
import { runnerHtml } from "./page";
import { editorHtml } from "./editorPage";
import { INITIAL_ENGINE, reduceEngine, type EngineState, type PageMessage } from "./engineState";

const DIR = `${FileSystem.documentDirectory}python/`;

export type RunOutcome = { ok: boolean; stdout: string; stderr: string; error: string | null; ms: number };

type Listener = () => void;
type PageView = { injectJavaScript(js: string): void };

let state: EngineState = INITIAL_ENGINE;
const listeners = new Set<Listener>();
let session = 0;
let view: PageView | null = null;
let pending: ((r: RunOutcome) => void) | null = null;
let preparing: Promise<string> | null = null;

function setState(next: EngineState) {
  state = next;
  listeners.forEach((l) => l());
}

function patch(p: Partial<EngineState>) {
  setState({ ...state, ...p });
}

/** Copies the runtime and writes the page, once. Later calls reuse the result. */
function prepare(): Promise<string> {
  if (!preparing) {
    preparing = (async () => {
      const pagePath = `${DIR}runner.html`;
      await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
      const total = PYTHON_FILES.reduce((n, f) => n + f.bytes, 0);
      let done = 0;
      for (const f of PYTHON_FILES) {
        const dest = `${DIR}${f.name}`;
        patch({ stage: "copying", copyName: f.name, copyPct: copyPercent(done, total) });
        if (!(await FileSystem.getInfoAsync(dest)).exists) {
          const asset = Asset.fromModule(f.asset);
          await asset.downloadAsync();
          if (!asset.localUri) throw new Error(`asset ${f.name} has no local file`);
          await FileSystem.copyAsync({ from: asset.localUri, to: dest });
        }
        done += f.bytes;
        patch({ copyPct: copyPercent(done, total) });
      }
      const editorPath = `${DIR}editor.html`;
      if (!(await FileSystem.getInfoAsync(editorPath)).exists) {
        await FileSystem.writeAsStringAsync(editorPath, editorHtml(DIR));
      }
      if (!(await FileSystem.getInfoAsync(pagePath)).exists) {
        const moduleSource = await FileSystem.readAsStringAsync(`${DIR}pyodide.asm.mjs`);
        const inlined: Record<string, string> = {};
        for (const name of INLINED_FILES) {
          inlined[name] = await FileSystem.readAsStringAsync(`${DIR}${name}`, { encoding: "base64" });
        }
        await FileSystem.writeAsStringAsync(pagePath, runnerHtml(DIR, moduleSource, inlined));
      }
      return pagePath;
    })();
  }
  return preparing.catch((e) => {
    preparing = null;
    throw e;
  });
}

function finishPending(r: RunOutcome) {
  const resolve = pending;
  pending = null;
  resolve?.(r);
}

export const engine = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getState(): EngineState {
    return state;
  },

  getSession(): number {
    return session;
  },

  /** Called by PythonHost with the WebView that runs the page. */
  attach(v: PageView | null) {
    view = v;
  },

  /** Starts Python if it is not already running. Safe to call on every visit. */
  async start(): Promise<void> {
    if (state.stage === "ready" || state.stage === "starting" || state.stage === "copying") return;
    try {
      const uri = await prepare();
      session += 1;
      patch({ ...INITIAL_ENGINE, stage: "starting", uri, startedAt: Date.now() });
    } catch (e) {
      patch({ stage: "error", error: e instanceof Error ? e.message : String(e) });
    }
  },

  /** Reloads the runtime. Used by Stop, and after an error. */
  restart(): void {
    if (!state.uri) {
      void engine.start();
      return;
    }
    finishPending({ ok: false, stdout: "", stderr: "", error: "Stopped. Python is starting again.", ms: 0 });
    session += 1;
    patch({ ...INITIAL_ENGINE, stage: "starting", uri: state.uri, startedAt: Date.now() });
  },

  pageLoaded(): void {
    if (!state.pageLoaded) patch({ pageLoaded: true });
  },

  /** Runs a program in the runtime. Resolves with what it printed, or with an error if Python is not ready. */
  run(code: string, lines: string[]): Promise<RunOutcome> {
    if (state.stage !== "ready" || !view) {
      return Promise.resolve({ ok: false, stdout: "", stderr: "", error: "Python is still starting.", ms: 0 });
    }
    if (pending) {
      return Promise.resolve({ ok: false, stdout: "", stderr: "", error: "A program is already running.", ms: 0 });
    }
    return new Promise<RunOutcome>((resolve) => {
      pending = resolve;
      view?.injectJavaScript(`runCode(${JSON.stringify(code)}, ${JSON.stringify(lines)}); true;`);
    });
  },

  /** Handles one message from the page. */
  onMessage(raw: string): void {
    let m: PageMessage | { kind: "result"; stdout?: string; stderr?: string; error?: string | null; ms?: number };
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (m.kind === "result") {
      finishPending({ ok: !m.error, stdout: m.stdout ?? "", stderr: m.stderr ?? "", error: m.error ?? null, ms: m.ms ?? 0 });
      return;
    }
    if (m.kind === "error" && pending) {
      finishPending({ ok: false, stdout: "", stderr: "", error: m.text ?? "Python reported an error.", ms: 0 });
    }
    if (m.kind === "ready") {
      patch({ pageLoaded: true });
    }
    setState(reduceEngine(state, m));
  },
};
