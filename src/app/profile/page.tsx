import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getStreak, getWeekActivity } from "@/lib/activity";
import { getStats } from "@/lib/stats";
import { BADGES, computeXp, levelFor } from "@/lib/gamification";
import { LEVELS, TOPICS } from "@/lib/curriculum";
import { LEVEL_META } from "@/lib/levels";
import { getCompletedSlugs } from "@/lib/progress";
import { Ring, ProgressBar, Stat } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

const BADGE_ICON: Record<string, IconName> = { "first-topic": "book", "first-solve": "check", "ten-solves": "code", "hard-solve": "bolt", "week-streak": "flame", "ten-topics": "layers", reviewer: "refresh", reflective: "pencil" };

export default async function Profile() {
  const user = await requireUser();
  const [row, stats, streak, completed, week] = await Promise.all([db.user.findUnique({ where: { id: user.id }, select: { createdAt: true, preferredLanguage: true } }), getStats(user.id), getStreak(user.id), getCompletedSlugs(user.id), getWeekActivity(user.id)]);
  const xp = computeXp(stats), lv = levelFor(xp);
  const solved = stats.solvedEasy + stats.solvedMedium + stats.solvedHard;
  const live = TOPICS.filter((t) => t.status === "PUBLISHED");
  const earned = BADGES.filter((b) => b.earned(stats)).length;
  const mix = [["Easy", stats.solvedEasy, "rgb(var(--ok))"], ["Medium", stats.solvedMedium, "rgb(var(--warn))"], ["Hard", stats.solvedHard, "rgb(var(--bad))"]] as const;
  const maxMix = Math.max(1, ...mix.map((m) => m[1]));

  return (
    <div className="page space-y-6">
      <header className="card card-pad flex flex-wrap items-center gap-6">
        <Link href="/account" className="btn btn-secondary btn-sm ml-auto">Account settings</Link>
        <Ring value={lv.needed ? lv.into / lv.needed : 0} size={104} stroke={9}><span className="text-center"><span className="block text-xs font-semibold text-muted">Level</span><span className="tnum block text-3xl font-extrabold leading-none">{lv.level}</span></span></Ring>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-extrabold sm:text-4xl">{user.username}</h1>
          <p className="mt-1 text-sm text-soft">Member since {row?.createdAt.toISOString().slice(0, 10)}, learning in {row?.preferredLanguage}.</p>
          <p className="tnum mt-3 text-sm font-semibold">{xp} XP <span className="font-medium text-muted">({lv.needed - lv.into} to level {lv.level + 1})</span></p>
          <div className="mt-2 max-w-md"><ProgressBar value={lv.into} max={lv.needed} label="Progress to next level" /></div>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon="book" label="Topics" value={`${completed.size}/${live.length}`} hint="completed" />
        <Stat icon="code" label="Problems solved" value={solved} />
        <Stat icon="flame" label="Current streak" value={`${streak.current}d`} hint={`Longest ${streak.longest}d`} />
        <Stat icon="award" label="Badges" value={`${earned}/${BADGES.length}`} />
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card card-pad" aria-labelledby="mastery">
          <h2 id="mastery" className="text-lg font-extrabold">Where you are on the roadmap</h2>
          <ul className="mt-4 space-y-3">{LEVELS.map((l) => { const t = live.filter((x) => x.level === l); if (!t.length) return null; const d = t.filter((x) => completed.has(x.slug)).length;
            return <li key={l}><div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{LEVEL_META[l].label}</span><span className="tnum text-muted">{d} of {t.length}</span></div><ProgressBar value={d} max={t.length} label={`${LEVEL_META[l].label} progress`} color={`rgb(var(--lv${LEVEL_META[l].n}))`} /></li>; })}</ul>
        </section>
        <section className="card card-pad" aria-labelledby="mix">
          <h2 id="mix" className="text-lg font-extrabold">What you have solved</h2>
          {solved === 0 ? <p className="mt-2 text-sm text-soft">Solve your first problem and this fills in.</p> : (
            <ul className="mt-4 space-y-3">{mix.map(([n, v, c]) => <li key={n} className="flex items-center gap-3 text-sm"><span className="w-16 font-semibold">{n}</span><span className="bar flex-1"><span style={{ width: `${(v / maxMix) * 100}%`, background: c }} /></span><span className="tnum w-6 text-right font-bold">{v}</span></li>)}</ul>)}
          <p className="mt-5 text-sm text-soft">Last 7 days: <strong className="tnum text-fg">{week.reduce((n, d) => n + d.count, 0)}</strong> actions across <strong className="tnum text-fg">{week.filter((d) => d.count > 0).length}</strong> days.</p>
        </section>
      </div>

      <section aria-labelledby="badges">
        <h2 id="badges" className="mb-3 text-lg font-extrabold">Badges</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{BADGES.map((b) => { const on = b.earned(stats); return (
          <li key={b.id} className={`card flex items-center gap-3 p-4 ${on ? "border-brand/40" : "opacity-70"}`}>
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${on ? "bg-brand text-brand-fg" : "bg-sunken text-muted"}`}><Icon name={on ? BADGE_ICON[b.id] ?? "award" : "lock"} size={20} /></span>
            <span className="min-w-0"><span className="block font-bold">{b.name}</span><span className="block text-xs text-soft">{b.description}</span><span className="sr-only">{on ? "Earned" : "Not earned yet"}</span></span></li>); })}</ul>
      </section>
    </div>
  );
}
