import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack } from "expo-router";
import { makeStyles, MIN_TOUCH } from "../../lib/ui/theme";
import { Button, Field, Notice } from "../../components/common/Controls";
import { getDatabase } from "../../lib/db/open";
import { checkSnippet, deleteSnippet, listSnippets, saveSnippet, type Snippet } from "../../lib/python/snippets";
import { applyNewline, insertAt, INDENT, lineNumbers } from "../../lib/python/editorLogic";
import { tokenize } from "../../lib/highlight";
import { FONTS } from "../../lib/ui/fonts";
import { findMatches, nextMatch, replaceAll, suggestionsAt } from "../../lib/python/completion";
import { startingText, startupHint } from "../../lib/python/startup";
import { startingPercent } from "../../lib/python/engineState";
import { engine, type RunOutcome } from "../../lib/python/engine";

/**
 * Python Runner. The runtime is owned by the app (see lib/python/engine.ts), so leaving this screen does not reload it.
 * Your code is saved as a draft while you type, and comes back when you return.
 */
const SYMBOLS = ["(", ")", "[", "]", "{", "}", ":", '"', "'", "=", "+", "-", "*", "/", "%", "#", "<", ">", "!", "_", ".", ",", "tab"];
const SAMPLE = 'name = input("Your name: ")\nfor i in range(3):\n    print(f"Hello {name}, step {i + 1}")\n';
const DRAFT_ID = "__draft__";

export default function PythonRunner() {
  const { c, s } = useStyles();
  const st = useSyncExternalStore(engine.subscribe, engine.getState);
  const [code, setCode] = useState(SAMPLE);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [sel, setSel] = useState({ start: SAMPLE.length, end: SAMPLE.length });
  const selRef = useRef(sel);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState<RunOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<Snippet[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [find, setFind] = useState("");
  const [replacement, setReplacement] = useState("");
  const [now, setNow] = useState(0);
  const matches = findMatches(code, find);
  const sugg = sel.start === sel.end ? suggestionsAt(code, sel.start) : { start: sel.start, word: "", options: [] as string[] };
  const lineCount = code.split("\n").length;

  // Start Python if it is not running yet. Usually it already is, and this does nothing.
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

  // Save the draft as you type (after a short pause).
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
    const all = await listSnippets(await getDatabase());
    setSaved(all.filter((x) => x.id !== DRAFT_ID));
    setShowSaved((v) => !v);
  };

  const removeSaved = async (id: string) => {
    const db = await getDatabase();
    await deleteSnippet(db, id);
    setSaved((await listSnippets(db)).filter((x) => x.id !== DRAFT_ID));
  };

  const tokenColor = (t: string): string =>
    t === "kw" ? c.tok.kw : t === "str" ? c.tok.str : t === "num" ? c.tok.num : t === "com" ? c.tok.com : t === "fn" ? c.tok.fn : t === "bi" ? c.tok.bi : c.codeFg;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: "Python Runner" }} />

      {st.stage === "idle" || st.stage === "copying" ? (
        <View style={s.panel} accessibilityLiveRegion="polite">
          <ActivityIndicator color={c.brand} />
          <Text style={s.pctText}>{`${st.copyPct}%`}</Text>
          <View style={s.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: st.copyPct }}>
            <View style={[s.barFill, { width: `${st.copyPct}%` }]} />
          </View>
          <Text style={s.muted}>{st.stage === "copying" ? `Copying Python to this phone: ${st.copyName}` : "Preparing Python on this phone…"}</Text>
          <Text style={s.muted}>This happens once. After that, Python stays ready while the app is open.</Text>
        </View>
      ) : null}

      {st.stage === "error" ? (
        <View style={s.panel} accessibilityLiveRegion="polite">
          <Text style={s.error}>{`Python could not start: ${st.error ?? "unknown error"}`}</Text>
          <Button label="Restart Python" variant="primary" onPress={() => engine.restart()} />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.toolbar}>
          <Button label={ready ? (running ? "Running…" : "Run") : "Starting…"} variant="primary" icon="play" disabled={!ready || running} onPress={run} />
          <Button label="Stop" variant="danger" icon="pause" disabled={!running && st.stage !== "starting"} onPress={stop} />
          <Button label="Saved" icon="list" onPress={openSaved} />
          <Button label={showFind ? "Hide find" : "Find"} icon="search" onPress={() => setShowFind((v) => !v)} />
        </View>

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

        <View style={s.editorBox}>
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
        </View>

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
            <Pressable key={k} onPress={() => insert(k === "tab" ? INDENT : k)} accessibilityRole="button" accessibilityLabel={k === "tab" ? "Indent" : `Insert ${k}`} style={s.key}>
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
                <Button label="Delete" variant="danger" onPress={() => void removeSaved(p.id)} />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c, f) => ({
  content: { padding: 14, paddingBottom: 48, gap: 12 },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hint: { fontFamily: f.regular, fontSize: 13, color: c.muted },
  editorBox: { borderRadius: 14, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.codeBg, maxHeight: 300, overflow: "hidden" },
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
