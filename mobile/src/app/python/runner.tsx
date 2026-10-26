import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { makeStyles, MIN_TOUCH, useTheme } from "../../lib/ui/theme";
import { Button, Field, Notice } from "../../components/common/Controls";
import { getDatabase } from "../../lib/db/open";
import { checkSnippet, deleteSnippet, listSnippets, saveSnippet, type Snippet } from "../../lib/python/snippets";
import { INDENT } from "../../lib/python/editorLogic";
import { startingText, startupHint } from "../../lib/python/startup";
import { startingPercent } from "../../lib/python/engineState";
import { engine, type RunOutcome } from "../../lib/python/engine";
import { CodeEditor, type EditorHandle } from "../../components/python/CodeEditor";
import * as FileSystem from "expo-file-system/legacy";

/**
 * Python Runner. The editor is CodeMirror (see components/python/CodeEditor.tsx); the runtime is owned by the app (lib/python/engine.ts),
 * so leaving this screen does not reload it. Your code is saved as a draft while you type, and comes back when you return.
 */
const SYMBOLS = ["(", ")", "[", "]", "{", "}", ":", '"', "'", "=", "+", "-", "*", "/", "%", "#", "<", ">", "!", "_", ".", ",", "tab"];
const SAMPLE = 'name = input("Your name: ")\nfor i in range(3):\n    print(f"Hello {name}, step {i + 1}")\n';
const DRAFT_ID = "__draft__";
const DIR = `${FileSystem.documentDirectory}python/`;

