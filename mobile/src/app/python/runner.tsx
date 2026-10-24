import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { WebView } from "react-native-webview";
import { PYTHON_FILES } from "../../lib/python/pythonFiles";
import { makeStyles } from "../../lib/ui/theme";

/**
 * Python Runner: runs Python on the phone, offline. The runtime (Pyodide) is copied from the app into the documents folder once, then
 * loaded in a WebView. The runtime module is read as text and passed to the loader directly, because a WebView will not import a
 * module from a local file.
 */
const DIR = `${FileSystem.documentDirectory}python/`;

const runnerHtml = (base: string, moduleSource: string) => `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>
<script>
function report(kind, text) { window.ReactNativeWebView.postMessage(JSON.stringify({ kind, text })); }
window.onerror = function (msg, src, line) { report("error", "script error: " + msg + " line " + line); };
</script>
<script src="${base}pyodide.js"></script>
<script>
var MODULE_SOURCE = ${JSON.stringify(moduleSource)};
var moduleUrl = URL.createObjectURL(new Blob([MODULE_SOURCE], { type: "text/javascript" }));
import(moduleUrl).then(function (m) {
  return loadPyodide({ indexURL: "${base}", createPyodideModule: m.default });
}).then(function (py) {
  var out = [];
  py.setStdout({ batched: function (s) { out.push(s); } });
  py.runPython("import sys, math\\nprint('Python', sys.version.split()[0], 'pi =', round(math.pi, 4))");
  report("ok", out.join("\\n"));
}).catch(function (e) { report("error", "pyodide: " + (e && e.message ? e.message : e)); });
</script></body></html>`;

type Stage = { kind: "copying" } | { kind: "loading"; html: string } | { kind: "error"; message: string };

export default function PythonRunner() {
  const { c, s } = useStyles();
  const [stage, setStage] = useState<Stage>({ kind: "copying" });
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
        for (const f of PYTHON_FILES) {
          const dest = `${DIR}${f.name}`;
          const info = await FileSystem.getInfoAsync(dest);
          if (info.exists) continue;
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

  if (stage.kind === "copying") {
    return (
      <View style={s.center}>
        <ActivityIndicator color={c.brand} />
        <Text style={s.text}>Copying Python runtime to the phone…</Text>
      </View>
    );
  }
  if (stage.kind === "error") {
    return <ScrollView contentContainerStyle={s.pad}><Text style={s.error}>{`Copy failed: ${stage.message}`}</Text></ScrollView>;
  }
  return (
    <View style={{ flex: 1 }}>
      <Text style={[s.text, { padding: 12 }]}>{log.length ? log.join("\n") : "Loading Python…"}</Text>
      <WebView
        originWhitelist={["*"]}
        source={{ html: stage.html, baseUrl: `file://${DIR}` }}
        allowFileAccess
        allowUniversalAccessFromFileURLs
        allowingReadAccessToURL={DIR}
        javaScriptEnabled
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data) as { kind: string; text: string };
            setLog((l) => [...l, `[${m.kind}] ${m.text}`]);
          } catch {
            setLog((l) => [...l, e.nativeEvent.data]);
          }
        }}
        onError={(e) => setLog((l) => [...l, `[webview] ${e.nativeEvent.description}`])}
        style={{ height: 160, width: "100%", backgroundColor: "transparent" }}
      />
    </View>
  );
}

const useStyles = makeStyles((c, f) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: c.bg, padding: 24 },
  pad: { padding: 20, backgroundColor: c.bg },
  text: { fontFamily: f.regular, fontSize: 15, lineHeight: 22, color: c.fg },
  error: { fontFamily: f.regular, fontSize: 15, lineHeight: 22, color: c.bad },
}));
