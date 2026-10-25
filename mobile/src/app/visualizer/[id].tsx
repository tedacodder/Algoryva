import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, Pressable, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { defaultsOf, getAlgorithm, runAlgorithm } from "../../lib/visualizer/registry";
import type { Gen } from "../../lib/visualizer/types";
import type { VizView } from "../../components/viz/types";
import { VizPlayer } from "../../components/viz/VizPlayer";
import { Card, H, P } from "../../components/common/Ui";
import { Tag } from "../../components/common/Controls";
import { makeStyles, MIN_TOUCH } from "../../lib/ui/theme";

function toView(gen: Gen, title: string): VizView {
  switch (gen.kind) {
    case "array": return { kind: "array", title, frames: gen.frames };
    case "graph": return { kind: "graph", title, frames: gen.frames };
    case "grid": return { kind: "grid", title, frames: gen.frames };
  }
}

export default function AlgorithmScreen() {
  const { c, s } = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const algo = getAlgorithm(id);
  const [values, setValues] = useState<Record<string, string>>(() => (algo ? defaultsOf(algo) : {}));
  const [submitted, setSubmitted] = useState<Record<string, string>>(() => (algo ? defaultsOf(algo) : {}));
  const [line, setLine] = useState<number | null>(null);

  const outcome = useMemo(() => (algo ? runAlgorithm(algo, submitted) : null), [algo, submitted]);
  const view = useMemo(() => (outcome && outcome.ok && algo ? toView(outcome.gen, algo.title) : null), [outcome, algo]);
  const onIndexChange = useCallback((i: number) => {
    if (outcome?.ok) setLine(outcome.gen.frames[i]?.line ?? null);
  }, [outcome]);

  if (!algo) return <Text style={s.error} accessibilityRole="alert">This algorithm is not available.</Text>;

  const run = (v: Record<string, string>) => {
    setValues(v);
    setSubmitted(v);
    setLine(null);
  };

  return (
    <>
      <Stack.Screen options={{ title: algo.title }} />
      <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title} accessibilityRole="header">{algo.title}</Text>
        <P>{algo.summary}</P>
        {algo.precondition ? <P>{`Input must: ${algo.precondition}`}</P> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Tag label={`Time O(${algo.complexity.time.replace(/^O\(|\)$/g, "")})`} tone="brand" />
          <Tag label={`Space O(${algo.complexity.space.replace(/^O\(|\)$/g, "")})`} />
          {algo.complexity.note ? <Tag label={algo.complexity.note} tone="ok" /> : null}
        </View>

        <Card>
          <H level={3}>Input</H>
          {algo.presets.length > 0 ? (
            <View style={s.presets}>
              {algo.presets.map((p) => (
                <Pressable key={p.label} onPress={() => { setValues(p.values); run(p.values); }} accessibilityRole="button" accessibilityLabel={`Example: ${p.label}`} style={s.chip}>
                  <Text style={s.chipText}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {algo.fields.map((f) => (
            <View key={f.key} style={s.field}>
              <Text style={s.label}>{f.label}</Text>
              <Text style={s.help}>{f.help}</Text>
              <TextInput
                value={values[f.key] ?? ""}
                onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
                placeholder={f.placeholder}
                placeholderTextColor={c.muted}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={f.label}
                style={s.input}
              />
            </View>
          ))}
          <Pressable onPress={() => run(values)} accessibilityRole="button" accessibilityLabel="Run with this input" style={s.run}>
            <Text style={s.runText}>Run</Text>
          </Pressable>
        </Card>

        {outcome && !outcome.ok ? (
          <Text style={s.error} accessibilityRole="alert">{outcome.error}</Text>
        ) : outcome && outcome.ok && view ? (
          <>
            <VizPlayer viz={view} onIndexChange={onIndexChange} />
            {outcome.gen.result ? <P>{`Result: ${outcome.gen.result}`}</P> : null}
            <Card>
              <H level={3}>Pseudocode</H>
              {algo.pseudocode.map((code, i) => (
                <Text key={i} style={[s.code, i === line && s.codeOn]} accessibilityLabel={i === line ? `Current line: ${code}` : undefined}>
                  {code}
                </Text>
              ))}
            </Card>
          </>
        ) : null}

        {algo.lessonSlug ? <P>{`Read the lesson: ${algo.lessonSlug}`}</P> : null}
      </ScrollView>
    </>
  );
}

const useStyles = makeStyles((c, f) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 18, gap: 14, paddingBottom: 48 },
  title: { color: c.fg, fontSize: 24, fontFamily: f.extrabold },
  meta: { color: c.muted, fontSize: 14 },
  error: { color: c.bad, fontSize: 15, lineHeight: 22 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: c.brand, justifyContent: "center" },
  chipText: { color: c.brand, fontFamily: f.bold },
  field: { gap: 4 },
  label: { color: c.fg, fontFamily: f.bold, fontSize: 15 },
  help: { color: c.muted, fontSize: 13, lineHeight: 18 },
  input: { minHeight: MIN_TOUCH, borderRadius: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.sunken, color: c.fg, paddingHorizontal: 12, fontFamily: f.mono, fontSize: 15 },
  run: { minHeight: MIN_TOUCH, borderRadius: 12, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
  runText: { color: c.brandFg, fontFamily: f.bold, fontSize: 16 },
  code: { color: c.muted, fontFamily: f.mono, fontSize: 14, lineHeight: 22, paddingVertical: 2 },
  codeOn: { color: c.fg, backgroundColor: c.tint.brand, borderRadius: 6 },
}));
