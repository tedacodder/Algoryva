import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { WebView } from "react-native-webview";
import { EDITOR_SNIPPETS } from "../../lib/python/editorSnippets";

/**
 * The code editor: CodeMirror (Python highlighting, line numbers, search, autocomplete, snippets) inside a WebView. The screen owns the
 * text; this component sends changes up and sends snippets, drafts, commands and settings down.
 */
export type EditorHandle = {
  insertText(text: string): void;
  openSearch(): void;
  runCommand(name: "undo" | "redo" | "copyLineDown" | "deleteLine" | "toggleComment" | "indentMore" | "indentLess" | "gotoLine"): void;
};

type Props = { value: string; dark: boolean; fontSize: number; uri: string; dir: string; onChange: (text: string) => void; style?: object };

export const CodeEditor = forwardRef<EditorHandle, Props>(function CodeEditor({ value, dark, fontSize, uri, dir, onChange, style }, ref) {
  const viewRef = useRef<WebView | null>(null);
  const lastRef = useRef(value);
  const readyRef = useRef(false);

  const send = (js: string) => viewRef.current?.injectJavaScript(`${js}; true;`);

  useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string) => send(`insertText(${JSON.stringify(text)})`),
      openSearch: () => send("openSearch()"),
      runCommand: (name) => send(`runCommand(${JSON.stringify(name)})`),
    }),
    [],
  );

  // A snippet or draft came from outside the editor: show it.
  useEffect(() => {
    if (value !== lastRef.current && readyRef.current) {
      lastRef.current = value;
      send(`setText(${JSON.stringify(value)})`);
    }
  }, [value]);

  useEffect(() => {
    if (readyRef.current) send(`setDark(${dark})`);
  }, [dark]);

  useEffect(() => {
    if (readyRef.current) send(`setFontSize(${fontSize})`);
  }, [fontSize]);

  return (
    <WebView
      ref={viewRef as never}
      originWhitelist={["*"]}
      source={{ uri }}
      allowFileAccess
      allowUniversalAccessFromFileURLs
      allowingReadAccessToURL={dir}
      javaScriptEnabled
      scrollEnabled={false}
      style={style ?? { height: 340, width: "100%", borderRadius: 14 }}
      onLoadEnd={() => {
        readyRef.current = true;
        send(`startEditor(${JSON.stringify(value)}, ${dark}, ${JSON.stringify(EDITOR_SNIPPETS)})`);
        send(`setFontSize(${fontSize})`);
      }}
      onMessage={(e: { nativeEvent: { data: string } }) => {
        try {
          const m = JSON.parse(e.nativeEvent.data) as { kind: string; text?: string };
          if (m.kind === "change" && typeof m.text === "string") {
            lastRef.current = m.text;
            onChange(m.text);
          }
        } catch {
          // Ignore anything that is not a message from the editor.
        }
      }}
    />
  );
});
