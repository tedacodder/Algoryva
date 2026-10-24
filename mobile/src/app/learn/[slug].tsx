import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Stack, useLocalSearchParams } from "expo-router";
import { getDatabase } from "../../lib/db/open";
import { loadLesson, loadTopics } from "../../lib/content/repository";
import { loadProgressMap, type TopicProgress } from "../../lib/learner/queries";
import { completedSlugs } from "../../lib/learner/apply";
import { unlockState } from "../../lib/rules/schedule";
import { useLoad } from "../../lib/hooks/useLoad";
import { LessonView } from "../../components/lesson/LessonView";
import { loadProblems } from "../../lib/content/repository";
import { platformOf } from "../../lib/practice/platform";
import { Icon } from "../../components/Icon";
import { Tag, Callout } from "../../components/common/Controls";
import { H } from "../../components/common/Ui";
import { learner } from "../../lib/sync/runtime";
import { makeStyles } from "../../lib/ui/theme";

export default function LessonScreen() {
  const { s } = useStyles();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [message, setMessage] = useState<string | null>(null);
  const data = useLoad(async () => {
    const db = await getDatabase();
    const [lesson, topics, progress, done] = await Promise.all([loadLesson(db, slug), loadTopics(db), loadProgressMap(db), completedSlugs(db)]);
    const topic = topics.find((t) => t.slug === slug) ?? null;
    const lock = topic ? unlockState(topic.prereqs, done) : { unlocked: true, missing: [] };
    const missingTitles = lock.missing.map((m) => topics.find((t) => t.slug === m)?.title ?? m);
    const problems = (await loadProblems(db)).filter((p) => p.topics.includes(slug));
    return { lesson, title: topic?.title ?? "Lesson", progress: (progress.get(slug) ?? null) as TopicProgress | null, locked: !lock.unlocked, missing: missingTitles, problems };
  }, slug);

  const report = (applied: boolean, reason?: string, ok = "Saved on this device. It will sync when you are online.") => {
    setMessage(applied ? ok : explain(reason));
    if (applied) data.reload();
  };

  if (data.loading) return <Text style={s.muted}>Loading…</Text>;
  if (data.error) return <Text style={s.error} accessibilityRole="alert">{data.error}</Text>;
  const d = data.data;
  if (!d?.lesson) return <Text style={s.error} accessibilityRole="alert">This lesson is not available.</Text>;
  const lesson = d.lesson;

  return (
    <>
      <Stack.Screen options={{ title: d.title }} />
      <ScrollView style={s.screen} contentContainerStyle={s.content}>
        {d.locked ? (
          <Callout tone="warn" title="View only">{`Finish ${d.missing.join(", ")} first. You can read this lesson now; marking it complete and answering its quiz unlock after that.`}</Callout>
        ) : null}
        <LessonView
          lesson={lesson}
          progressState={{
            progress: d.progress,
            locked: d.locked,
            missing: d.missing,
            message,
            onComplete: async () => {
              const r = await learner.completeTopic(slug);
              report(r.applied, r.applied ? undefined : r.reason);
            },
            onQuiz: async (answers) => {
              const r = await learner.submitQuiz(slug, answers);
              report(r.applied, r.applied ? undefined : r.reason, "Answers saved. They will be scored when you are online.");
            },
          }}
        />
        {d.problems.length > 0 ? (
          <View style={{ gap: 10, marginTop: 8 }} accessibilityLabel="Practice this topic">
            <H level={2}>Practice this topic</H>
            <Text style={s.muted}>Problems that use this topic. Algoryva problems are checked here; curated problems open on their own site, and you mark them solved.</Text>
            {d.problems.map((p) => {
              const platform = p.kind === "EXTERNAL" ? platformOf(p.externalUrl) : null;
              return (
                <Pressable key={p.id} onPress={() => router.push(`/problems/${p.slug}` as never)} accessibilityRole="button" accessibilityLabel={`${p.title}, ${p.difficulty.toLowerCase()}${platform ? `, on ${platform.name}` : ""}`} style={s.problem}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.problemTitle}>{p.title}</Text>
                    <Text style={s.muted}>{platform ? `Opens on ${platform.name}` : "Checked here"}</Text>
                  </View>
                  <Tag label={p.difficulty.toLowerCase()} tone="brand" />
                  {platform ? <Icon name="arrowUpRight" size={16} color={s.muted.color as string} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

function explain(reason?: string): string {
  if (reason === "prerequisites_missing") return "Finish the earlier topics first.";
  if (reason === "unknown_topic") return "This topic is not available.";
  return "This can't be saved right now.";
}

const useStyles = makeStyles((c, f) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 18, paddingBottom: 48, gap: 18 },
  problem: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 14, minHeight: 56 },
  problemTitle: { fontFamily: f.bold, fontSize: 15, color: c.fg },
  muted: { color: c.muted, padding: 20 },
  error: { color: c.bad, padding: 20 },
}));
