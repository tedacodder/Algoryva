import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ContentLesson, LessonSection, QuizQuestion } from "../../lib/api/types";
import { vizById } from "../../lib/viz";
import type { TopicProgress } from "../../lib/learner/queries";
import { makeStyles } from "../../lib/ui/theme";
import { Icon, type IconName } from "../Icon";
import { Bullets, Card, Code, Inline, SectionHead, Table } from "../common/Ui";
import { Button, Tag } from "../common/Controls";
import { VizPlayer } from "../viz/VizPlayer";
import { Markdown } from "./Markdown";

/**
 * A lesson in the website's layout and style: each section has an icon-labelled header and the same tinted box as on the web
 * (intuition, observation, naive way, edge cases, mistakes, recognising the pattern, worked problem). Quiz answers are sent to the
 * server for scoring, so the phone shows "scored when online" rather than a score it cannot verify.
 */
export type LessonProgressProps = {
  progress: TopicProgress | null;
  locked: boolean;
  missing: string[];
  message: string | null;
  onComplete: () => void;
  onQuiz: (answers: number[]) => void;
};

const useStyles = makeStyles((c, f) => ({
  wrap: { gap: 30 },
  lead: { fontFamily: f.regular, fontSize: 17, lineHeight: 27, color: c.soft },
  section: { gap: 12 },
  box: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 12 },
  boxBrand: { backgroundColor: c.tint.brandFaint, borderColor: c.tint.brandLine },
  boxSunken: { backgroundColor: c.sunken, borderColor: c.lineStrong },
  boxOk: { backgroundColor: c.tint.okFaint, borderColor: c.tint.okLine },
  boxWarn: { backgroundColor: c.tint.warnFaint, borderColor: c.tint.warnLine },
  paras: { gap: 12 },
  cost: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, backgroundColor: c.tint.bad, paddingHorizontal: 12, paddingVertical: 6 },
  costText: { fontFamily: f.bold, fontSize: 14, color: c.bad },
  stepRow: { flexDirection: "row", gap: 12 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontFamily: f.extrabold, fontSize: 12, color: c.brandFg },
  stepBody: { flex: 1, gap: 4 },
  stepTitle: { fontFamily: f.bold, fontSize: 15, color: c.fg },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  rowLabel: { fontFamily: f.bold, fontSize: 15, color: c.fg },
  rowText: { fontFamily: f.regular, fontSize: 15, lineHeight: 23, color: c.soft, flex: 1 },
  subhead: { fontFamily: f.bold, fontSize: 15, color: c.fg, marginTop: 4 },
  complexityGrid: { gap: 10 },
  complexityCard: { borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, padding: 16, gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mistake: { gap: 6 },
  mistakeHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  mistakeX: { fontFamily: f.bold, fontSize: 16, color: c.bad, width: 14 },
  mistakeText: { fontFamily: f.bold, fontSize: 15, color: c.fg, flex: 1 },
  mistakeFix: { fontFamily: f.regular, fontSize: 15, lineHeight: 23, color: c.soft, marginLeft: 22 },
  edgeRow: { borderTopWidth: 1, borderTopColor: c.line, paddingVertical: 12, gap: 4 },
  takeaway: { flexDirection: "row", gap: 10, borderRadius: 12, backgroundColor: c.tint.okFaint, padding: 14, alignItems: "flex-start" },
  well: { borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.sunken, padding: 16, gap: 6 },
  wellLabel: { fontFamily: f.bold, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: c.muted },
  cheatRow: { flexDirection: "row", gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.line },
  cheatLabel: { fontFamily: f.bold, fontSize: 13, color: c.muted, width: 110 },
  cheatValue: { fontFamily: f.mono, fontSize: 14, color: c.fg, flex: 1 },
  quizQ: { gap: 8, marginTop: 6 },
  quizResult: { gap: 4, borderRadius: 12, backgroundColor: c.sunken, padding: 14 },
  resultScore: { fontFamily: f.extrabold, fontSize: 22 },
  optionRight: { borderColor: c.ok, borderWidth: 2, backgroundColor: c.tint.okFaint },
  optionWrong: { borderColor: c.bad, borderWidth: 2, backgroundColor: c.tint.badFaint },
  why: { fontFamily: f.regular, fontSize: 14, lineHeight: 21, color: c.soft, marginTop: 2 },
  option: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.surface, paddingHorizontal: 14, justifyContent: "center" },
  optionOn: { borderColor: c.brand, borderWidth: 2, backgroundColor: c.tint.brandFaint },
  optionText: { fontFamily: f.regular, fontSize: 15, color: c.fg },
  meta: { fontFamily: f.regular, fontSize: 14, lineHeight: 21, color: c.muted },
  progressCard: { gap: 10 },
}));

