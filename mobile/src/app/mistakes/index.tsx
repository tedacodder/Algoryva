import { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { getDatabase } from "../../lib/db/open";
import { loadMistakes } from "../../lib/learner/queries";
import { loadProblems } from "../../lib/content/repository";
import { useLoad } from "../../lib/hooks/useLoad";
import { learner } from "../../lib/sync/runtime";
import { Button, Empty, Notice } from "../../components/common/Controls";
import { MistakeForm, label } from "../../components/learner/MistakeForm";
import { makeStyles } from "../../lib/ui/theme";
import type { ServerMistake } from "../../lib/api/types";

export default function MistakesScreen() {
  const { s } = useStyles();
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const data = useLoad(async () => {
    const db = await getDatabase();
    const [mistakes, problems] = await Promise.all([loadMistakes(db), loadProblems(db)]);
    return { mistakes, problems };
  }, "mistakes");

  const source = (m: ServerMistake, titles: Map<string, string>) =>
    m.problemId ? (titles.get(m.problemId) ?? "A problem on this site") : (m.outsideTitle ?? "An outside problem");

  const remove = async (m: ServerMistake) => {
    const r = await learner.deleteMistake(m.id);
    setMessage(r.applied ? "Mistake deleted." : "This mistake can't be deleted right now.");
    if (r.applied) data.reload();
  };

  const titles = new Map((data.data?.problems ?? []).map((p) => [p.id, p.title]));

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={s.content}
      data={data.data?.mistakes ?? []}
      keyExtractor={(m) => m.id}
      ListHeaderComponent={
        <View style={s.header}>
          {message ? <Notice text={message} /> : null}
          {adding && data.data ? (
            <MistakeForm
              problems={data.data.problems}
              onSaved={() => { setAdding(false); setMessage("Saved on this device. It will sync when you are online."); data.reload(); }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <Button label="Log a mistake" variant="primary" onPress={() => { setMessage(null); setAdding(true); }} />
          )}
        </View>
      }
      ListEmptyComponent={<Empty text="No mistakes logged yet. Writing down what went wrong helps you recognise it next time." />}
      renderItem={({ item }) => (
        <View style={s.card} accessibilityLabel={`Mistake: ${label(item.type)} on ${source(item, titles)}`}>
          <Text style={s.kind}>{label(item.type)}{item.reason ? ` · ${label(item.reason)}` : ""}</Text>
          <Text style={s.src}>{source(item, titles)}</Text>
          <Text style={s.line}><Text style={s.em}>Misunderstood: </Text>{item.misunderstood}</Text>
          <Text style={s.line}><Text style={s.em}>Correct idea: </Text>{item.correctIdea}</Text>
          <Text style={s.line}><Text style={s.em}>Next time: </Text>{item.recognizeNextTime}</Text>
          <Button label={`Delete mistake: ${label(item.type)}`} variant="danger" onPress={() => remove(item)} />
        </View>
      )}
    />
  );
}

const useStyles = makeStyles((c, f) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  header: { gap: 12, marginBottom: 6 },
  card: { backgroundColor: c.surface, borderRadius: 12, padding: 14, gap: 6 },
  kind: { color: c.brand, fontFamily: f.bold, fontSize: 14 },
  src: { color: c.fg, fontSize: 17, fontFamily: f.bold },
  line: { color: c.fg, fontSize: 15, lineHeight: 22 },
  em: { color: c.muted, fontFamily: f.bold },
}));
