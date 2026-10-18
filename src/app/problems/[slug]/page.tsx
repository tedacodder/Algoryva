import { problemDetail } from "@/lib/content";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { Difficulty, KindBadge } from "@/components/ProblemBadge";
import { toggleSolved } from "@/app/problems/actions";
import { JudgeForm } from "@/components/JudgeForm";
import { isComplete } from "@/content/lessons-v2";
import { SubmitButton } from "@/components/SubmitButton";
import { Callout } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

const load = (slug: string) => problemDetail(slug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: (await load((await params).slug))?.title ?? "Problem" };
}

const Block = ({ title, children }: { title: string; children: string }) => (
  <section className="mt-7"><h2 className="text-lg font-extrabold">{title}</h2><p className="prose-lesson mt-1.5 whitespace-pre-wrap">{children}</p></section>
);
const Io = ({ label, text }: { label: string; text: string }) => (
  <div className="min-w-0"><div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted"><span>{label}</span><CopyButton text={text} /></div>
    <pre className="code-block overflow-x-auto p-3 text-[13px] leading-relaxed" tabIndex={0}>{text}</pre></div>
);

export default async function ProblemPage({ params }: Props) {
  const p = await load((await params).slug);
  if (!p) notFound();
  const user = await getCurrentUser();
  const [isSolvedRow, testCount, related] = await Promise.all([
    user ? db.problemSolve.findUnique({ where: { userId_problemId: { userId: user.id, problemId: p.id } } }) : null,
    db.testCase.count({ where: { problemId: p.id } }),
    db.problem.findMany({ where: { status: "PUBLISHED", id: { not: p.id }, topics: { some: { topic: { slug: { in: p.topics.map((t) => t.topic.slug) } } } } }, orderBy: [{ difficulty: "asc" }, { position: "asc" }], take: 4, select: { id: true, slug: true, title: true, difficulty: true, kind: true, source: true } }),
  ]);
  const isSolved = !!isSolvedRow;
  const external = p.kind === "EXTERNAL" && p.externalUrl;

  const statement = (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2.5"><Difficulty value={p.difficulty} /><KindBadge kind={p.kind} source={p.source} />{isSolved && <span className="chip chip-ok animate-pop"><Icon name="check" size={12} strokeWidth={2.6} />Solved</span>}</div>
      <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{p.title}</h1>
      <p className="mt-2 flex flex-wrap gap-2">{p.topics.map((t) => <Link key={t.topic.slug} className="chip hover:border-brand hover:text-brand" href={`/learn/${t.topic.slug}`}>{t.topic.title}</Link>)}</p>
      {!external && <>
        <Block title="Statement">{p.statement ?? ""}</Block>
        {p.inputSpec && <Block title="Input">{p.inputSpec}</Block>}
        {p.outputSpec && <Block title="Output">{p.outputSpec}</Block>}
        {p.constraints && <section className="mt-7"><h2 className="text-lg font-extrabold">Constraints</h2><pre className="well mt-1.5 whitespace-pre-wrap p-4 font-mono text-[13.5px] leading-relaxed">{p.constraints}</pre></section>}
        {(p.timeLimitMs || p.memoryLimitMb) && <p className="mt-3 flex gap-4 text-xs font-semibold text-muted">{p.timeLimitMs && <span className="inline-flex items-center gap-1"><Icon name="timer" size={13} />{p.timeLimitMs} ms</span>}{p.memoryLimitMb && <span>{p.memoryLimitMb} MB</span>}</p>}
        {p.testCases.map((t, i) => (
          <section key={t.id} className="mt-7"><h2 className="text-lg font-extrabold">Example {i + 1}</h2>
            <div className="mt-2 grid gap-3 sm:grid-cols-2"><Io label="Input" text={t.input} /><Io label="Output" text={t.expected} /></div>
            {t.explanation && <p className="mt-2 text-sm text-soft">{t.explanation}</p>}</section>))}
      </>}
    </div>
  );

  const side = (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit" aria-label="Solve">
      {external ? (
        <div className="card card-pad">
          <h2 className="text-lg font-extrabold">Solve it on {p.source}</h2>
          <p className="mt-1 text-sm text-soft">The statement lives there. Solve it, then come back and mark it solved to keep your progress honest.</p>
          <a href={p.externalUrl!} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg mt-4 w-full">Open on {p.source}<Icon name="external" size={16} /></a>
        </div>
      ) : (
        <div className="card card-pad">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold"><Icon name="code" size={18} className="text-brand" />Check your answer</h2>
          {testCount > 0 ? (user ? <JudgeForm problemId={p.id} sampleCount={testCount} help={p.topics.map((t) => ({ title: t.topic.title, slug: t.topic.slug, complete: isComplete(t.topic.slug) }))} /> : <Callout>Log in to check your output against the tests. <Link className="font-bold text-brand" href="/login">Log in</Link></Callout>)
            : <Callout>No tests are attached yet. Mark it solved yourself once you are confident.</Callout>}
        </div>
      )}
      <div className="card card-pad">
        {user ? (
          <form action={toggleSolved} className="space-y-3"><input type="hidden" name="problemId" value={p.id} />
            {external || isSolved ? (
              <SubmitButton className={`btn w-full ${isSolved ? "btn-secondary" : "btn-primary"}`} pendingLabel="Saving">{isSolved ? "Mark as unsolved" : "Mark as solved"}</SubmitButton>
            ) : (
              <p className="text-sm text-soft">{testCount > 0 ? "Marked solved automatically when every test passes in Check your answer." : "This needs tests before it can be marked solved."}</p>
            )}
            <Link href={`/mistakes?problem=${p.id}`} className="btn btn-quiet btn-sm w-full"><Icon name="alert" size={14} />Log a mistake on this problem</Link>
          </form>
        ) : <p className="text-sm text-soft"><Link className="font-bold text-brand" href="/login">Log in</Link> to track solved problems.</p>}
      </div>
      {related.length > 0 && (
        <div className="card card-pad"><h2 className="text-sm font-extrabold">More on these topics</h2>
          <ul className="mt-2 divide-y divide-line">{related.map((r) => <li key={r.id}><Link href={`/problems/${r.slug}`} className="flex items-center justify-between gap-2 py-2.5 text-sm font-semibold hover:text-brand"><span className="truncate">{r.title}</span><Difficulty value={r.difficulty} /></Link></li>)}</ul></div>)}
    </aside>
  );

  return (
    <div className="page-wide">
      <Link href="/problems" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg"><Icon name="arrowLeft" size={14} />All problems</Link>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_28rem]">{statement}{side}</div>
    </div>
  );
}
