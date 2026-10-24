import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Stack } from "expo-router";
import { PYTHON_FILES } from "../../lib/python/pythonFiles";
import { makeStyles, MIN_TOUCH } from "../../lib/ui/theme";
import { Button, Field, Notice } from "../../components/common/Controls";
import { getDatabase } from "../../lib/db/open";
import { checkSnippet, deleteSnippet, listSnippets, saveSnippet, type Snippet } from "../../lib/python/snippets";
import { applyNewline, insertAt, INDENT, lineNumbers } from "../../lib/python/editorLogic";
import { tokenize } from "../../lib/highlight";
import { FONTS } from "../../lib/ui/fonts";
import { findMatches, nextMatch, replaceAll, suggestionsAt } from "../../lib/python/completion";

/**
 * Python Runner: write, run and save Python programs on the phone, offline.
 * The Python runtime (Pyodide) is copied from the app once, then loaded in a WebView. Run sends the code to that WebView; Stop reloads
 * it, which ends a program that is stuck in a loop.
 */
const DIR = `${FileSystem.documentDirectory}python/`;
const SYMBOLS = ["(", ")", "[", "]", "{", "}", ":", '"', "'", "=", "+", "-", "*", "/", "%", "#", "<", ">", "!", "_", ".", ",", "tab"];
const SAMPLE = 'name = input("Your name: ")\nfor i in range(3):\n    print(f"Hello {name}, step {i + 1}")\n';

const runnerHtml = (base: string, moduleSource: string) => `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="background:#fff;margin:0">
<script>
var py = null;
function send(o) { window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
window.onerror = function (msg, src, line) { send({ kind: "error", text: "script error: " + msg + " line " + line }); };
function lastLine(e) { var t = String((e && e.message) || e || "Error").trim(); var lines = t.split("\\n").filter(function (l) { return l.trim().length > 0; }); return lines[lines.length - 1] || "Error"; }
window.runCode = function (code, lines) {
  if (!py) { send({ kind: "error", text: "Python is not ready yet." }); return; }
  var out = [], err = [], queue = lines.slice(), start = Date.now(), error = null;
  py.setStdout({ batched: function (s) { out.push(s + "\\n"); } });
  py.setStderr({ batched: function (s) { err.push(s + "\\n"); } });
  py.setStdin({ stdin: function () { return queue.length ? queue.shift() : undefined; } });
  try { py.runPython(code, { globals: py.toPy({}) }); } catch (e) { error = lastLine(e); err.push(error + "\\n"); }
  send({ kind: "result", stdout: out.join(""), stderr: err.join(""), error: error, ms: Date.now() - start });
};
</script>
<script src="${base}pyodide.js"></script>
<script>
var MODULE_SOURCE = ${JSON.stringify(moduleSource)};
var moduleUrl = URL.createObjectURL(new Blob([MODULE_SOURCE], { type: "text/javascript" }));
import(moduleUrl).then(function (m) {
  return loadPyodide({ indexURL: "${base}", createPyodideModule: m.default });
}).then(function (p) { py = p; send({ kind: "ready" }); })
  .catch(function (e) { send({ kind: "error", text: "Python could not start: " + (e && e.message ? e.message : e) }); });
</script></body></html>`;

type Stage = { kind: "copying" } | { kind: "loading"; html: string } | { kind: "ready"; html: string } | { kind: "error"; message: string };
type Output = { stdout: string; stderr: string; error: string | null; ms: number } | null;

