import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, copyLineDown, deleteLine, toggleComment, indentMore, indentLess } from "@codemirror/commands";
import { search, searchKeymap, highlightSelectionMatches, openSearchPanel, gotoLine } from "@codemirror/search";
import { python } from "@codemirror/lang-python";
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { autocompletion, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";

const post = (o) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(o));
let view = null;
let dark = false;
let fontSize = 14;
const themeConf = new Compartment();

function theme(isDark, size) {
  return EditorView.theme({
    "&": { color: isDark ? "#E2E8F4" : "#1C2433", backgroundColor: isDark ? "#0F1420" : "#F9FCFD", height: "100%", fontSize: size + "px" },
    ".cm-scroller": { fontFamily: "monospace", lineHeight: "1.5", overflow: "auto" },
    ".cm-content": { caretColor: isDark ? "#93B4FF" : "#1D4ED8", padding: "10px 0" },
    ".cm-gutters": { backgroundColor: isDark ? "#151B29" : "#F1F5F7", color: isDark ? "#767EA8" : "#787EA0", border: "none" },
    ".cm-activeLine": { backgroundColor: isDark ? "#1A2135" : "#EEF3FF" },
    ".cm-activeLineGutter": { backgroundColor: isDark ? "#1A2135" : "#EEF3FF" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: isDark ? "#2B3A66" : "#CFE0FF" },
    ".cm-tooltip": { backgroundColor: isDark ? "#1B2236" : "#FFFFFF", color: isDark ? "#E2E8F4" : "#1C2433" },
    ".cm-panels": { backgroundColor: isDark ? "#1B2236" : "#F1F5F7", color: isDark ? "#E2E8F4" : "#1C2433", fontSize: "14px" },
  }, { dark: isDark });
}

function snippetSource(snippets) {
  return (ctx) => {
    const word = ctx.matchBefore(/[A-Za-z_]\w*/);
    if (!word || (word.from === word.to && !ctx.explicit)) return null;
    return {
      from: word.from,
      options: snippets.map((s) => ({ label: s.label, detail: s.detail, type: "keyword", apply: s.apply, boost: -1 })),
    };
  };
}

const commands = { undo, redo, copyLineDown, deleteLine, toggleComment, indentMore, indentLess, gotoLine };

window.startEditor = function (text, isDark, snippets) {
  dark = !!isDark;
  const pySnippets = python().language.data.of({ autocomplete: snippetSource(snippets || []) });
  const extensions = [
    lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), drawSelection(),
    history(), indentOnInput(), bracketMatching(), closeBrackets(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    python(), pySnippets,
    autocompletion({ activateOnTyping: true, defaultKeymap: true }),
    search({ top: true }), highlightSelectionMatches(),
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, indentWithTab]),
    themeConf.of(theme(dark, fontSize)),
    EditorView.lineWrapping,
    EditorView.updateListener.of((u) => { if (u.docChanged) post({ kind: "change", text: u.state.doc.toString() }); }),
  ];
  view = new EditorView({ state: EditorState.create({ doc: text, extensions }), parent: document.getElementById("editor") });
  post({ kind: "ready" });
};
window.setText = function (text) {
  if (!view) return;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
};
window.insertText = function (text) {
  if (!view) return;
  const r = view.state.selection.main;
  view.dispatch({ changes: { from: r.from, to: r.to, insert: text }, selection: { anchor: r.from + text.length } });
  view.focus();
};
window.openSearch = function () { if (view) { openSearchPanel(view); view.focus(); } };
window.runCommand = function (name) {
  const cmd = commands[name];
  if (view && cmd) { cmd(view); view.focus(); }
};
window.setFontSize = function (size) {
  fontSize = size;
  if (view) view.dispatch({ effects: themeConf.reconfigure(theme(dark, fontSize)) });
};
window.setDark = function (isDark) {
  dark = !!isDark;
  if (view) view.dispatch({ effects: themeConf.reconfigure(theme(dark, fontSize)) });
};
