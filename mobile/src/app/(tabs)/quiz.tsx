import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { getDatabase } from "../../lib/db/open";
import { loadAllQuizQuestions } from "../../lib/learner/queries";
import { loadTopics } from "../../lib/content/repository";
import { useLoad } from "../../lib/hooks/useLoad";
import { makeStyles } from "../../lib/ui/theme";
import { Chip, Empty, Tag } from "../../components/common/Controls";
import { Icon } from "../../components/Icon";
import { QUESTION_COUNTS } from "../../lib/quiz/pick";

/** The Quiz tab: a surprise practice quiz across every lesson, and a challenge for each topic, in the same card style as the curriculum. */
const useStyles = makeStyles((c, f) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  kicker: { fontFamily: f.bold, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: c.brand },
  title: { fontFamily: f.extrabold, fontSize: 28, color: c.fg, letterSpacing: -0.5 },
  lead: { fontFamily: f.regular, fontSize: 14.5, lineHeight: 22, color: c.soft },
  heroCard: { borderRadius: 20, padding: 20, backgroundColor: c.brand, gap: 10, overflow: "hidden" },
  heroTitle: { fontFamily: f.extrabold, fontSize: 22, lineHeight: 28, color: c.brandFg },
  heroText: { fontFamily: f.medium, fontSize: 14, lineHeight: 20, color: c.brandFg, opacity: 0.85 },
  heroBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: c.brandFg, paddingHorizontal: 16, paddingVertical: 10 },
  heroBtnText: { fontFamily: f.bold, fontSize: 14, color: c.brand },
  section: { fontFamily: f.extrabold, fontSize: 18, color: c.fg, marginTop: 4 },
  setup: { gap: 10, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14 },
  setupLabel: { fontFamily: f.bold, fontSize: 13, color: c.muted },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "48%", minHeight: 150, borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, padding: 14, gap: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.tint.brand, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: f.extrabold, fontSize: 15, lineHeight: 20, color: c.fg },
  cardMeta: { fontFamily: f.semibold, fontSize: 12, color: c.muted },
  error: { fontFamily: f.regular, color: c.bad, padding: 20 },
}));

type TopicCard = { slug: string; title: string; count: number };

export default function QuizTab() {
  const { c, s } = useStyles();
  const [count, setCount] = useState<number>(10);
  const [timed, setTimed] = useState(false);
  const data = useLoad(async () => {
    const db = await getDatabase();
    const [topics, questions] = await Promise.all([loadTopics(db), loadAllQuizQuestions(db)]);
    const cards: TopicCard[] = topics
      .filter((t) => t.status === "PUBLISHED")
      .map((t) => ({ slug: t.slug, title: t.title, count: questions.filter((q) => q.topicSlug === t.slug).length }))
      .filter((t) => t.count > 0);
    return { cards, total: questions.length };
  }, "quiz-tab");

  if (data.loading) return <Text style={s.error}>Loading…</Text>;
  if (data.error || !data.data) return <Text style={s.error} accessibilityRole="alert">{data.error ?? "Could not load the quizzes."}</Text>;
  const d = data.data;
  const query = (extra: Record<string, string>) => {
    const params = new URLSearchParams({ ...extra, timed: timed ? "1" : "0" }).toString();
    return `/quiz/run?${params}`;
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={{ gap: 4 }}>
        <Text style={s.kicker}>Practice</Text>
        <Text style={s.title} accessibilityRole="header">Quiz</Text>
        <Text style={s.lead}>{`${d.total} questions across ${d.cards.length} topics. Test yourself, then review every explanation.`}</Text>
      </View>

      <View style={s.heroCard} accessibilityLabel="Surprise practice quiz">
        <Icon name="shield" size={28} color={c.brandFg} />
        <Text style={s.heroTitle}>Surprise practice</Text>
        <Text style={s.heroText}>Questions pulled at random from every topic. A good way to check what you remember.</Text>
        <Pressable onPress={() => router.push(query({ mode: "practice", count: String(count) }) as never)} accessibilityRole="button" accessibilityLabel={`Start a practice quiz of ${count} questions`} style={s.heroBtn}>
          <Text style={s.heroBtnText}>Start practice</Text>
          <Icon name="arrowRight" size={16} color={c.brand} />
        </Pressable>
      </View>

      <View style={s.setup}>
        <Text style={s.setupLabel}>Questions</Text>
        <View style={s.row}>
          {QUESTION_COUNTS.map((n) => (
            <Chip key={n} label={`${n} questions`} selected={count === n} onPress={() => setCount(n)} />
          ))}
        </View>
        <Text style={s.setupLabel}>Timing</Text>
        <View style={s.row}>
          <Chip label="No timer" selected={!timed} onPress={() => setTimed(false)} />
          <Chip label="20 seconds per question" selected={timed} onPress={() => setTimed(true)} />
        </View>
      </View>

      <Text style={s.section}>Topic challenges</Text>
      {d.cards.length === 0 ? (
        <Empty title="No quizzes yet" text="Quizzes appear here once the lessons are downloaded." />
      ) : (
        <View style={s.grid}>
          {d.cards.map((t) => (
            <Pressable key={t.slug} onPress={() => router.push(query({ mode: "topic", slug: t.slug }) as never)} accessibilityRole="button" accessibilityLabel={`${t.title}, ${t.count} questions`} style={s.card}>
              <View style={s.iconBox}><Icon name="bolt" size={20} color={c.brand} /></View>
              <Text style={s.cardTitle}>{t.title}</Text>
              <View style={{ flex: 1 }} />
              <Tag label={`${t.count} questions`} tone="brand" />
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
