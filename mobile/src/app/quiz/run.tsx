import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { getDatabase } from "../../lib/db/open";
import { loadAllQuizQuestions } from "../../lib/learner/queries";
import { loadLesson } from "../../lib/content/repository";
import { pickRandom, QUESTION_COUNTS } from "../../lib/quiz/pick";
import { learner } from "../../lib/sync/runtime";
import { QuizRunner } from "../../components/quiz/QuizRunner";
import type { QuizQuestion } from "../../lib/api/types";
import { makeStyles } from "../../lib/ui/theme";

/**
 * Runs a quiz. Two kinds:
 *  - topic: every question of one lesson. A completed attempt is saved for the account (quiz.submit), as on the lesson page.
 *  - practice: a random set from all lessons. Kept on this device only; it does not change the lesson mastery.
 */
const useStyles = makeStyles((c, f) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg, gap: 12, padding: 24 },
  text: { fontFamily: f.regular, color: c.soft, fontSize: 15, textAlign: "center" },
}));

export default function QuizRun() {
  const { c, s } = useStyles();
  const params = useLocalSearchParams<{ mode?: string; slug?: string; count?: string; timed?: string }>();
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [title, setTitle] = useState("Quiz");
  const [note, setNote] = useState<string | null>(null);
  const timed = params.timed === "1";

  useEffect(() => {
    let alive = true;
    (async () => {
      const db = await getDatabase();
      if (params.mode === "topic" && params.slug) {
        const lesson = await loadLesson(db, params.slug);
        const checks = lesson && lesson.source === "builtin" ? lesson.checks : [];
        if (alive) {
          setTitle("Topic challenge");
          setQuestions(checks);
        }
      } else {
        const all = await loadAllQuizQuestions(db);
        const want = Number(params.count) || QUESTION_COUNTS[1];
        const chosen = pickRandom(all, want).map((x) => x.question);
        if (alive) {
          setTitle("Practice quiz");
          setNote("Practice results stay on this device and do not change your lesson progress.");
          setQuestions(chosen);
        }
      }
    })().catch(() => alive && setQuestions([]));
    return () => {
      alive = false;
    };
  }, [params.mode, params.slug, params.count]);

  if (!questions) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={c.brand} />
        <Text style={s.text}>Preparing your quiz…</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title, headerStyle: { backgroundColor: c.surface }, headerTintColor: c.fg }} />
      <QuizRunner
        title={note ?? title}
        questions={questions}
        timed={timed}
        onFinish={(answers) => {
          if (params.mode === "topic" && params.slug) void learner.submitQuiz(params.slug, answers);
        }}
        onExit={() => router.back()}
      />
    </>
  );
}
