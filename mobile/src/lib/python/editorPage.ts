/**
 * The page that hosts the code editor (CodeMirror, bundled). It loads the bundle from the phone's folder as a plain script; the
 * editor itself is started by the app once the page has loaded (see CodeEditor).
 */
export function editorHtml(base: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<style>html,body{height:100%;margin:0;padding:0;overflow:hidden}#editor{height:100%}</style>
</head><body><div id="editor"></div>
<script src="${base}editor.bundle.js"></script>
</body></html>`;
}
