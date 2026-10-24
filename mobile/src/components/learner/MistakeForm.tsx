import { useState } from "react";
import { Text, View } from "react-native";
import { MISTAKE_TYPES, REASONS } from "../../lib/rules/mistake";
import type { ContentProblem } from "../../lib/api/types";
import { learner } from "../../lib/sync/runtime";
import { Button, Chip, Field, Notice } from "../common/Controls";
import { makeStyles } from "../../lib/ui/theme";

/** Turns a rule code such as EDGE_CASE into "Edge case". */
export const label = (code: string): string => {
  const words = code.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Log a mistake: what went wrong, the correct idea, and how to recognise it next time. Checked on the phone, then by the server. */
export function MistakeForm({ problems, onSaved, onCancel }: { problems: ContentProblem[]; onSaved: () => void; onCancel: () => void }) {
  const { s } = useStyles();
  const [type, setType] = useState<string>(MISTAKE_TYPES[0]);
  const [reason, setReason] = useState<string | null>(null);
  const [source, setSource] = useState<"site" | "outside">("site");
  const [problemId, setProblemId] = useState<string | null>(problems[0]?.id ?? null);
  const [outsideTitle, setOutsideTitle] = useState("");
  const [outsideUrl, setOutsideUrl] = useState("");
  const [misunderstood, setMisunderstood] = useState("");
  const [correctIdea, setCorrectIdea] = useState("");
  const [recognize, setRecognize] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    const r = await learner.addMistake({
      type,
      reason,
      problemId: source === "site" ? problemId : null,
      outsideTitle: source === "outside" ? outsideTitle.trim() || null : null,
      outsideUrl: source === "outside" ? outsideUrl.trim() || null : null,
      misunderstood: misunderstood.trim(),
      correctIdea: correctIdea.trim(),
      recognizeNextTime: recognize.trim(),
    });
    if (!r.applied) return setMessage(r.reason.replace(/^invalid: /, ""));
    onSaved();
  };

  return (
    <View style={s.form}>
      <Text style={s.heading}>What kind of mistake was it?</Text>
      <View style={s.row}>
        {MISTAKE_TYPES.map((t) => <Chip key={t} label={label(t)} selected={type === t} onPress={() => setType(t)} />)}
      </View>

      <Text style={s.heading}>Why did it happen? (optional)</Text>
      <View style={s.row}>
        {REASONS.map((r) => <Chip key={r} label={label(r)} selected={reason === r} onPress={() => setReason(reason === r ? null : r)} />)}
      </View>

      <Text style={s.heading}>Which problem?</Text>
      <View style={s.row}>
        <Chip label="From this site" selected={source === "site"} onPress={() => setSource("site")} />
        <Chip label="Outside the site" selected={source === "outside"} onPress={() => setSource("outside")} />
      </View>
      {source === "site" ? (
        <View style={s.row}>
          {problems.map((p) => <Chip key={p.id} label={p.title} selected={problemId === p.id} onPress={() => setProblemId(p.id)} />)}
        </View>
      ) : (
        <>
          <Field label="Problem title" value={outsideTitle} onChangeText={setOutsideTitle} maxLength={120} />
          <Field label="Link (optional)" hint="Must start with https://" value={outsideUrl} onChangeText={setOutsideUrl} autoCapitalize="none" keyboardType="url" />
        </>
      )}

      <Field label="What did you misunderstand?" value={misunderstood} onChangeText={setMisunderstood} multiline />
      <Field label="What is the correct idea?" value={correctIdea} onChangeText={setCorrectIdea} multiline />
      <Field label="How will you recognise it next time?" value={recognize} onChangeText={setRecognize} multiline />

      {message ? <Notice text={message} tone="error" /> : null}
      <Button label="Save mistake" variant="primary" onPress={save} />
      <Button label="Cancel" onPress={onCancel} />
    </View>
  );
}

const useStyles = makeStyles((c, f) => ({
  form: { gap: 12, backgroundColor: c.surface, borderRadius: 12, padding: 14 },
  heading: { color: c.fg, fontFamily: f.bold, fontSize: 15, marginTop: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
}));
