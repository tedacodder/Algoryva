import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ContentProblem, SubmissionResponse } from "../../lib/api/types";
import type { SubmissionView } from "../../lib/judge/queue";
import { checkOutputs, JUDGE_NOTE } from "../../lib/judge/rules";
import { submitAnswers } from "../../lib/sync/runtime";
import { isSignedIn, subscribeSession } from "../../lib/auth/session";
import { makeStyles, MIN_TOUCH } from "../../lib/ui/theme";
import { Card, H, P } from "../common/Ui";

/**
 * Answers for one problem. One box per test: the sample tests first (their inputs are shown), then the hidden tests, whose inputs
 * the app never receives. Submitting saves the answer on the phone; the verdict appears once the server has checked it.
 */
export function AnswerForm({ problem, submissions, onSaved }: { problem: ContentProblem; submissions: SubmissionView[]; onSaved: () => void }) {
  const { c, s } = useStyles();
  const count = Math.max(problem.testCount, problem.samples.length, 1);
  const [outputs, setOutputs] = useState<string[]>(() => Array.from({ length: count }, () => ""));
  const [message, setMessage] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(isSignedIn());
  useEffect(() => subscribeSession(() => setSignedIn(isSignedIn())), []);

  const latest = submissions[0] ?? null;
  const set = (i: number, text: string) => setOutputs((o) => o.map((v, k) => (k === i ? text : v)));

  return (
    <Card>
      <H level={2}>Your answer</H>
      <P>Paste the output your program produced for each test.</P>
      <Text style={s.note}>{JUDGE_NOTE}</Text>
      {!signedIn ? (
        <Text style={s.warn}>Sign in on the Account screen to get your answer checked. It is saved on this device until then.</Text>
      ) : null}

      {outputs.map((value, i) => {
        const sample = problem.samples[i];
        const label = sample ? `Example ${i + 1}` : `Hidden test ${i + 1}`;
        return (
          <View key={i} style={s.field}>
            <Text style={s.label}>{label} output</Text>
            {sample ? <Text style={s.input} selectable>{`Input: ${sample.input}`}</Text> : <Text style={s.help}>The input for this test is not shown.</Text>}
            <TextInput
              value={value}
              onChangeText={(t) => set(i, t)}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Paste your output"
              placeholderTextColor={c.muted}
              accessibilityLabel={`${label} output`}
              style={s.box}
            />
          </View>
        );
      })}

      <Pressable
        onPress={async () => {
          const check = checkOutputs(outputs);
          if (!check.ok) return setMessage(check.error);
          const r = await submitAnswers(problem.id, outputs);
          setMessage(r.ok ? "Saved. It will be checked when you are online." : r.reason);
          if (r.ok) onSaved();
        }}
        accessibilityRole="button"
        accessibilityLabel="Submit answer"
        style={s.submit}
      >
        <Text style={s.submitText}>Submit answer</Text>
      </Pressable>
      {message ? <Text style={s.meta} accessibilityLiveRegion="polite">{message}</Text> : null}

      {latest ? <Result view={latest} problem={problem} /> : null}
    </Card>
  );
}

function Result({ view, problem }: { view: SubmissionView; problem: ContentProblem }) {
  const { c, s } = useStyles();
  if (view.status === "pending") return <Text style={s.pending}>Checking when you are online.</Text>;
  if (view.status === "refused") return <Text style={s.error} accessibilityRole="alert">{`This answer could not be checked: ${view.message ?? "unknown reason"}`}</Text>;
  const v = view.verdict as SubmissionResponse;
  const title = v.verdict === "accepted" ? "Accepted" : v.verdict === "wrong_answer" ? "Wrong answer" : "Not recorded";
  const tone = v.verdict === "accepted" ? c.ok : v.verdict === "wrong_answer" ? c.bad : c.warn;
  return (
    <View style={s.result} accessibilityLiveRegion="polite">
      <Text style={[s.verdict, { color: tone }]}>{title}</Text>
      {v.note ? <P>{v.note}</P> : null}
      {v.results.map((r, i) => {
        if (r.pass) return null;
        if (r.isSample) {
          return (
            <Text key={i} style={s.meta}>
              {`Example ${i + 1}: expected ${r.expected ?? ""}, got ${r.actual ?? ""}`}
            </Text>
          );
        }
        return <Text key={i} style={s.meta}>{`Hidden test ${i + 1} did not match.`}</Text>;
      })}
      {v.verdict === "accepted" && problem.kind === "INTERNAL" ? <Text style={s.meta}>The problem is now marked solved.</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c, f) => ({
  note: { color: c.muted, fontSize: 13, lineHeight: 19 },
  warn: { color: c.warn, fontSize: 14, lineHeight: 20 },
  field: { gap: 4, marginTop: 6 },
  label: { color: c.fg, fontFamily: f.bold, fontSize: 14 },
  help: { color: c.muted, fontSize: 13 },
  input: { color: c.muted, fontFamily: f.mono, fontSize: 13 },
  box: { minHeight: 56, borderRadius: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.sunken, color: c.fg, padding: 10, fontFamily: f.mono, fontSize: 14, textAlignVertical: "top" },
  submit: { minHeight: MIN_TOUCH, borderRadius: 12, backgroundColor: c.brand, alignItems: "center", justifyContent: "center", marginTop: 8 },
  submitText: { color: c.brandFg, fontFamily: f.bold, fontSize: 16 },
  meta: { color: c.muted, fontSize: 14, lineHeight: 20 },
  pending: { color: c.warn, fontFamily: f.bold, fontSize: 15 },
  error: { color: c.bad, fontSize: 15, lineHeight: 22 },
  result: { gap: 6, marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, paddingTop: 10 },
  verdict: { fontSize: 20, fontFamily: f.extrabold },
}));