export default function PythonRunner() {
  const { c, s } = useStyles();
  const [stage, setStage] = useState<Stage>({ kind: "copying" });
  const [session, setSession] = useState(0);
  const [code, setCode] = useState(SAMPLE);
  const [sel, setSel] = useState({ start: SAMPLE.length, end: SAMPLE.length });
  const selRef = useRef(sel);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState<Output>(null);
  const [running, setRunning] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<Snippet[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [find, setFind] = useState("");
  const [replacement, setReplacement] = useState("");
  const matches = findMatches(code, find);
  const sugg = sel.start === sel.end ? suggestionsAt(code, sel.start) : { start: sel.start, word: "", options: [] as string[] };
  const webRef = useRef<WebView | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
        for (const f of PYTHON_FILES) {
          const dest = `${DIR}${f.name}`;
          if ((await FileSystem.getInfoAsync(dest)).exists) continue;
          const asset = Asset.fromModule(f.asset);
          await asset.downloadAsync();
          if (!asset.localUri) throw new Error(`asset ${f.name} has no local file`);
          await FileSystem.copyAsync({ from: asset.localUri, to: dest });
        }
        const moduleSource = await FileSystem.readAsStringAsync(`${DIR}pyodide.asm.mjs`);
        if (alive) setStage({ kind: "loading", html: runnerHtml(DIR, moduleSource) });
      } catch (e) {
        if (alive) setStage({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const ready = stage.kind === "ready";

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { kind: string; text?: string; stdout?: string; stderr?: string; error?: string | null; ms?: number };
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.kind === "ready") {
      setStage((st) => (st.kind === "loading" || st.kind === "ready" ? { kind: "ready", html: st.html } : st));
    } else if (m.kind === "result") {
      runningRef.current = false;
      setRunning(false);
      setOutput({ stdout: m.stdout ?? "", stderr: m.stderr ?? "", error: m.error ?? null, ms: m.ms ?? 0 });
    } else if (m.kind === "error") {
      runningRef.current = false;
      setRunning(false);
      setMessage(m.text ?? "Python reported an error.");
    }
  };

  const run = () => {
    if (!ready || runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setOutput(null);
    setMessage(null);
    const lines = stdin.length > 0 ? stdin.split("\n") : [];
    webRef.current?.injectJavaScript(`runCode(${JSON.stringify(code)}, ${JSON.stringify(lines)}); true;`);
  };

  const stop = () => {
    // A program stuck in a loop blocks its own thread, so the only reliable stop is to reload the runtime.
    runningRef.current = false;
    setRunning(false);
    setOutput({ stdout: "", stderr: "", error: "Stopped. The runtime was restarted; it takes a moment to be ready again.", ms: 0 });
    setStage((st) => (st.kind === "ready" ? { kind: "loading", html: st.html + `<!--${session}-->` } : st));
    setSession((n) => n + 1);
  };

  const edit = (t: string) => {
    const delta = t.length - code.length;
    const cursor = Math.max(0, Math.min(t.length, selRef.current.start + delta));
    const r = applyNewline(code, t, cursor);
    setCode(r.text);
    const next = { start: r.cursor, end: r.cursor };
    selRef.current = next;
    setSel(next);
  };

  const insert = (text: string) => {
    const { start, end } = selRef.current;
    const r = insertAt(code, start, end, text);
    setCode(r.text);
    const next = { start: r.cursor, end: r.cursor };
    selRef.current = next;
    setSel(next);
  };

  const press = (key: string) => insert(key === "tab" ? INDENT : key);

  const complete = (option: string) => {
    const r = insertAt(code, sugg.start, sel.start, option);
    setCode(r.text);
    const next = { start: r.cursor, end: r.cursor };
    selRef.current = next;
    setSel(next);
  };

  const findNext = () => {
    const at = nextMatch(matches, selRef.current.end);
    if (at === null) return setMessage(find ? `No matches for "${find}".` : "Type something to find.");
    const next = { start: at, end: at + find.length };
    selRef.current = next;
    setSel(next);
    setMessage(`Match ${matches.indexOf(at) + 1} of ${matches.length}.`);
  };

  const replaceEverywhere = () => {
    if (find.length === 0) return setMessage("Type something to find first.");
    const r = replaceAll(code, find, replacement);
    setCode(r.text);
    setMessage(r.count === 0 ? `No matches for "${find}".` : `Replaced ${r.count} ${r.count === 1 ? "match" : "matches"}.`);
  };

  const doSave = async () => {
    const check = checkSnippet(name, code);
    if (!check.ok) return setMessage(check.error);
    const db = await getDatabase();
    await saveSnippet(db, { id: `${Date.now()}`, name: check.name, code, now: new Date() });
    setMessage(`Saved "${check.name}" on this device.`);
    setName("");
  };

  const openSaved = async () => {
    setSaved(await listSnippets(await getDatabase()));
    setShowSaved((v) => !v);
  };

  if (stage.kind === "copying") {
    return (
      <View style={s.center}>
        <ActivityIndicator color={c.brand} />
        <Text style={s.text}>Preparing Python on this phone…</Text>
      </View>
    );
  }
  if (stage.kind === "error") {
    return <ScrollView contentContainerStyle={s.pad}><Text style={s.error}>{`Python could not be prepared: ${stage.message}`}</Text></ScrollView>;
  }

  const html = stage.html;
  const lineCount = code.split("\n").length;
  const tokenColor = (t: string): string =>
    t === "kw" ? c.tok.kw : t === "str" ? c.tok.str : t === "num" ? c.tok.num : t === "com" ? c.tok.com : t === "fn" ? c.tok.fn : t === "bi" ? c.tok.bi : c.codeFg;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: "Python Runner" }} />
      <View style={s.hidden}>
        <WebView
          originWhitelist={["*"]}
          source={{ html, baseUrl: `file://${DIR}` }}
          ref={webRef as never}
          allowFileAccess
          allowUniversalAccessFromFileURLs
          allowingReadAccessToURL={DIR}
          javaScriptEnabled
          onMessage={onMessage}
          onError={(e: { nativeEvent: { description: string } }) => setMessage(`Python: ${e.nativeEvent.description}`)}
          style={s.webview}
        />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.toolbar}>
          <Button label={ready ? (running ? "Running…" : "Run") : "Starting…"} variant="primary" icon="play" disabled={!ready || running} onPress={run} />
          <Button label="Stop" variant="danger" icon="pause" disabled={!running} onPress={stop} />
          <Button label="Saved" icon="list" onPress={openSaved} />
          <Button label={showFind ? "Hide find" : "Find"} icon="search" onPress={() => setShowFind((v) => !v)} />
        </View>
        {!ready ? <Text style={s.hint}>Python is starting. This takes a few seconds the first time.</Text> : null}
        {message ? <Notice text={message} tone="info" /> : null}

        <ScrollView horizontal={false} style={s.editorBox} nestedScrollEnabled>
          <View style={s.editorRow}>
            <Text style={s.gutter} selectable={false}>{lineNumbers(code)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.code, s.overlay]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no">
                {tokenize(code).map((t, i) => (
                  <Text key={i} style={{ color: tokenColor(t.t), fontStyle: t.t === "com" ? "italic" : "normal", fontFamily: t.t === "kw" ? FONTS.monoBold : undefined }}>{t.v}</Text>
                ))}
              </Text>
              <TextInput
              value={code}
              onChangeText={edit}
              onSelectionChange={(e) => {
                selRef.current = e.nativeEvent.selection;
              }}
              selection={sel}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
              accessibilityLabel={`Python code, ${lineCount} lines`}
              style={[s.code, s.typed]}
            />
            </View>
          </View>
        </ScrollView>

        {sugg.options.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.symbols} contentContainerStyle={s.symbolsInner} keyboardShouldPersistTaps="always">
            {sugg.options.map((o) => (
              <Pressable key={o} onPress={() => complete(o)} accessibilityRole="button" accessibilityLabel={`Complete as ${o}`} style={[s.key, s.suggest]}>
                <Text style={[s.keyText, { color: c.brand }]}>{o}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.symbols} contentContainerStyle={s.symbolsInner}>
          {SYMBOLS.map((k) => (
            <Pressable key={k} onPress={() => press(k)} accessibilityRole="button" accessibilityLabel={k === "tab" ? "Indent" : `Insert ${k}`} style={s.key}>
              <Text style={s.keyText}>{k === "tab" ? "⇥" : k}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {showFind ? (
          <View style={s.panel}>
            <Text style={s.panelTitle}>{matches.length > 0 ? `${matches.length} matches` : "Find and replace"}</Text>
            <Field label="Find" value={find} onChangeText={setFind} autoCorrect={false} autoCapitalize="none" />
            <Field label="Replace with" value={replacement} onChangeText={setReplacement} autoCorrect={false} autoCapitalize="none" />
            <View style={s.toolbar}>
              <Button label="Next match" onPress={findNext} />
              <Button label="Replace all" variant="primary" onPress={replaceEverywhere} />
            </View>
          </View>
        ) : null}

        <Field label="Input for input()" hint="One line per input() call, in order." value={stdin} onChangeText={setStdin} multiline autoCapitalize="none" autoCorrect={false} />

        <View style={s.panel} accessibilityLiveRegion="polite">
          <Text style={s.panelTitle}>Output</Text>
          {running ? <Text style={s.muted}>Running…</Text> : null}
          {!output && !running ? <Text style={s.muted}>Press Run to see the output here.</Text> : null}
          {output ? (
            <>
              <Text style={s.out} selectable>{output.stdout || (output.error ? "" : "(no output)")}</Text>
              {output.stderr ? <Text style={s.err} selectable>{output.stderr}</Text> : null}
              {output.error && !output.stderr.includes(output.error) ? <Text style={s.err}>{output.error}</Text> : null}
              {output.ms > 0 ? <Text style={s.muted}>{`Finished in ${output.ms} ms`}</Text> : null}
            </>
          ) : null}
        </View>

        <View style={s.saveRow}>
          <View style={{ flex: 1 }}>
            <Field label="Save as" value={name} onChangeText={setName} placeholder="Program name" autoCorrect={false} />
          </View>
          <Button label="Save" onPress={doSave} />
        </View>

        {showSaved ? (
          <View style={s.panel}>
            <Text style={s.panelTitle}>Saved programs</Text>
            {saved.length === 0 ? <Text style={s.muted}>Nothing saved yet.</Text> : null}
            {saved.map((p) => (
              <View key={p.id} style={s.savedRow}>
                <Pressable onPress={() => { setCode(p.code); setShowSaved(false); }} accessibilityRole="button" accessibilityLabel={`Open ${p.name}`} style={{ flex: 1, minHeight: MIN_TOUCH }}>
                  <Text style={s.savedName}>{p.name}</Text>
                </Pressable>
                <Button label="Delete" variant="danger" onPress={async () => { await deleteSnippet(await getDatabase(), p.id); setSaved(await listSnippets(await getDatabase())); }} />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c, f) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: c.bg, padding: 24 },
  pad: { padding: 20, backgroundColor: c.bg },
  text: { fontFamily: f.regular, fontSize: 15, color: c.fg },
  error: { fontFamily: f.regular, fontSize: 15, lineHeight: 22, color: c.bad },
  hidden: { height: 2, width: 2, overflow: "hidden", opacity: 0 },
  webview: { height: 2, width: 2 },
  content: { padding: 14, paddingBottom: 48, gap: 12 },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hint: { fontFamily: f.regular, fontSize: 13, color: c.muted },
  editorBox: { maxHeight: 300, borderRadius: 14, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.codeBg },
  editorRow: { flexDirection: "row" },
  gutter: { fontFamily: f.mono, fontSize: 14, lineHeight: 21, color: c.muted, paddingHorizontal: 10, paddingTop: 10, textAlign: "right", minWidth: 44, backgroundColor: c.sunken },
  code: { fontFamily: f.mono, fontSize: 14, lineHeight: 21, color: c.codeFg, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14, minHeight: 220 },
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  typed: { color: "transparent", textAlignVertical: "top" },
  symbols: { flexGrow: 0 },
  symbolsInner: { gap: 6, paddingVertical: 2 },
  suggest: { borderColor: "transparent", backgroundColor: c.tint.brand, paddingHorizontal: 14 },
  key: { minWidth: 40, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  keyText: { fontFamily: f.mono, fontSize: 16, color: c.fg },
  panel: { borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, padding: 14, gap: 8 },
  panelTitle: { fontFamily: f.bold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: c.muted },
  out: { fontFamily: f.mono, fontSize: 14, lineHeight: 21, color: c.fg },
  err: { fontFamily: f.mono, fontSize: 14, lineHeight: 21, color: c.bad },
  muted: { fontFamily: f.regular, fontSize: 13, color: c.muted },
  saveRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  savedName: { fontFamily: f.semibold, fontSize: 15, color: c.fg },
}));

