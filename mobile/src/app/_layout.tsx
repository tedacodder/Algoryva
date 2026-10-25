import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { loadSession } from "../lib/auth/session";
import { startContent, type StartupResult } from "../lib/content/bootstrap";
import { getDatabase } from "../lib/db/open";
import { readThemePreference, writeThemePreference } from "../lib/ui/prefs";
import { FONT_FILES } from "../lib/ui/fontFiles";
import { makeStyles, ThemeProvider, useTheme, type Preference } from "../lib/ui/theme";
import { LIGHT } from "../lib/ui/palette";
import { startSync } from "../lib/sync/runtime";
import { PythonHost } from "../components/python/PythonHost";

// Keep the splash until the fonts, the saved session and the content are ready, so no screen flashes unstyled.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

type Phase = { kind: "loading" } | StartupResult;

const loadPreference = async (): Promise<Preference> => readThemePreference(await getDatabase());
const savePreference = async (p: Preference): Promise<void> => writeThemePreference(await getDatabase(), p);

export default function RootLayout() {
  const [fontsLoaded] = useFonts(FONT_FILES);
  return (
    <ThemeProvider load={loadPreference} save={savePreference}>
      <Themed fontsLoaded={fontsLoaded} />
    </ThemeProvider>
  );
}

function Themed({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { mode, palette } = useTheme();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const startup = useCallback(async (): Promise<StartupResult> => {
    await loadSession().catch(() => undefined); // a secure-storage read failure means signed out; the app still opens
    return startContent();
  }, []);

  useEffect(() => {
    let alive = true;
    void startup().then((result) => {
      if (alive) setPhase(result);
    });
    return () => {
      alive = false;
    };
  }, [startup]);

  const retry = useCallback(() => {
    setPhase({ kind: "loading" });
    void startup().then(setPhase);
  }, [startup]);

  const ready = fontsLoaded && phase.kind !== "loading";
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
    if (phase.kind === "ready") void startSync();
  }, [ready, phase.kind]);

  if (!fontsLoaded || phase.kind === "loading") {
    return <Loading />;
  }
  if (phase.kind === "needs-internet" || phase.kind === "failed") {
    return <Blocked kind={phase.kind} message={phase.kind === "failed" ? phase.message : ""} onRetry={retry} />;
  }

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <>
      <PythonHost />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.surface },
          headerTintColor: palette.fg,
          headerTitleStyle: { fontFamily: "BricolageGrotesque_700Bold" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.bg },
        }}
      >
        <Stack.Screen name="learn/[slug]" options={{ title: "Lesson" }} />
        <Stack.Screen name="problems/[slug]" options={{ title: "Problem" }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="visualizer/index" options={{ title: "Visualizer" }} />
        <Stack.Screen name="visualizer/[id]" options={{ title: "Visualizer" }} />
        <Stack.Screen name="account/index" options={{ title: "Account" }} />
        <Stack.Screen name="notes/index" options={{ title: "Notes" }} />
        <Stack.Screen name="mistakes/index" options={{ title: "Mistakes" }} />
        <Stack.Screen name="settings/index" options={{ title: "Settings" }} />
        <Stack.Screen name="python/runner" options={{ title: "Python Runner" }} />
      </Stack>
      </>
    </>
  );
}

const useScreenStyles = makeStyles((c, f) => ({
  center: { flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  title: { fontFamily: f.extrabold, fontSize: 30, color: c.fg, letterSpacing: -0.5 },
  body: { fontFamily: f.regular, fontSize: 16, lineHeight: 24, color: c.soft, textAlign: "center" },
  button: { minHeight: 44, minWidth: 160, borderRadius: 10, backgroundColor: c.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, borderBottomWidth: 2, borderBottomColor: "rgba(0,0,0,0.16)" },
  buttonText: { fontFamily: f.semibold, color: c.brandFg, fontSize: 16 },
}));

function Loading() {
  return (
    <View style={{ flex: 1, backgroundColor: LIGHT.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={LIGHT.brand} size="large" accessibilityLabel="Loading lessons" />
    </View>
  );
}

function Blocked({ kind, message, onRetry }: { kind: "needs-internet" | "failed"; message: string; onRetry: () => void }) {
  const { s } = useScreenStyles();
  return (
    <View style={s.center}>
      <Text style={s.title} accessibilityRole="header">Algoryva</Text>
      <Text style={s.body} accessibilityRole="alert">
        {kind === "needs-internet"
          ? "Connect to the internet once to download the lessons. After that they work offline."
          : `The lessons could not be loaded. ${message}`}
      </Text>
      <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Try again" style={s.button}>
        <Text style={s.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}
