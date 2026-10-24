import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { QuizQuestion } from "../../lib/api/types";
import { makeStyles } from "../../lib/ui/theme";
import { Button } from "../common/Controls";
import { Inline } from "../common/Ui";
import { passNeeded, percent } from "../../lib/quiz/pick";

/**
 * A quiz in the app's style: one question at a time, letter options (A-D), a progress bar, a score chip, and an optional 20-second
 * timer per question. Each answer is marked straight away with its explanation, as on the website. When the quiz ends, the result is
 * shown with a review of every question. `onFinish` gets the chosen answers, so the caller can save a lesson quiz.
 */
export const SECONDS_PER_QUESTION = 20;

const useStyles = makeStyles((c, f) => ({
  wrap: { flex: 1, backgroundColor: c.bg },
  content: { padding: 18, paddingBottom: 40, gap: 16 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { fontFamily: f.semibold, fontSize: 13, color: c.muted },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: c.tint.bad, backgroundColor: c.tint.bad, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { fontFamily: f.bold, fontSize: 13, color: c.bad },
  track: { height: 6, borderRadius: 3, backgroundColor: c.sunken, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: c.bad, borderRadius: 3 },
  timerWrap: { alignItems: "center", gap: 6 },
  timerRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 6, alignItems: "center", justifyContent: "center" },
  timerText: { fontFamily: f.extrabold, fontSize: 28 },
  question: { fontFamily: f.extrabold, fontSize: 21, lineHeight: 28, color: c.fg, textAlign: "center" },
  option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.surface, paddingHorizontal: 14, paddingVertical: 12 },
  optionRight: { borderColor: c.ok, backgroundColor: c.tint.okFaint },
  optionWrong: { borderColor: c.bad, backgroundColor: c.tint.badFaint },
  letter: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: c.lineStrong, alignItems: "center", justifyContent: "center" },
  letterText: { fontFamily: f.extrabold, fontSize: 14, color: c.bad },
  optionText: { flex: 1, fontFamily: f.regular, fontSize: 16, lineHeight: 22, color: c.fg },
  feedback: { borderRadius: 14, padding: 14, gap: 6, borderWidth: 1 },
  feedbackTitle: { fontFamily: f.extrabold, fontSize: 16 },
  feedbackBody: { fontFamily: f.regular, fontSize: 14, lineHeight: 21, color: c.soft },
  result: { alignItems: "center", gap: 10, paddingVertical: 12 },
  bigScore: { fontFamily: f.extrabold, fontSize: 56, letterSpacing: -1 },
  resultTitle: { fontFamily: f.extrabold, fontSize: 22, color: c.fg, textAlign: "center" },
  review: { borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, padding: 14, gap: 6 },
  reviewQ: { fontFamily: f.bold, fontSize: 15, color: c.fg },
  reviewA: { fontFamily: f.regular, fontSize: 14, color: c.soft, lineHeight: 20 },
}));

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuizRunner({ title, questions, timed, onFinish, onExit }: { title: string; questions: QuizQuestion[]; timed: boolean; onFinish?: (answers: number[], score: number) => void; onExit: () => void }) {
  const { c, s } = useStyles();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<(number | null)[]>(() => questions.map(() => null));
  const [left, setLeft] = useState(SECONDS_PER_QUESTION);
  const [finished, setFinished] = useState(false);
  const q = questions[index];
  const ans = chosen[index];
  const answered = ans !== null;
  const score = chosen.reduce<number>((n, a, i) => n + (a !== null && a === questions[i]?.answer ? 1 : 0), 0);
  const need = passNeeded(questions.length);

  // The countdown lives in a ref as well as in state, so the timeout can be recorded from inside the timer callback.
  const leftRef = useRef(SECONDS_PER_QUESTION);

  // The timer runs only while a question is open. When it reaches zero the question is recorded as unanswered (-1), which is wrong.
  useEffect(() => {
    if (!timed || finished || answered || !q) return;
    const id = setInterval(() => {
      leftRef.current -= 1;
      setLeft(leftRef.current);
      if (leftRef.current <= 0) {
        setChosen((prev) => {
          if (prev[index] !== null) return prev;
          const copy = [...prev];
          copy[index] = -1;
          return copy;
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [timed, finished, answered, q, index]);

  const pick = (oi: number) => {
    if (answered || finished) return;
    const next = [...chosen];
    next[index] = oi;
    setChosen(next);
  };

  const next = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      leftRef.current = SECONDS_PER_QUESTION;
      setLeft(SECONDS_PER_QUESTION);
    } else {
      setFinished(true);
      onFinish?.(chosen.map((a) => (a === null || a < 0 ? -1 : a)), score);
    }
  };

  if (questions.length === 0) {
    return (
      <View style={s.wrap}>
        <ScrollView contentContainerStyle={s.content}><Text style={s.resultTitle}>No questions yet.</Text><Button label="Back" onPress={onExit} /></ScrollView>
      </View>
    );
  }

  if (finished) {
    return (
      <ScrollView style={s.wrap} contentContainerStyle={s.content}>
        <View style={s.result} accessibilityLiveRegion="polite">
          <Text style={[s.bigScore, { color: score >= need ? c.ok : c.bad }]}>{`${percent(score, questions.length)}%`}</Text>
          <Text style={s.resultTitle}>{`${score} of ${questions.length} correct`}</Text>
          <Text style={[s.feedbackBody, { textAlign: "center" }]}>{score >= need ? "That is a pass." : `${need} needed to pass. Review the answers below and try again.`}</Text>
        </View>
        {questions.map((q2, i) => {
          const a = chosen[i];
          const ok = a === q2.answer;
          return (
            <View key={i} style={s.review}>
              <Text style={s.reviewQ}>{`${i + 1}. ${q2.q}`}</Text>
              <Text style={[s.reviewA, { color: ok ? c.ok : c.bad }]}>{ok ? "Correct" : a === null || a < 0 ? "No answer" : `Your answer: ${q2.options[a]}`}</Text>
              {!ok ? <Text style={s.reviewA}>{`Correct answer: ${q2.options[q2.answer]}`}</Text> : null}
              <Text style={s.reviewA}>{q2.why}</Text>
            </View>
          );
        })}
        <Button label="Try again" variant="primary" onPress={() => { setIndex(0); setChosen(questions.map(() => null)); leftRef.current = SECONDS_PER_QUESTION; setLeft(SECONDS_PER_QUESTION); setFinished(false); }} />
        <Button label="Done" onPress={onExit} />
      </ScrollView>
    );
  }

  const timedOut = ans === -1;
  const ringColor = c.bad;
  const pct = (index / questions.length) * 100;
  const correctNow = ans !== null && ans === q!.answer;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <View style={s.topRow}>
        <Text style={s.kicker}>{`Question ${index + 1}/${questions.length}`}</Text>
        <View style={s.chip} accessibilityLabel={`Score ${score}`}><Text style={s.chipText}>{`Score: ${score}`}</Text></View>
      </View>
      <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: questions.length, now: index }}>
        <View style={[s.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={[s.kicker, { textAlign: "center" }]}>{title}</Text>

      {timed ? (
        <View style={s.timerWrap}>
          <View style={[s.timerRing, { borderColor: ringColor }]} accessibilityLabel={`${Math.max(0, left)} seconds left`}>
            <Text style={[s.timerText, { color: ringColor }]}>{String(Math.max(0, left))}</Text>
          </View>
        </View>
      ) : null}

      <Text style={s.question} accessibilityRole="header">{q!.q}</Text>

      {q!.options.map((opt, oi) => {
        const right = answered && oi === q!.answer;
        const wrong = answered && ans === oi && oi !== q!.answer;
        return (
          <Pressable
            key={oi}
            onPress={() => pick(oi)}
            disabled={answered}
            accessibilityRole="radio"
            accessibilityState={{ selected: ans === oi, disabled: answered }}
            accessibilityLabel={`${LETTERS[oi]}: ${opt}${right ? ", correct" : wrong ? ", not correct" : ""}`}
            style={[s.option, right && s.optionRight, wrong && s.optionWrong]}
          >
            <View style={s.letter}><Text style={s.letterText}>{LETTERS[oi]}</Text></View>
            <Text style={s.optionText}>{opt}</Text>
          </Pressable>
        );
      })}

      {answered || timedOut ? (
        <View style={[s.feedback, { borderColor: correctNow ? c.tint.okLine : c.tint.badLine, backgroundColor: correctNow ? c.tint.okFaint : c.tint.badFaint }]} accessibilityLiveRegion="polite">
          <Text style={[s.feedbackTitle, { color: correctNow ? c.ok : c.bad }]}>{correctNow ? "Correct" : timedOut ? "Time is up" : "Not quite"}</Text>
          {!correctNow ? <Text style={s.feedbackBody}>{`The answer is ${LETTERS[q!.answer]}: ${q!.options[q!.answer]}`}</Text> : null}
          <Inline text={q!.why} style={s.feedbackBody} />
          <Button label={index + 1 < questions.length ? "Next question" : "See results"} variant="primary" onPress={next} />
        </View>
      ) : null}
    </ScrollView>
  );
}
