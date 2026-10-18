import { customLesson, topicPractice } from "@/lib/content";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TOPICS, bySlug } from "@/lib/curriculum";
import { LEVEL_META } from "@/lib/levels";
import { LESSONS } from "@/content/lessons";
import { LESSONS_V2 } from "@/content/lessons-v2";
import { TIERS, tierOf } from "@/content/practice";
import { getCurrentUser } from "@/lib/auth/session";
import { getCompletedSlugs } from "@/lib/progress";
import { unlockState } from "@/lib/recommend";
import { markComplete } from "@/app/actions";
import { db } from "@/lib/db";
import { parseLessonMarkdown } from "@/lib/lesson-markdown";
import { readMinutes, topicStates } from "@/lib/topic-state";
import { masteryOf } from "@/lib/mastery";
import { slugify } from "@/lib/url";
import { vizFor } from "@/lib/viz";
import { algosForLesson } from "@/lib/visualizer/registry";
import { Visualizer } from "@/components/Visualizer";
import { Difficulty, KindBadge } from "@/components/ProblemBadge";
import { CodeBlock, Callout } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { Icon } from "@/components/Icon";
import { LessonBody, Objectives, WrapUp, lessonToc } from "@/components/lesson/LessonView";
import { Quiz } from "@/components/lesson/Quiz";
import { PathRail } from "@/components/lesson/PathRail";
import { LessonFrame } from "@/components/lesson/LessonFrame";

type Props = { params: Promise<{ slug: string }> };

