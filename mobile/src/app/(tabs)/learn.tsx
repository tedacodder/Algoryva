import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { getDatabase } from "../../lib/db/open";
import { loadTopics } from "../../lib/content/repository";
import { loadLessonMinutes } from "../../lib/learner/queries";
import { completedSlugs } from "../../lib/learner/apply";
import { topicStates, STATE_LABEL, type TopicState } from "../../lib/rules/topicState";
import { nextTopic } from "../../lib/rules/next";
import { LEVEL_META, LEVEL_ORDER } from "../../lib/rules/levels";
import { useLoad } from "../../lib/hooks/useLoad";
import { makeStyles } from "../../lib/ui/theme";
import { Button, Tag, Empty } from "../../components/common/Controls";
import { Icon, type IconName } from "../../components/Icon";

/**
 * The curriculum, in the website's layout: a search box, a "Continue where you left off" card, and every topic grouped by level,
 * each with its state (completed, up next, available, locked) and its reading time.
 */
const useStyles = makeStyles((c, f) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  title: { fontFamily: f.extrabold, fontSize: 28, color: c.fg, letterSpacing: -0.5 },
  lead: { fontFamily: f.regular, fontSize: 14.5, lineHeight: 22, color: c.soft },
  search: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.surface, color: c.fg, paddingHorizontal: 14, fontFamily: f.regular, fontSize: 15 },
  cont: { borderRadius: 18, borderWidth: 1, borderColor: c.tint.brandLine, backgroundColor: c.surface, padding: 16, gap: 10 },
  contKicker: { fontFamily: f.bold, fontSize: 12, color: c.brand },
  contTitle: { fontFamily: f.extrabold, fontSize: 21, lineHeight: 27, color: c.fg },
  contMeta: { fontFamily: f.medium, fontSize: 13, color: c.muted },
  levelHead: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  levelName: { fontFamily: f.extrabold, fontSize: 17, color: c.fg },
  levelLine: { flex: 1, height: 1, backgroundColor: c.line },
  levelCount: { fontFamily: f.semibold, fontSize: 12, color: c.muted },
  topic: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, padding: 14, minHeight: 64 },
  topicCurrent: { borderColor: c.brand, backgroundColor: c.tint.brandFaint },
  topicDim: { opacity: 0.6 },
  topicIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.lineStrong, alignItems: "center", justifyContent: "center" },
  topicBody: { flex: 1, gap: 4 },
  topicTitle: { fontFamily: f.bold, fontSize: 16, color: c.fg },
  topicMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  metaText: { fontFamily: f.semibold, fontSize: 12, color: c.muted },
  error: { fontFamily: f.regular, color: c.bad, padding: 20 },
}));

const ICON: Record<TopicState, IconName> = { done: "check", current: "arrowRight", open: "arrowRight", locked: "lock", soon: "clock" };

export default function CurriculumTab() {
  const { c, s } = useStyles();
  const [query, setQuery] = useState("");
  const data = useLoad(async () => {
    const db = await getDatabase();
    const [topics, done, minutes] = await Promise.all([loadTopics(db), completedSlugs(db), loadLessonMinutes(db)]);
    const states = topicStates(topics, done);
    const next = nextTopic(topics, done);
    return { topics, states, minutes, next, done: [...done] };
  }, "curriculum");

  const sections = useMemo(() => {
    if (!data.data) return [];
    const q = query.trim().toLowerCase();
    return LEVEL_ORDER.map((level) => ({
      level,
      items: data.data!.topics.filter((t) => t.level === level && (q === "" || t.title.toLowerCase().includes(q))),
    })).filter((sec) => sec.items.length > 0);
  }, [data.data, query]);

  if (data.loading) return <Text style={s.error}>Loading…</Text>;
  if (data.error || !data.data) return <Text style={s.error} accessibilityRole="alert">{data.error ?? "Could not load the curriculum."}</Text>;
  const d = data.data;
  const doneCount = d.topics.filter((t) => d.done.includes(t.slug)).length;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title} accessibilityRole="header">Curriculum</Text>
      <Text style={s.lead}>{`Lessons grouped by level. Open any topic to read it. Completing one unlocks what depends on it. ${doneCount} of ${d.topics.length} done.`}</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search topics" placeholderTextColor={c.muted} accessibilityLabel="Search topics" style={s.search} autoCorrect={false} />

      {d.next && query === "" ? (
        <View style={s.cont} accessibilityLabel={`Continue where you left off: ${d.next.title}`}>
          <Text style={s.contKicker}>Continue where you left off</Text>
          <Text style={s.contTitle}>{d.next.title}</Text>
          <Text style={s.contMeta}>{`${LEVEL_META[d.next.level]?.label ?? d.next.level} · about ${d.minutes.get(d.next.slug) ?? 0} min`}</Text>
          <Button label="Open lesson" variant="primary" icon="arrowRight" onPress={() => router.push(`/learn/${d.next!.slug}` as never)} />
        </View>
      ) : null}

      {sections.length === 0 ? <Empty title="No topics match" text="Try another word." /> : null}

      {sections.map((sec) => {
        const meta = LEVEL_META[sec.level];
        const color = c.lv[(meta?.n ?? 1) - 1];
        return (
          <View key={sec.level} style={{ gap: 10 }}>
            <View style={s.levelHead} accessibilityRole="header">
              <View style={[s.dot, { backgroundColor: color }]} />
              <Text style={s.levelName}>{meta?.label ?? sec.level}</Text>
              <View style={s.levelLine} />
              <Text style={s.levelCount}>{`${sec.items.filter((t) => d.done.includes(t.slug)).length}/${sec.items.length}`}</Text>
            </View>
            {sec.items.map((t) => {
              const state = d.states.get(t.slug) ?? "locked";
              const available = t.status === "PUBLISHED";
              const body = (
                <View style={[s.topic, state === "current" && s.topicCurrent, (state === "locked" || state === "soon") && s.topicDim]}>
                  <View style={[s.topicIcon, { borderColor: state === "current" ? c.brand : state === "done" ? c.ok : c.lineStrong, backgroundColor: state === "done" ? c.ok : c.surface }]}>
                    <Icon name={ICON[state]} size={16} color={state === "done" ? c.brandFg : state === "current" ? c.brand : c.muted} />
                  </View>
                  <View style={s.topicBody}>
                    <Text style={s.topicTitle}>{t.title}</Text>
                    <View style={s.topicMeta}>
                      <Text style={[s.metaText, state === "current" && { color: c.brand }, state === "done" && { color: c.ok }]}>{STATE_LABEL[state]}</Text>
                      <Icon name="clock" size={12} color={c.muted} />
                      <Text style={s.metaText}>{`${d.minutes.get(t.slug) ?? 0} min`}</Text>
                      {available ? <Tag label="Full lesson" /> : null}
                    </View>
                  </View>
                </View>
              );
              if (!available || state === "locked") {
                return <View key={t.slug} accessibilityLabel={`${t.title}, ${STATE_LABEL[state]}`}>{body}</View>;
              }
              return (
                <Pressable key={t.slug} onPress={() => router.push(`/learn/${t.slug}` as never)} accessibilityRole="button" accessibilityLabel={`${t.title}, ${STATE_LABEL[state]}, ${d.minutes.get(t.slug) ?? 0} minutes`}>
                  {body}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}
