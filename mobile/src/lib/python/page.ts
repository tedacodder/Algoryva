/** The page that runs Python: loads the runtime and reports progress and results to the app. Built once per install. */
export const runnerHtml = (base: string, moduleSource: string, inlined: Record<string, string>) => `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="background:#fff;margin:0">
<script>
var py = null;
function send(o) { window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
window.onerror = function (msg, src, line) { send({ kind: "error", text: "script error: " + msg + " line " + line }); };
// Report every runtime file as it is requested and finished, so a stall shows exactly which file it is waiting for.
(function () {
  var nativeFetch = window.fetch.bind(window);
  var INLINED = ${JSON.stringify(inlined)};
  window.fetch = function (input, init) {
    var name = String(input).split("/").pop().split("?")[0];
    send({ kind: "fetch", text: name, status: "start" });
    var target = input;
    if (INLINED[name] !== undefined) {
      var type = name.slice(-5) === ".wasm" ? "application/wasm" : name.slice(-5) === ".json" ? "application/json" : "application/octet-stream";
      target = "data:" + type + ";base64," + INLINED[name];
    }
    return nativeFetch(target, init).then(function (r) {
      send({ kind: "fetch", text: name, status: r.ok ? "done" : "failed " + r.status });
      return r;
    }, function (e) {
      send({ kind: "fetch", text: name, status: "error " + e });
      throw e;
    });
  };
})();
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
<script src="${base}pyodide.js" onload="send({ kind: 'stage', text: 'Loading the Python core', pct: 15 })" onerror="send({ kind: 'error', text: 'Could not load the Python loader from this phone. Restart Python; if it keeps failing, reinstall the app.' })"></script>
<script>
var MODULE_SOURCE = ${JSON.stringify(moduleSource)};
send({ kind: 'stage', text: 'Preparing the runtime module', pct: 5 });
var moduleUrl = URL.createObjectURL(new Blob([MODULE_SOURCE], { type: "text/javascript" }));
import(moduleUrl).then(function (m) {
  send({ kind: 'stage', text: 'Starting Python (standard library)', pct: 25 });
  return loadPyodide({ indexURL: "${base}", createPyodideModule: m.default });
}).then(function (p) { py = p; send({ kind: "ready" }); })
  .catch(function (e) { send({ kind: "error", text: "Python could not start: " + (e && e.message ? e.message : e) }); });
</script></body></html>`;
