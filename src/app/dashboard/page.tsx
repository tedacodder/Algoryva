import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { dueReviews, getCompletedSlugs } from "@/lib/progress";
import { nextTopics } from "@/lib/recommend";
import { LEVELS, TOPICS } from "@/lib/curriculum";
import { LEVEL_META } from "@/lib/levels";
import { readMinutes, topicStates } from "@/lib/topic-state";
import { isComplete } from "@/content/lessons-v2";
import { reviewTopic } from "@/app/actions";
import { resendVerification } from "@/app/auth-actions";
import { SimpleForm } from "@/components/SimpleForm";
import { getStreak, getWeekActivity } from "@/lib/activity";
import { getStats } from "@/lib/stats";
import { computeXp, levelFor } from "@/lib/gamification";
import { recommendProblems } from "@/lib/problems";
import { Difficulty, KindBadge } from "@/components/ProblemBadge";
import { SolvedCheckbox } from "@/components/SolvedCheckbox";
import { LessonTree } from "@/components/LessonTree";
import { Callout, EmptyState, ProgressBar, Ring } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser();
  const [completed, reviews] = await Promise.all([getCompletedSlugs(user.id), dueReviews(user.id)]);
  const [streak, stats, week] = await Promise.all([getStreak(user.id), getStats(user.id), getWeekActivity(user.id)]);
  const lv = levelFor(computeXp(stats));
  const next = nextTopics(completed, 3);
  const practice = await recommendProblems(user.id, [...completed], 5);
  const live = TOPICS.filter((t) => t.status === "PUBLISHED");
  const done = live.filter((t) => completed.has(t.slug)).length;
  const hero = next[0], mins = hero ? readMinutes(hero.slug) : null;
  const activeToday = week[6].count > 0;
  const hour = new Date().getUTCHours();

  return (
    <div className="page space-y-6">
      {!user.onboarded && <Callout title="Finish setup"><Link className="font-semibold text-brand underline" href="/onboarding">Tell us your experience</Link> and we will skip the material you already know.</Callout>}
      {!user.emailVerifiedAt && (
        <Callout tone="warn" title="Verify your email">
          <div className="space-y-3"><p>Confirm your address so you can recover your account if you ever forget your password. Check your spam folder if the email is missing.</p><SimpleForm action={resendVerification} fields={[]} submitLabel="Resend verification email" /></div>
        </Callout>
      )}

      <header>
        <p className="text-sm font-semibold text-muted">{hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, {user.username}</p>
        <h1 className="text-3xl font-extrabold sm:text-4xl">{reviews.length > 0 ? "Start with your reviews, then move forward" : hero ? "Here is your next step" : "You are caught up"}</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* The one primary action */}
          {hero ? (
            <section aria-labelledby="up-next" className="relative overflow-hidden rounded-[1.5rem] border border-brand/30 bg-gradient-to-br from-brand/[.10] to-surface p-6 shadow-e2 sm:p-8">
              <div aria-hidden="true" className="grid-paper pointer-events-none absolute inset-0 opacity-30" />
              <div className="relative">
                <p id="up-next" className="flex items-center gap-2 text-sm font-bold text-brand"><Icon name="target" size={16} />Learn next<span className="chip">{LEVEL_META[hero.level].label}</span></p>
                <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">{hero.title}</h2>
                <p className="mt-2 text-soft">{mins ? `About ${mins} minutes${isComplete(hero.slug) ? ", with visuals, worked problems and a mastery check" : ""}.` : "Lesson text is on the way."} {hero.prereqs.length > 0 ? `Builds on ${hero.prereqs.length} topic${hero.prereqs.length > 1 ? "s" : ""} you have finished.` : "No prerequisites."}</p>
                <div className="mt-5 flex flex-wrap gap-3"><Link href={`/learn/${hero.slug}`} className="btn btn-primary btn-lg">Open lesson<Icon name="arrowRight" size={18} /></Link>
                  {next.length > 1 && <Link href="/roadmap" className="btn btn-secondary btn-lg">See the roadmap</Link>}</div>
                {next.length > 1 && <p className="mt-4 text-sm text-muted">Also unlocked: {next.slice(1).map((t, i) => <span key={t.slug}>{i > 0 && ", "}<Link className="font-semibold text-soft hover:text-brand" href={`/learn/${t.slug}`}>{t.title}</Link></span>)}</p>}
              </div>
            </section>
          ) : <EmptyState icon="award" title="Every available topic is complete" action={<Link href="/problems" className="btn btn-primary">Keep practising</Link>}>More topics are planned. Until then, problems and contests are the best use of your time.</EmptyState>}

          {/* Reviews */}
          <section aria-labelledby="reviews" className="card card-pad">
            <div className="flex items-center justify-between"><h2 id="reviews" className="text-lg font-extrabold">Review queue</h2>{reviews.length > 0 && <span className="chip chip-warn">{reviews.length} due</span>}</div>
            {reviews.length === 0 ? <p className="mt-2 text-sm text-soft">Nothing due. Finished topics come back on a 1, 3, 7, 14 and 30 day schedule.</p> : (
              <ul className="mt-3 divide-y divide-line">{reviews.map((r) => (
                <li key={r.topicId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <Link className="font-semibold hover:text-brand" href={`/learn/${r.slug}`}>{r.title}</Link>
                  <form action={reviewTopic} className="flex gap-2"><input type="hidden" name="topicId" value={r.topicId} />
                    <SubmitButton name="rating" value="again" className="btn btn-secondary btn-sm">Need review</SubmitButton>
                    <SubmitButton name="rating" value="good" className="btn btn-primary btn-sm">Got it</SubmitButton></form>
                </li>))}</ul>)}
          </section>

          {/* Practice */}
          <section aria-labelledby="practice" className="card card-pad">
            <div className="flex items-center justify-between"><h2 id="practice" className="text-lg font-extrabold">Practice next</h2><Link href="/problems" className="text-sm font-semibold text-brand">All problems</Link></div>
            {practice.length === 0 ? <p className="mt-2 text-sm text-soft">Complete a topic and matching problems show up here, easiest first.</p> : (
              <ul className="mt-3 divide-y divide-line" aria-label="Practice to-do list">{practice.map((p) => {
                // External problems: the title opens the problem on its site in a new tab, and the box marks it solved (the row then leaves this list).
                const external = p.kind === "EXTERNAL";
                const ext = external && p.externalUrl?.startsWith("https://") ? p.externalUrl : null;
                return (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    {external && <SolvedCheckbox problemId={p.id} title={p.title} checked={false} external signedIn />}
                    <div className="min-w-0 flex-1">
                      {ext ? (
                        <a href={ext} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 font-semibold hover:text-brand">
                          <span className="truncate">{p.title}</span><Icon name="external" size={13} className="shrink-0 text-muted" /><span className="sr-only">(opens {p.source} in a new tab)</span>
                        </a>
                      ) : (
                        <Link href={`/problems/${p.slug}`} className="flex min-w-0 items-center gap-1.5 font-semibold hover:text-brand"><span className="truncate">{p.title}</span><Icon name="arrowRight" size={13} className="shrink-0 text-muted" /></Link>
                      )}
                    </div>
                    <span className="flex shrink-0 items-center gap-3"><Difficulty value={p.difficulty} /><span className="hidden sm:inline-flex"><KindBadge kind={p.kind} source={p.source} /></span></span>
                  </li>
                );
              })}</ul>)}
          </section>
        </div>

        {/* Momentum column */}
        <aside className="space-y-6" aria-label="Your momentum">
          <section className="card card-pad" aria-labelledby="streak">
            <div className="flex items-center gap-3">
              <span className={`grid h-11 w-11 place-items-center rounded-2xl ${streak.current > 0 ? "bg-lv4/15 text-lv4" : "bg-sunken text-muted"}`}><Icon name="flame" size={22} /></span>
              <div><h2 id="streak" className="tnum text-2xl font-extrabold leading-none">{streak.current}-day streak</h2><p className="mt-1 text-sm text-soft">{activeToday ? "Today is counted. Nice." : streak.current > 0 ? "Do one thing today to keep it." : "Finish a topic or solve a problem to start one."}</p></div>
            </div>
            <ol className="mt-4 grid grid-cols-7 gap-1.5" aria-label="Activity, last 7 days">
              {week.map((d) => (
                <li key={d.date.toISOString()} className="text-center">
                  <span title={`${d.count} action${d.count === 1 ? "" : "s"}`} className={`mx-auto grid h-9 w-full place-items-center rounded-lg text-xs font-bold ${d.count > 0 ? "bg-brand text-brand-fg" : "bg-sunken text-muted"} ${d.isToday ? "ring-2 ring-brand ring-offset-2 ring-offset-surface" : ""}`}>{d.count > 0 ? <Icon name="check" size={14} strokeWidth={2.6} /> : ""}</span>
                  <span className="mt-1 block text-[11px] font-semibold text-muted">{d.date.toLocaleDateString("en", { weekday: "narrow", timeZone: "UTC" })}</span>
                </li>))}
            </ol>
            <p className="mt-3 text-xs text-muted">Longest streak: {stats.longestStreak} days</p>
          </section>

          <section className="card card-pad" aria-labelledby="path">
            <div className="flex items-center gap-4">
              <Ring value={live.length ? done / live.length : 0} size={72}><span className="tnum text-lg font-extrabold">{done}</span></Ring>
              <div><h2 id="path" className="text-lg font-extrabold">{done} of {live.length} topics</h2><p className="text-sm text-soft">Level {lv.level}, {lv.into} of {lv.needed} XP to the next.</p></div>
            </div>
            <div className="mt-3"><ProgressBar value={lv.into} max={lv.needed} label="Progress to next level" /></div>
            <ul className="mt-5 space-y-2.5">
              {LEVELS.map((l) => { const t = live.filter((x) => x.level === l); if (!t.length) return null; const d = t.filter((x) => completed.has(x.slug)).length;
                return <li key={l} className="flex items-center gap-3 text-sm"><span className="w-24 shrink-0 font-semibold text-soft">{LEVEL_META[l].label}</span><div className="flex-1"><ProgressBar value={d} max={t.length} label={`${LEVEL_META[l].label} progress`} color={`rgb(var(--lv${LEVEL_META[l].n}))`} /></div><span className="tnum w-9 text-right text-xs text-muted">{d}/{t.length}</span></li>; })}
            </ul>
            <div className="mt-6"><LessonTree states={topicStates(completed)} legend /></div>
          </section>

          <section className="card card-pad" aria-labelledby="notebook">
            <h2 id="notebook" className="text-lg font-extrabold">Notebook</h2>
            <p className="mt-1 text-sm text-soft">{stats.mistakes === 0 ? "Log the next mistake you make. Patterns only show up once you write them down." : `${stats.mistakes} mistakes and ${stats.notes} notes so far.`}</p>
            <div className="mt-3 flex gap-2"><Link href="/mistakes" className="btn btn-secondary btn-sm"><Icon name="alert" size={14} />Mistakes</Link><Link href="/notes" className="btn btn-secondary btn-sm"><Icon name="note" size={14} />Notes</Link></div>
          </section>
        </aside>
      </div>
    </div>
  );
}