export function LessonView({ lesson, progressState }: { lesson: ContentLesson; progressState?: LessonProgressProps }) {
  if (lesson.source === "custom") return <Markdown source={lesson.markdown} />;
  return (
    <LessonBody lesson={lesson} progressState={progressState} />
  );
}

function LessonBody({ lesson, progressState }: { lesson: Extract<ContentLesson, { source: "builtin" }>; progressState?: LessonProgressProps }) {
  const { s } = useStyles();
  return (
    <View style={s.wrap}>
      <Text style={s.lead}>{lesson.hook}</Text>
      {progressState ? <StatusTag state={progressState} /> : null}
      <Card>
        <SectionHead icon="target" label="Objectives" title="What you will be able to do" />
        <Bullets items={lesson.objectives} />
        {lesson.prereqNote ? <Inline text={lesson.prereqNote} /> : null}
        <Text style={s.meta}>{`About ${lesson.minutes} minutes`}</Text>
      </Card>

      {lesson.sections.map((sec) => (
        <SectionView key={sec.id} section={sec} />
      ))}

      {lesson.cheatSheet.length > 0 ? (
        <Card>
          <SectionHead icon="note" label="Cheat sheet" title="Keep this handy" />
          {lesson.cheatSheet.map((item, i) => (
            <CheatRow key={i} label={item.label} value={item.value} />
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionHead icon="check" label="Summary" title="The short version" />
        <Bullets items={lesson.summary} />
      </Card>

      {lesson.checks.length > 0 ? <Quiz questions={lesson.checks} progress={progressState?.progress ?? null} onSubmit={progressState?.onQuiz} /> : null}

      {lesson.nextNote ? <Inline text={lesson.nextNote} /> : null}

      {progressState ? <ProgressCard state={progressState} /> : null}
    </View>
  );
}

function CheatRow({ label, value }: { label: string; value: string }) {
  const { s } = useStyles();
  return (
    <View style={s.cheatRow}>
      <Text style={s.cheatLabel}>{label}</Text>
      <Text style={s.cheatValue}>{value}</Text>
    </View>
  );
}

function StatusTag({ state }: { state: LessonProgressProps }) {
  const done = state.progress?.completedAt != null;
  return <Tag label={done ? "Completed" : state.locked ? "Locked" : "In progress"} tone={done ? "ok" : state.locked ? "neutral" : "brand"} />;
}

/** The completion control, at the end of the lesson (after the quiz), as on the website. */
function ProgressCard({ state }: { state: LessonProgressProps }) {
  const { s } = useStyles();
  const done = state.progress?.completedAt != null;
  return (
    <Card>
      <View style={s.progressCard}>
        {state.locked ? (
          <Inline text={`Finish ${state.missing.join(", ")} first, then you can mark this topic complete.`} />
        ) : done ? (
          <Inline text="You have completed this topic. It is saved on this device and will sync when you are online." />
        ) : (
          <>
            <Inline text="Finished reading and the check? Mark the topic complete to unlock what comes next." />
            <Button label="Mark this topic complete" variant="primary" onPress={state.onComplete} icon="check" />
          </>
        )}
        {state.message ? <Text style={s.meta} accessibilityLiveRegion="polite">{state.message}</Text> : null}
      </View>
    </Card>
  );
}

function SectionView({ section: sec }: { section: LessonSection }) {
  const { c, s } = useStyles();
  const body = (
    <>
      <SectionHead icon={headIcon(sec.kind)} label={headLabel(sec.kind)} tone={headTone(sec.kind)} title={sec.title} />
      {sec.paras?.map((t, i) => <Inline key={i} text={t} />)}
    </>
  );
  switch (sec.kind) {
    case "intuition":
      return <View style={[s.box, s.boxBrand]} accessibilityLabel={`Section: ${sec.title}`}><SectionHead icon="bolt" label="Intuition" title={sec.title} />{sec.paras?.map((t, i) => <Inline key={i} text={t} />)}</View>;
    case "observation":
      return <View style={[s.box, s.boxOk]} accessibilityLabel={`Section: ${sec.title}`}><SectionHead icon="sparkle" label="The observation" tone="ok" title={sec.title} />{sec.paras?.map((t, i) => <Inline key={i} text={t} />)}</View>;
    case "naive":
      return (
        <View style={[s.box, s.boxSunken]} accessibilityLabel={`Section: ${sec.title}`}>
          <SectionHead icon="clock" label="First, the naive way" tone="muted" title={sec.title} />
          {sec.paras?.map((t, i) => <Inline key={i} text={t} />)}
          {sec.code ? <Code code={sec.code} /> : null}
          <View style={s.cost}><Icon name="alert" size={14} color={c.bad} /><Text style={s.costText}>{`Cost: ${sec.cost ?? ""}`}</Text></View>
        </View>
      );
    case "viz": {
      const viz = vizById(sec.viz ?? "");
      return (
        <View style={s.section} accessibilityLabel={`Section: ${sec.title}`}>
          <SectionHead icon="play" label="See it move" title={sec.title} />
          {sec.paras?.map((t, i) => <Inline key={i} text={t} />)}
          {viz ? <VizPlayer viz={viz} /> : <Inline text="This visualization is unavailable." />}
        </View>
      );
    }
    case "example":
      return (
        <View style={s.section} accessibilityLabel={`Section: ${sec.title}`}>
          <SectionHead icon="target" label="Worked by hand" title={sec.title} />
          {sec.paras?.map((t, i) => <Inline key={i} text={t} />)}
          {sec.table ? <Table head={sec.table.head} rows={sec.table.rows} /> : null}
          {sec.steps ? (
            <View style={{ gap: 12 }}>
              {sec.steps.map((st, i) => (
                <View key={i} style={s.stepRow}>
                  <View style={s.stepNum}><Text style={s.stepNumText}>{String(i + 1)}</Text></View>
                  <View style={s.stepBody}>
                    <Text style={s.stepTitle}>{st.title}</Text>
                    <Inline text={st.body} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      );
    case "code":
      return (
        <View style={s.section} accessibilityLabel={`Section: ${sec.title}`}>
          <SectionHead icon="note" label="Implementation" title={sec.title} />
          {sec.paras?.map((t, i) => <Inline key={i} text={t} />)}
          {sec.pseudocode ? (
            <>
              <Text style={s.subhead}>Plan in plain steps</Text>
              <Code code={sec.pseudocode} label="pseudocode" />
            </>
          ) : null}
          {sec.code ? <Code code={sec.code} /> : null}
          {sec.walkthrough ? (
            <>
              <Text style={s.subhead}>Reading the code</Text>
              <Bullets items={sec.walkthrough} />
            </>
          ) : null}
        </View>
      );
    case "complexity":
      return (
        <View style={s.section} accessibilityLabel={`Section: ${sec.title}`}>
          <SectionHead icon="chart" label="Complexity" title={sec.title} />
          {sec.paras?.map((t, i) => <Inline key={i} text={t} />)}
          <View style={s.complexityGrid}>
            {(sec.rows ?? []).map((r, i) => (
              <View key={i} style={s.complexityCard}>
                <Text style={s.rowLabel}>{r.what}</Text>
                <View style={s.chips}>
                  <Tag label={`time ${r.time}`} tone="brand" />
                  <Tag label={`space ${r.space}`} />
                </View>
                <Inline text={r.why} />
              </View>
            ))}
          </View>
        </View>
      );
    case "edge":
      return (
        <View style={s.section} accessibilityLabel={`Section: ${sec.title}`}>
          <SectionHead icon="alert" label="Edge cases" tone="warn" title={sec.title} />
          <View>
            {(sec.items ?? []).map((it, i) => (
              <View key={i} style={s.edgeRow}>
                <Text style={s.rowLabel}>{it.case ?? ""}</Text>
                <Inline text={it.handle ?? ""} />
              </View>
            ))}
          </View>
        </View>
      );
    case "mistakes":
      return (
        <View style={[s.box, s.boxWarn]} accessibilityLabel={`Section: ${sec.title}`}>
          <SectionHead icon="alert" label="Common mistakes" tone="warn" title={sec.title} />
          {(sec.items ?? []).map((it, i) => (
            <View key={i} style={s.mistake}>
              <View style={s.mistakeHead}>
                <Text style={s.mistakeX} accessibilityLabel="Mistake">×</Text>
                <View style={{ flex: 1 }}><Inline text={it.mistake ?? ""} style={s.mistakeText} /></View>
              </View>
              <Inline text={it.fix ?? ""} style={s.mistakeFix} />
            </View>
          ))}
        </View>
      );
    case "recognize":
      return (
        <View style={[s.box, s.boxBrand]} accessibilityLabel={`Section: ${sec.title}`}>
          <SectionHead icon="search" label="Recognize it in a contest" title={sec.title} />
          {sec.paras?.map((t, i) => <Inline key={i} text={t} />)}
          <Text style={s.subhead}>Reach for it when the problem says or implies</Text>
          {(sec.signals ?? []).map((t, i) => (
            <View key={i} style={s.row}><Icon name="check" size={16} color={c.ok} /><Inline text={t} style={s.rowText} /></View>
          ))}
          {sec.notThis && sec.notThis.length > 0 ? (
            <>
              <Text style={s.subhead}>Look elsewhere when</Text>
              {sec.notThis.map((t, i) => (
                <View key={i} style={s.row}><Icon name="arrowRight" size={16} color={c.muted} /><Inline text={t} style={s.rowText} /></View>
              ))}
            </>
          ) : null}
        </View>
      );
    case "worked":
      return (
        <View style={s.section} accessibilityLabel={`Section: ${sec.title}`}>
          <SectionHead icon="flag" label="Worked problem" title={sec.title} />
          <View style={s.well}>
            <Text style={s.wellLabel}>The problem</Text>
            <Inline text={sec.problem ?? ""} />
          </View>
          <View style={{ gap: 6 }}>
            {(sec.approach ?? []).map((t, i) => <View key={i} style={s.row}><Text style={s.rowLabel}>{`${i + 1}.`}</Text><Inline text={t} style={s.rowText} /></View>)}
          </View>
          {sec.code ? <Code code={sec.code} /> : null}
          <View style={s.takeaway}>
            <Icon name="bolt" size={16} color={c.ok} />
            <View style={{ flex: 1 }}><Inline text={`**Takeaway.** ${sec.takeaway ?? ""}`} style={s.rowText} /></View>
          </View>
        </View>
      );
    default:
      return <View style={s.section} accessibilityLabel={`Section: ${sec.title}`}>{body}</View>;
  }
}

function headIcon(kind: LessonSection["kind"]): IconName {
  switch (kind) {
    case "intuition": return "bolt";
    case "concept": return "book";
    case "naive": return "clock";
    case "observation": return "sparkle";
    case "viz": return "play";
    case "example": return "target";
    case "code": return "note";
    case "complexity": return "chart";
    case "edge": return "alert";
    case "mistakes": return "alert";
    case "recognize": return "search";
    case "worked": return "flag";
    default: return "book";
  }
}

function headLabel(kind: LessonSection["kind"]): string {
  switch (kind) {
    case "concept": return "The concept";
    case "intuition": return "Intuition";
    case "observation": return "The observation";
    default: return "Section";
  }
}

function headTone(kind: LessonSection["kind"]): "brand" | "warn" | "ok" | "muted" {
  if (kind === "edge" || kind === "mistakes") return "warn";
  if (kind === "observation") return "ok";
  if (kind === "naive") return "muted";
  return "brand";
}

/**
 * The quiz, as on the website: every question is answered in place. Each answer is marked right or wrong straight away, with its
 * explanation. When the last question is answered, the score is shown and the result is saved (queued for the server).
 */
export function Quiz({ questions, progress, onSubmit }: { questions: QuizQuestion[]; progress: TopicProgress | null; onSubmit?: (answers: number[]) => void }) {
  const { c, s } = useStyles();
  const [picked, setPicked] = useState<Record<number, number>>({});
  const answered = Object.keys(picked).length;
  const done = answered === questions.length;
  const score = questions.reduce((n, q, i) => n + (picked[i] === q.answer ? 1 : 0), 0);
  const need = Math.ceil(questions.length * 0.8);
  const passed = score >= need;

  const choose = (qi: number, oi: number) => {
    if (picked[qi] !== undefined) return;
    const next = { ...picked, [qi]: oi };
    setPicked(next);
    if (Object.keys(next).length === questions.length) {
      onSubmit?.(questions.map((_, i) => next[i]!));
    }
  };

  return (
    <Card>
      <SectionHead icon="target" label="Mastery check" title="Check your understanding" />
      <Text style={s.meta}>
        {progress?.quizBest != null && progress.quizTotal != null ? `Best so far: ${progress.quizBest} of ${progress.quizTotal}. ` : ""}
        {`Answer each question. ${need} of ${questions.length} correct to pass.`}
      </Text>
      {questions.map((q, qi) => {
        const p = picked[qi];
        return (
          <View key={qi} style={s.quizQ}>
            <Inline text={`${qi + 1}. ${q.q}`} />
            {q.options.map((opt, oi) => {
              const right = p !== undefined && oi === q.answer;
              const wrong = p === oi && oi !== q.answer;
              return (
                <Pressable
                  key={oi}
                  disabled={p !== undefined}
                  onPress={() => choose(qi, oi)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: p === oi, disabled: p !== undefined }}
                  accessibilityLabel={`Option ${oi + 1}: ${opt}${right ? ", correct" : wrong ? ", not correct" : ""}`}
                  style={[s.option, right && s.optionRight, wrong && s.optionWrong]}
                >
                  <Text style={s.optionText}>{opt}</Text>
                </Pressable>
              );
            })}
            {p !== undefined ? (
              <Text style={[s.why, { color: p === q.answer ? c.ok : c.warn }]} accessibilityLiveRegion="polite">
                {`${p === q.answer ? "Correct. " : "Not quite. "}${q.why}`}
              </Text>
            ) : null}
          </View>
        );
      })}
      {done ? (
        <View style={s.quizResult} accessibilityLiveRegion="polite">
          <Text style={[s.resultScore, { color: passed ? c.ok : c.warn }]}>{`${score} of ${questions.length} correct`}</Text>
          <Text style={s.meta}>
            {passed ? "That is a pass. Your result is saved on this device and will sync when you are online." : `${need} needed to pass. Read the explanations, then try again.`}
          </Text>
          <Button label="Try again" onPress={() => setPicked({})} />
        </View>
      ) : null}
    </Card>
  );
}
