import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { getDatabase } from "../../lib/db/open";
import { loadProblem } from "../../lib/content/repository";
import { loadSolvedIds } from "../../lib/learner/queries";
import { loadSubmissions, type SubmissionView } from "../../lib/judge/queue";
import { learner, getRuntime } from "../../lib/sync/runtime";
import { useLoad } from "../../lib/hooks/useLoad";
import { Card, Code, H, P, Bullets } from "../../components/common/Ui";
import { Button } from "../../components/common/Controls";
import { isOpenableLink, platformOf } from "../../lib/practice/platform";
import { AnswerForm } from "../../components/judge/AnswerForm";
import { makeStyles, MIN_TOUCH } from "../../lib/ui/theme";

/** A problem: statement, examples, and the answer form (internal problems) or the solved toggle (external problems). */
export default function ProblemScreen() {
  const { s } = useStyles();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [notice, setNotice] = useState<string | null>(null);
  const problem = useLoad(async () => {
    const db = await getDatabase();
    const p = await loadProblem(db, slug);
    if (!p) return { p: null, solved: false, subs: [] as SubmissionView[] };
    const [solved, subs] = await Promise.all([loadSolvedIds(db), loadSubmissions(db, p.id)]);
    return { p, solved: solved.has(p.id), subs };
  }, slug);
  const reload = problem.reload;

  // Reload when a sync finishes, so a verdict that arrives in the background appears without leaving the screen.
  useEffect(() => getRuntime().engine.subscribe(() => reload()), [reload]);

  const p = problem.data?.p;
  if (problem.loading) return <Text style={s.muted}>Loading…</Text>;
  if (problem.error) return <Text style={s.error} accessibilityRole="alert">{problem.error}</Text>;
  if (!p || !problem.data) return <Text style={s.error} accessibilityRole="alert">This problem is not available.</Text>;

  return (
    <>
      <Stack.Screen options={{ title: p.title }} />
      <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <Text style={s.title} accessibilityRole="header">{p.title}</Text>
        <Text style={s.meta}>{p.difficulty.toLowerCase()}{p.topics.length ? ` · ${p.topics.join(", ")}` : ""}</Text>

        {p.kind === "EXTERNAL" ? (
          <Card>
            <P>{platformOf(p.externalUrl) ? `This problem is on ${platformOf(p.externalUrl)!.name}. Open it there, solve it, then mark it solved here.` : "This problem is solved on an external site."}</P>
            {isOpenableLink(p.externalUrl) ? (
              <Button
                label={`Open on ${platformOf(p.externalUrl)?.name ?? "the site"}`}
                variant="primary"
                icon="external"
                hint="Opens the problem in your browser"
                onPress={() => void Linking.openURL(p.externalUrl ?? "")}
              />
            ) : null}
            {p.externalUrl && isOpenableLink(p.externalUrl) ? <Text selectable style={s.link}>{p.externalUrl}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={problem.data.solved ? "Mark as not solved" : "Mark as solved"}
              onPress={async () => {
                const r = await learner.setExternalSolved(p.id, !problem.data?.solved);
                setNotice(r.applied ? "Saved on this device. It will sync when you are online." : "This can't be saved right now.");
                if (r.applied) reload();
              }}
              style={s.solveBtn}
            >
              <Text style={s.solveText}>{problem.data.solved ? "Solved. Tap to undo" : "Mark as solved"}</Text>
            </Pressable>
            {notice ? <Text style={s.meta} accessibilityLiveRegion="polite">{notice}</Text> : null}
          </Card>
        ) : null}

        {p.statement ? <><H level={2}>Statement</H><P>{p.statement}</P></> : null}
        {p.inputSpec ? <><H level={3}>Input</H><P>{p.inputSpec}</P></> : null}
        {p.outputSpec ? <><H level={3}>Output</H><P>{p.outputSpec}</P></> : null}
        {p.constraints ? <><H level={3}>Constraints</H><P>{p.constraints}</P></> : null}

        {p.samples.length > 0 ? (
          <>
            <H level={2}>Examples</H>
            {p.samples.map((sm, i) => (
              <Card key={i}>
                <Text style={s.sampleLabel}>Input</Text>
                <Code code={sm.input} label={`example ${i + 1} input`} />
                <Text style={s.sampleLabel}>Output</Text>
                <Code code={sm.expected} label={`example ${i + 1} output`} />
                {sm.explanation ? <P>{sm.explanation}</P> : null}
              </Card>
            ))}
          </>
        ) : null}

        {p.timeLimitMs || p.memoryLimitMb ? (
          <Bullets items={[
            ...(p.timeLimitMs ? [`Time limit: ${p.timeLimitMs} ms`] : []),
            ...(p.memoryLimitMb ? [`Memory limit: ${p.memoryLimitMb} MB`] : []),
          ]} />
        ) : null}

        {p.kind === "INTERNAL" ? (
          <AnswerForm key={p.slug} problem={p} submissions={problem.data.subs} onSaved={reload} />
        ) : null}
      </ScrollView>
    </>
  );
}

const useStyles = makeStyles((c, f) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 18, paddingBottom: 48, gap: 14 },
  title: { color: c.fg, fontSize: 24, fontFamily: f.extrabold },
  meta: { color: c.muted, fontSize: 14, textTransform: "capitalize" },
  sampleLabel: { color: c.muted, fontSize: 13, fontFamily: f.bold },
  link: { color: "#3A59E0", fontSize: 15 },
  solveBtn: { minHeight: MIN_TOUCH, borderRadius: 12, backgroundColor: c.brand, alignItems: "center", justifyContent: "center", marginTop: 6 },
  solveText: { color: c.brandFg, fontFamily: f.bold, fontSize: 16 },
  muted: { color: c.muted, padding: 20 },
  error: { color: c.bad, padding: 20 },
}));
