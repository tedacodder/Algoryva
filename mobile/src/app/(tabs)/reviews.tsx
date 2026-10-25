import { useState } from "react";
import { FlatList, Linking, Text, View } from "react-native";
import { router } from "expo-router";
import { getDatabase } from "../../lib/db/open";
import { loadDueRevisits, loadDueTopicReviews, loadUpcomingTopicReviews, type DueRevisit, type DueTopicReview } from "../../lib/learner/queries";
import { useLoad } from "../../lib/hooks/useLoad";
import { learner } from "../../lib/sync/runtime";
import { NOTE_MAX, NOTE_MIN } from "../../lib/rules/schedule";
import { Button, Empty, Field, Notice } from "../../components/common/Controls";
import { makeStyles } from "../../lib/ui/theme";

/** Revisits that are due. Site problems open the problem; outside problems can be marked done with a short explanation. */
export default function RevisitsScreen() {
  const { s } = useStyles();
  const data = useLoad(async () => {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const [topics, revisits, upcoming] = await Promise.all([loadDueTopicReviews(db, now), loadDueRevisits(db, now), loadUpcomingTopicReviews(db, now)]);
    return { topics, revisits, upcoming };
  }, "revisits");
  const rate = async (r: DueTopicReview, rating: "good" | "again") => {
    const res = await learner.reviewTopic(r.slug, rating);
    setMessage(res.applied ? "Saved on this device. It will sync when you are online." : "This review can't be recorded right now.");
    if (res.applied) data.reload();
  };
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const report = async (r: DueRevisit) => {
    const text = note.trim();
    if (text.length < NOTE_MIN || text.length > NOTE_MAX) {
      return setMessage(`Describe how you solved it in ${NOTE_MIN}-${NOTE_MAX} characters.`);
    }
    const res = await learner.reportOutside(r.id, text);
    if (!res.applied) return setMessage("This can't be saved right now.");
    setOpenId(null); setNote(""); setMessage("Saved on this device. It will sync when you are online.");
    data.reload();
  };

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={s.content}
      data={[...(data.data?.topics ?? []).map((t) => ({ kind: "topic" as const, ...t })), ...(data.data?.revisits ?? []).map((r) => ({ kind: "revisit" as const, ...r }))]}
      keyExtractor={(r) => (r.kind === "topic" ? `topic:${r.slug}` : `revisit:${r.id}`)}
      ListHeaderComponent={message ? <Notice text={message} /> : undefined}
      ListEmptyComponent={<Empty title="Nothing is due yet" text="A topic comes back for review one day after you complete it, then after 3, 7, 14 and 30 days. Complete a topic and it will appear under Coming up." />}
      ListFooterComponent={
        (data.data?.upcoming ?? []).length > 0 ? (
          <View style={{ gap: 8, marginTop: 8 }}>
            <Text style={s.sectionTitle}>Coming up</Text>
            {(data.data?.upcoming ?? []).map((u) => (
              <View key={u.slug} style={s.upcoming} accessibilityLabel={`${u.title}, review on ${new Date(u.dueAt).toLocaleDateString()}`}>
                <Text style={s.title}>{u.title}</Text>
                <Text style={s.meta}>{`Review ${u.step + 1} on ${new Date(u.dueAt).toLocaleDateString()}`}</Text>
              </View>
            ))}
          </View>
        ) : undefined
      }
      renderItem={({ item }) => {
        if (item.kind === "topic") {
          return (
            <View style={s.card} accessibilityLabel={`Topic review due: ${item.title}`}>
              <Text style={s.title}>{item.title}</Text>
              <Text style={s.meta}>{`Review ${item.step + 1} of the schedule. Did you still get it?`}</Text>
              <Button label={`Remembered ${item.title}`} variant="primary" onPress={() => rate(item, "good")} />
              <Button label={`Need to revisit ${item.title}`} onPress={() => rate(item, "again")} />
            </View>
          );
        }
        const site = item.problemId !== null;
        const title = site ? (item.problemTitle ?? "A problem on this site") : (item.outsideTitle ?? "An outside problem");
        return (
          <View style={s.card} accessibilityLabel={`Due for review: ${title}`}>
            <Text style={s.title}>{title}</Text>
            {site ? (
              <Button
                label={`Solve ${title} again`}
                variant="primary"
                onPress={() => router.push(`/problems/${item.problemSlug ?? ""}` as never)}
              />
            ) : (
              <>
                {item.outsideUrl ? <Text selectable style={s.link}>{item.outsideUrl}</Text> : null}
                {openId === item.id ? (
                  <View style={s.form}>
                    <Field label="How did you solve it?" value={note} onChangeText={setNote} multiline hint={`${NOTE_MIN}-${NOTE_MAX} characters`} />
                    <Button label="Mark as done" variant="primary" onPress={() => report(item)} />
                    <Button label="Cancel" onPress={() => setOpenId(null)} />
                  </View>
                ) : (
                  <Button label={`I solved ${title}`} variant="primary" onPress={() => { setMessage(null); setOpenId(item.id); }} />
                )}
              </>
            )}
            {item.outsideUrl ? <Button label="Open the problem" onPress={() => void Linking.openURL(item.outsideUrl ?? "")} /> : null}
          </View>
        );
      }}
    />
  );
}

const useStyles = makeStyles((c, f) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: c.surface, borderRadius: 12, padding: 14, gap: 10 },
  title: { color: c.fg, fontSize: 17, fontFamily: f.bold },
  link: { color: "#3A59E0", fontSize: 14 },
  meta: { color: c.muted, fontSize: 14, lineHeight: 20 },
  sectionTitle: { color: c.fg, fontSize: 17, fontWeight: "700", marginTop: 4 },
  upcoming: { backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 4 },
  form: { gap: 10 },
}));