// Per-user state (progress, mastery, notes) is rendered on the server for every request; crawlers still receive full HTML.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug, t = bySlug.get(slug);
  if (!t) return { title: "Topic" };
  const v2 = LESSONS_V2[slug];
  const description = v2 ? v2.hook.replace(/[`*]/g, "") : `${t.title}: an outline on Algoryva.`;
  return {
    title: t.title, description,
    alternates: { canonical: `/learn/${slug}` },
    openGraph: { title: t.title, description, type: "article", url: `/learn/${slug}` },
    // Outlines and planned topics are thin, so they stay out of search indexes until they are complete lessons.
    robots: v2 ? undefined : { index: false, follow: true },
  };
}

// Legacy outline blocks map their headings to a visual role.
const role = (h: string) => /mistake|pitfall|watch out/i.test(h) ? "warn" : /idea|intuition|recognize|key/i.test(h) ? "key" : /complex/i.test(h) ? "complexity" : "plain";

export default async function TopicPage({ params }: Props) {
  const topic = bySlug.get((await params).slug);
  if (!topic) notFound();
  // A published admin lesson replaces the built-in text for every topic, including full lessons.
  const builtin = LESSONS_V2[topic.slug];
  const custom = await customLesson(topic.slug);
  const v2 = custom?.sections[0] ? undefined : builtin;
  const blocks = v2 ? undefined : custom?.sections[0] ? parseLessonMarkdown(custom.sections[0].body) : LESSONS[topic.slug]?.blocks;
  const viz = !v2 && blocks ? vizFor(topic.slug) : null;
  const user = await getCurrentUser();
  const completed = user ? await getCompletedSlugs(user.id) : new Set<string>();
  const states = topicStates(completed, !user);
  const state = unlockState(topic.slug, completed);
  const practice = topic.status === "PUBLISHED" ? await topicPractice(topic.slug) : [];
  const [quiz, solvedRows, review] = user && topic.status === "PUBLISHED" ? await Promise.all([
    db.quizResult.findFirst({ where: { userId: user.id, topic: { slug: topic.slug } }, select: { passedAt: true, bestScore: true, total: true } }),
    db.problemSolve.findMany({ where: { userId: user.id, problemId: { in: practice.map((p) => p.id) } }, select: { problemId: true } }),
    db.topic.findUnique({ where: { slug: topic.slug }, select: { id: true } }).then((t) => t ? db.reviewItem.findUnique({ where: { userId_topicId: { userId: user.id, topicId: t.id } }, select: { step: true } }) : null),
  ]) : [null, [], null];
  const solved = new Set(solvedRows.map((s) => s.problemId));
  const isDone = completed.has(topic.slug);
  const mastery = user && v2 ? masteryOf({ completed: isDone, quizPassed: !!quiz?.passedAt, solved: solved.size, available: practice.length, reviewStep: review?.step ?? 0 }) : null;

  const published = TOPICS.filter((t) => t.status === "PUBLISHED");
  const at = published.findIndex((t) => t.slug === topic.slug);
  const nextTopic = at >= 0 ? published[at + 1] : undefined;
  const prevTopic = at > 0 ? published[at - 1] : undefined;
  const lv = LEVEL_META[topic.level], mins = v2?.minutes ?? readMinutes(topic.slug);
  const toc = v2 ? lessonToc(v2) : (blocks ?? []).map((b) => ({ id: slugify(b.heading), title: b.heading }));
  const noteHref = `/notes?nt=${encodeURIComponent(`${topic.title}: my notes`)}&ntags=${encodeURIComponent(topic.slug)}`;
  const tiers = TIERS.map((t) => ({ ...t, items: practice.filter((p) => tierOf(p) === t.id) })).filter((t) => t.items.length > 0);
  const ld = v2 ? { "@context": "https://schema.org", "@type": "LearningResource", name: topic.title, description: v2.hook.replace(/[`*]/g, ""), educationalLevel: lv.label, timeRequired: `PT${v2.minutes}M`, inLanguage: "en", teaches: v2.objectives.map((o) => o.replace(/[`*]/g, "")) } : null;

  return (
    <>
      <div aria-hidden="true" className="read-progress fixed inset-x-0 top-0 z-50 h-0.5 bg-brand" />
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />}
      <div className="page-wide">
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-muted"><Link href="/learn" className="hover:text-fg">Learn</Link><Icon name="chevronRight" size={14} /><Link href="/roadmap" style={{ color: `rgb(var(--lv${lv.n}))` }} className="font-semibold">{lv.label}</Link></nav>
        <LessonFrame
          toc={(<>
            <details className="lg:hidden card px-4 py-3"><summary className="flex items-center justify-between font-bold">On this page<Icon name="chevronDown" size={16} /></summary>
              <ol className="mt-2 space-y-1">{toc.map((t) => <li key={t.id}><a href={`#${t.id}`} className="block py-1.5 text-sm text-soft">{t.title}</a></li>)}</ol></details>
            <div className="hidden lg:block">
              <ol className="space-y-0.5 border-l border-line">{toc.map((t) => <li key={t.id}><a href={`#${t.id}`} className="-ml-px block border-l-2 border-transparent py-1 pl-3 text-sm text-soft hover:border-brand hover:text-fg">{t.title}</a></li>)}
                {viz && <li><a href="#visualizer" className="-ml-px block border-l-2 border-transparent py-1 pl-3 text-sm text-soft hover:border-brand hover:text-fg">Visualizer</a></li>}
                {v2 && <li><a href="#summary" className="-ml-px block border-l-2 border-transparent py-1 pl-3 text-sm font-bold text-soft hover:border-brand hover:text-fg">Wrap-up</a></li>}
                {v2 && <li><a href="#mastery-check" className="-ml-px block border-l-2 border-transparent py-1 pl-3 text-sm font-bold text-soft hover:border-brand hover:text-fg">Mastery check</a></li>}
                {practice.length > 0 && <li><a href="#practice" className="-ml-px block border-l-2 border-transparent py-1 pl-3 text-sm font-bold text-soft hover:border-brand hover:text-fg">Practice</a></li>}</ol>
            </div>
          </>)}
          rail={(<>
            <PathRail topic={topic} states={states} />
            {user && <div><h2 className="text-sm font-extrabold">Notes</h2><Link href={noteHref} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand"><Icon name="note" size={14} />Write a note on this lesson</Link></div>}
          </>)}
        >
          <article className="min-w-0">
            <header>
              <div className="flex flex-wrap items-center gap-2"><span className="chip" style={{ borderColor: `rgb(var(--lv${lv.n}) / .4)`, color: `rgb(var(--lv${lv.n}))` }}>{lv.label}</span>
                {mins && <span className="chip"><Icon name="clock" size={12} />{v2 ? `${mins} min with visuals and checks` : `${mins} min read`}</span>}
                {topic.status === "PUBLISHED" && !v2 && <span className="chip chip-warn">Outline</span>}
                {isDone && <span className="chip chip-ok animate-pop"><Icon name="check" size={12} strokeWidth={2.6} />Completed</span>}</div>
              <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">{topic.title}</h1>
            </header>
            {topic.status === "COMING_SOON" && <div className="mt-8"><Callout title="Planned, not written yet">This topic is on the roadmap but the lesson has not been written. Check what it builds on below to see what leads up to it.</Callout></div>}
            {topic.status === "PUBLISHED" && !v2 && blocks && <div className="mt-8"><Callout tone="warn" title="This lesson is an outline, not a full lesson yet">It covers the key ideas and code but not yet the step-by-step visuals, edge cases, pattern recognition and mastery check that complete lessons have. The practice problems below are still worth doing.</Callout></div>}
            {topic.status === "PUBLISHED" && !v2 && !blocks && <div className="mt-8"><Callout>Lesson text for this topic is coming. You can still track it as complete once you have studied it elsewhere.</Callout></div>}

            {v2 && <div className="mt-8 space-y-12"><Objectives lesson={v2} /><LessonBody lesson={v2} /></div>}

            {!v2 && blocks && (
              <div className="mt-8 space-y-10">
                {blocks.map((b) => {
                  const r = role(b.heading);
                  return (
                    <section key={b.heading} id={slugify(b.heading)} className={r === "warn" ? "rounded-2xl border border-warn/30 bg-warn/[.06] p-5" : r === "key" ? "rounded-2xl border border-brand/25 bg-brand/[.05] p-5" : ""}>
                      <h2 className="flex items-center gap-2 text-2xl font-extrabold">{r === "warn" && <Icon name="alert" className="text-warn" />}{r === "key" && <Icon name="bolt" className="text-brand" />}{r === "complexity" && <Icon name="chart" className="text-brand" />}{b.heading}</h2>
                      <div className="prose-lesson mt-3">{b.text.split(/\n{2,}/).map((para, k) => <p key={k}>{para}</p>)}</div>
                      {b.code && <CodeBlock code={b.code} />}
                    </section>
                  );
                })}
              </div>
            )}
            {algosForLesson(topic.slug).length > 0 && (
              <p className="mt-6 flex flex-wrap items-center gap-2 text-sm font-semibold">
                <Icon name="play" size={14} className="text-brand" />
                <Link href={`/visualizer?lesson=${topic.slug}`} className="text-brand underline-offset-4 hover:underline">Visualize this algorithm</Link>
                <span className="font-normal text-muted">with your own input and step by step pseudocode</span>
              </p>
            )}
            {viz && <div id="visualizer"><Visualizer title={viz.title} frames={viz.frames} /></div>}

            {v2 && (
              <div className="mt-14 space-y-8">
                <WrapUp lesson={v2} />
                <Quiz slug={topic.slug} checks={v2.checks} loggedIn={!!user} alreadyPassed={!!quiz?.passedAt} />
              </div>
            )}

            {topic.status === "PUBLISHED" && (
              <div className="mt-12 rounded-2xl border border-line bg-surface p-6 shadow-e1">
                {!user ? <p className="text-sm text-soft"><Link className="font-bold text-brand" href="/login">Log in</Link> to track progress and unlock what comes next.</p>
                  : isDone ? <div className="flex items-center gap-3"><span className="grid h-11 w-11 animate-pop place-items-center rounded-full bg-ok text-white"><Icon name="check" size={22} strokeWidth={2.6} /></span><p className="font-bold text-ok">Completed. A review is scheduled.</p></div>
                  : state.unlocked ? <form action={markComplete} className="flex flex-wrap items-center gap-4"><input type="hidden" name="slug" value={topic.slug} /><SubmitButton className="btn btn-primary btn-lg" pendingLabel="Saving">Mark as complete</SubmitButton><span className="text-sm text-muted">Finished reading and tried the practice? This unlocks the next topics.</span></form>
                  : <div className="flex gap-3"><Icon name="lock" className="mt-0.5 text-muted" /><p className="text-sm text-soft"><span className="font-bold">Locked. Complete first: {state.missing.join(", ")}.</span> Those topics teach what this one builds on.</p></div>}
                {mastery && (
                  <div className="mt-5 border-t border-line pt-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-base font-extrabold">Mastery: <span className="capitalize">{mastery.stage}</span></h2><span className="tnum text-sm font-bold text-muted">{mastery.percent}%</span></div>
                    <div className="bar mt-2" role="progressbar" aria-label="Mastery" aria-valuenow={mastery.percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${mastery.percent}%` }} /></div>
                    <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">{mastery.signals.map((s) => <li key={s.label} className="flex items-center gap-2 text-sm"><Icon name={s.done ? "check" : "arrowRight"} size={14} strokeWidth={2.6} className={s.done ? "text-ok" : "text-muted"} /><span className={s.done ? "" : "text-soft"}>{s.label}{s.detail && !s.done ? ` (${s.detail})` : ""}</span></li>)}</ul>
                    <p className="mt-3 text-sm text-soft"><strong>Next: </strong>{mastery.next}</p>
                  </div>
                )}
              </div>
            )}

            {tiers.length > 0 && (
              <section id="practice" className="mt-12 scroll-mt-24">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-2xl font-extrabold">Practice this topic</h2><Link href={`/problems?topic=${topic.slug}`} className="text-sm font-bold text-brand">All problems</Link></div>
                <p className="mt-1 text-sm text-soft">Go top to bottom. Each tier answers a different question, so skipping ahead tells you less than it seems. Difficulty labels are estimates.</p>
                <div className="mt-4 space-y-6">
                  {tiers.map((t) => (
                    <div key={t.id}>
                      <h3 className="text-sm font-extrabold uppercase tracking-wide text-muted">{t.label}<span className="ml-2 font-semibold normal-case tracking-normal">{t.items.length} problem{t.items.length === 1 ? "" : "s"}</span></h3>
                      <p className="mt-0.5 text-sm text-soft">{t.why}</p>
                      <ul className="card mt-2 divide-y divide-line">{t.items.map((p) => (
                        <li key={p.id}><Link href={`/problems/${p.slug}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-sunken"><span className="flex min-w-0 items-center gap-2 font-semibold">{solved.has(p.id) && <Icon name="check" size={15} strokeWidth={2.8} className="shrink-0 text-ok" />}<span className="truncate">{p.title}</span>{solved.has(p.id) && <span className="sr-only">Solved</span>}</span><span className="flex shrink-0 items-center gap-3"><Difficulty value={p.difficulty} /><KindBadge kind={p.kind} source={p.source} /></span></Link></li>))}</ul>
                    </div>
                  ))}
                </div>
                {user && <p className="mt-4 text-sm text-soft">Stuck or got it wrong? <Link className="font-bold text-brand" href="/mistakes">Log what you misunderstood</Link> so the next review targets it.</p>}
              </section>
            )}

            <nav aria-label="Lesson navigation" className="mt-12 grid gap-3 sm:grid-cols-2">
              {prevTopic ? <Link href={`/learn/${prevTopic.slug}`} className="card card-link p-4"><span className="flex items-center gap-1.5 text-xs font-semibold text-muted"><Icon name="arrowLeft" size={14} />Previous</span><span className="mt-1 block font-bold">{prevTopic.title}</span></Link> : <span />}
              {nextTopic && <Link href={`/learn/${nextTopic.slug}`} className="card card-link p-4 text-right"><span className="flex items-center justify-end gap-1.5 text-xs font-semibold text-muted">Next<Icon name="arrowRight" size={14} /></span><span className="mt-1 block font-bold">{nextTopic.title}</span></Link>}
            </nav>
            {v2?.nextNote && <p className="mt-3 text-sm text-soft">{v2.nextNote.replace(/\*\*/g, "")}</p>}
          </article>
        </LessonFrame>
      </div>
    </>
  );
}
