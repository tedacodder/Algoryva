import { useState } from "react";
import { ScrollView, Text } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { getDatabase } from "../../lib/db/open";
import { loadLesson, loadTopics } from "../../lib/content/repository";
import { loadProgressMap, type TopicProgress } from "../../lib/learner/queries";
import { completedSlugs } from "../../lib/learner/apply";
import { unlockState } from "../../lib/rules/schedule";
import { useLoad } from "../../lib/hooks/useLoad";
import { LessonView } from "../../components/lesson/LessonView";
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
    return { lesson, title: topic?.title ?? "Lesson", progress: (progress.get(slug) ?? null) as TopicProgress | null, locked: !lock.unlocked, missing: missingTitles };
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
  muted: { color: c.muted, padding: 20 },
  error: { color: c.bad, padding: 20 },
}));
