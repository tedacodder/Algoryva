import { useSyncExternalStore } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { engine } from "../../lib/python/engine";

/**
 * Keeps the Python WebView mounted for the whole app, invisibly, so the runtime stays loaded when the Python Runner screen is closed.
 * It is rendered once, by the root layout.
 */
export function PythonHost() {
  const st = useSyncExternalStore(engine.subscribe, engine.getState);
  const session = engine.getSession();
  if (!st.uri || (st.stage !== "starting" && st.stage !== "ready")) return null;
  // Absolutely positioned and zero-sized, so it takes no space in the layout and cannot push the screen down.
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: 1, height: 1, left: 0, top: 0, overflow: "hidden" }}>
    <WebView
      key={session}
      ref={(r: unknown) => engine.attach(r as { injectJavaScript(js: string): void } | null)}
      originWhitelist={["*"]}
      source={{ uri: st.uri }}
      allowFileAccess
      allowUniversalAccessFromFileURLs
      allowingReadAccessToURL={st.uri.slice(0, st.uri.lastIndexOf("/") + 1)}
      javaScriptEnabled
      onMessage={(e: { nativeEvent: { data: string } }) => engine.onMessage(e.nativeEvent.data)}
      onLoadEnd={() => engine.pageLoaded()}
      onError={(e: { nativeEvent: { description: string } }) => engine.onMessage(JSON.stringify({ kind: "error", text: `Python page: ${e.nativeEvent.description}` }))}
      style={{ width: 1, height: 1 }}
    />
    </View>
  );
}