export default function PythonRunner() {
  const { c, s } = useStyles();
  const { palette } = useTheme();
  const dark = palette.codeBg === "#0F1420";
  const st = useSyncExternalStore(engine.subscribe, engine.getState);
  const [code, setCode] = useState(SAMPLE);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState<RunOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<Snippet[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [now, setNow] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const editorRef = useRef<EditorHandle | null>(null);

  useEffect(() => {
    void engine.start();
  }, []);

  // Bring back the last draft.
  useEffect(() => {
    let alive = true;
    (async () => {
      const all = await listSnippets(await getDatabase());
      const draft = all.find((x) => x.id === DRAFT_ID);
      if (alive) {
        if (draft) setCode(draft.code);
        setDraftLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Save the draft as you type, after a short pause.
  useEffect(() => {
    if (!draftLoaded) return;
    const id = setTimeout(() => {
      void getDatabase().then((db) => saveSnippet(db, { id: DRAFT_ID, name: "Draft", code, now: new Date() }));
    }, 800);
    return () => clearTimeout(id);
  }, [code, draftLoaded]);

  // A clock for the start-up timer.
  useEffect(() => {
    if (st.stage !== "starting") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [st.stage]);

  const ready = st.stage === "ready";
  const elapsed = now > 0 ? Math.max(0, Math.floor((now - st.startedAt) / 1000)) : 0;
  const hint = st.stage === "starting" ? startupHint(elapsed) : null;
  const pageHint = st.stage === "starting" && !st.pageLoaded && elapsed >= 15 ? "The Python page has not opened yet. Tap Restart Python." : null;

  const run = async () => {
    if (running || !ready) return;
    setRunning(true);
    setOutput(null);
    setMessage(null);
    const lines = stdin.length > 0 ? stdin.split("\n") : [];
    const r = await engine.run(code, lines);
    setRunning(false);
    setOutput(r);
  };

  const stop = () => {
    setRunning(false);
    setOutput({ ok: false, stdout: "", stderr: "", error: "Stopped. Python is starting again; this takes a moment.", ms: 0 });
    engine.restart();
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
    const all = await listSnippets(await getDatabase());
    setSaved(all.filter((x) => x.id !== DRAFT_ID));
    setSavedOpen(true);
  };

  const removeSaved = async (id: string) => {
    const db = await getDatabase();
    await deleteSnippet(db, id);
    setSaved((await listSnippets(db)).filter((x) => x.id !== DRAFT_ID));
  };

  const preparing = st.uri === null;

  // Shared pieces, used by both the normal and the full-screen layout.
  const editor = (height: number) => (
    <CodeEditor
      ref={editorRef}
      value={code}
      dark={dark}
      fontSize={fontSize}
      uri={`${DIR}editor.html`}
      dir={DIR}
      onChange={(text) => setCode(text)}
      style={height > 0 ? { height, width: "100%" } : { flex: 1, width: "100%" }}
    />
  );
  const symbolsRow = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.symbols} contentContainerStyle={s.symbolsInner}>
      {SYMBOLS.map((k) => (
        <Pressable key={k} onPress={() => editorRef.current?.insertText(k === "tab" ? INDENT : k)} accessibilityRole="button" accessibilityLabel={k === "tab" ? "Indent" : `Insert ${k}`} style={s.key} disabled={preparing}>
          <Text style={s.keyText}>{k === "tab" ? "⇥" : k}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
  const edit = (label: string, name: Parameters<EditorHandle["runCommand"]>[0], accessible: string) => (
    <Pressable key={name} onPress={() => editorRef.current?.runCommand(name)} accessibilityRole="button" accessibilityLabel={accessible} style={s.key} disabled={preparing}>
      <Text style={s.keyText}>{label}</Text>
    </Pressable>
  );
  const toolsRow = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.symbols} contentContainerStyle={s.symbolsInner}>
      {edit("↶", "undo", "Undo")}
      {edit("↷", "redo", "Redo")}
      {edit("⧉", "copyLineDown", "Duplicate line")}
      {edit("✕", "deleteLine", "Delete line")}
      {edit("#", "toggleComment", "Comment or uncomment")}
      {edit("→", "indentMore", "Indent")}
      {edit("←", "indentLess", "Outdent")}
      {edit("↵", "gotoLine", "Go to line")}
      <Pressable onPress={() => setFontSize((n) => Math.max(10, n - 1))} accessibilityRole="button" accessibilityLabel="Smaller text" style={s.key}><Text style={s.keyText}>A−</Text></Pressable>
      <Pressable onPress={() => setFontSize((n) => Math.min(24, n + 1))} accessibilityRole="button" accessibilityLabel="Larger text" style={s.key}><Text style={s.keyText}>A+</Text></Pressable>
    </ScrollView>
  );
  const outputPanel = (
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
  );

  const savedWindow = (
    <Modal visible={savedOpen} animationType="slide" onRequestClose={() => setSavedOpen(false)}>
      <View style={{ flex: 1, backgroundColor: c.bg, padding: 16, gap: 12 }}>
        <View style={s.toolbar}>
          <Button label="Close" icon="x" onPress={() => setSavedOpen(false)} />
        </View>
        <Text style={s.panelTitle}>Saved programs</Text>
        {saved.length === 0 ? <Text style={s.muted}>Nothing saved yet. Type a name under the editor and tap Save.</Text> : null}
        <ScrollView contentContainerStyle={{ gap: 10 }}>
          {saved.map((p) => (
            <View key={p.id} style={s.savedRow}>
              <Pressable
                onPress={() => {
                  setCode(p.code);
                  setSavedOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Open ${p.name}`}
                style={{ flex: 1, minHeight: MIN_TOUCH, justifyContent: "center" }}
              >
                <Text style={s.savedName}>{p.name}</Text>
                <Text style={s.muted}>{`Saved ${new Date(p.updatedAt).toLocaleString()}`}</Text>
              </Pressable>
              <Button label="Delete" variant="danger" onPress={() => void removeSaved(p.id)} />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );

  if (fullScreen) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Stack.Screen options={{ title: "Python Runner" }} />
        <View style={[s.toolbar, { paddingHorizontal: 10, paddingTop: 8 }]}>
          <Button label={ready ? (running ? "Running…" : "Run") : "Starting…"} variant="primary" icon="play" disabled={!ready || running} onPress={run} />
          <Button label="Find" icon="search" disabled={preparing} onPress={() => editorRef.current?.openSearch()} />
          <Button label="Exit full screen" icon="x" onPress={() => setFullScreen(false)} />
        </View>
        {savedWindow}
        <View style={{ flex: 1, marginHorizontal: 10, marginTop: 8, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: c.lineStrong }}>
          {preparing ? <Text style={[s.muted, { padding: 14 }]}>Preparing Python on this phone…</Text> : editor(0)}
        </View>
        <View style={[s.toolbar, { paddingHorizontal: 10, paddingTop: 6 }]}>
          <Button label="Saved" icon="list" onPress={openSaved} />
          <Button label="Save" icon="check" disabled={preparing} onPress={doSave} />
        </View>
        <View style={{ paddingHorizontal: 10, paddingTop: 6 }}>{symbolsRow}</View>
        <View style={{ paddingHorizontal: 10, paddingTop: 6 }}>{toolsRow}</View>
        <ScrollView style={{ maxHeight: 170, paddingHorizontal: 10, paddingVertical: 8 }} nestedScrollEnabled>{outputPanel}</ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: "Python Runner" }} />
      {savedWindow}
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.toolbar}>
          <Button label={ready ? (running ? "Running…" : "Run") : "Starting…"} variant="primary" icon="play" disabled={!ready || running} onPress={run} />
          <Button label="Stop" variant="danger" icon="pause" disabled={!running && st.stage !== "starting"} onPress={stop} />
          <Button label="Find" icon="search" disabled={preparing} onPress={() => editorRef.current?.openSearch()} />
          <Button label="Saved" icon="list" onPress={openSaved} />
        </View>

        {preparing ? (
          <View style={s.panel} accessibilityLiveRegion="polite">
            <ActivityIndicator color={c.brand} />
            {st.stage === "copying" ? (
              <>
                <Text style={s.pctText}>{`${st.copyPct}%`}</Text>
                <Text style={s.muted}>{`Copying Python to this phone: ${st.copyName}`}</Text>
              </>
            ) : (
              <Text style={s.muted}>Preparing Python on this phone…</Text>
            )}
            <Text style={s.muted}>This happens once. After that, Python stays ready while the app is open.</Text>
          </View>
        ) : fullScreen ? null : (
          <View style={s.editorBox}>{editor(340)}</View>
        )}

        {!fullScreen ? (
          <Button label="Full screen editor" icon="grid" disabled={preparing} onPress={() => setFullScreen(true)} />
        ) : null}

        {st.stage === "error" ? (
          <View style={s.panel} accessibilityLiveRegion="polite">
            <Text style={s.error}>{`Python could not start: ${st.error ?? "unknown error"}`}</Text>
            <Button label="Restart Python" variant="primary" onPress={() => engine.restart()} />
          </View>
        ) : null}

        {st.stage === "starting" ? (
          <View style={s.panel} accessibilityLiveRegion="polite">
            <Text style={s.panelTitle}>Starting Python</Text>
            <Text style={s.pctText}>{`${startingPercent(st)}%`}</Text>
            <View style={s.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: startingPercent(st) }}>
              <View style={[s.barFill, { width: `${startingPercent(st)}%` }]} />
            </View>
            <Text style={s.out}>{startingText(elapsed, st.stageText)}</Text>
            {st.lastFetch ? <Text style={s.muted}>{`Last file: ${st.lastFetch}`}</Text> : null}
            {pageHint ? <Text style={s.hint}>{pageHint}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
            <Button label="Restart Python" onPress={() => engine.restart()} />
          </View>
        ) : null}

        {message ? <Notice text={message} tone="info" /> : null}

        {!fullScreen ? symbolsRow : null}
        {!fullScreen ? toolsRow : null}
        {!fullScreen ? <Field label="Input for input()" hint="One line per input() call, in order." value={stdin} onChangeText={setStdin} multiline autoCapitalize="none" autoCorrect={false} /> : null}
        {!fullScreen ? outputPanel : null}

        <View style={s.saveRow}>
          <View style={{ flex: 1 }}>
            <Field label="Save as" value={name} onChangeText={setName} placeholder="Program name" autoCorrect={false} />
          </View>
          <Button label="Save" onPress={doSave} />
        </View>

      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c, f) => ({
  content: { padding: 14, paddingBottom: 48, gap: 12 },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hint: { fontFamily: f.regular, fontSize: 13, color: c.muted },
  editorBox: { borderRadius: 14, borderWidth: 1, borderColor: c.lineStrong, overflow: "hidden", height: 340 },
  symbols: { flexGrow: 0 },
  symbolsInner: { gap: 6, paddingVertical: 2 },
  key: { minWidth: 40, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  keyText: { fontFamily: f.mono, fontSize: 16, color: c.fg },
  panel: { borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, padding: 14, gap: 8 },
  panelTitle: { fontFamily: f.bold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: c.muted },
  pctText: { fontFamily: f.extrabold, fontSize: 22, color: c.fg },
  bar: { height: 8, borderRadius: 4, backgroundColor: c.sunken, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: c.brand },
  out: { fontFamily: f.mono, fontSize: 14, lineHeight: 21, color: c.fg },
  err: { fontFamily: f.mono, fontSize: 14, lineHeight: 21, color: c.bad },
  muted: { fontFamily: f.regular, fontSize: 13, color: c.muted },
  error: { fontFamily: f.regular, fontSize: 15, lineHeight: 22, color: c.bad },
  saveRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  savedName: { fontFamily: f.semibold, fontSize: 15, color: c.fg },
}));
