import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listRevisits } from "@/lib/revisit-store";
import { reportOutsideRevisit } from "@/app/revisits/actions";
import { ReportForm } from "@/components/revisits/ReportForm";

export const metadata: Metadata = { title: "Revisits", robots: { index: false } };
export const dynamic = "force-dynamic";

type Item = {
  id: string;
  problem: { slug: string; title: string } | null;
  outsideTitle: string | null;
  outsideUrl: string | null;
  dueAt: Date | null;
  passedAt: Date | null;
  passedBy: string | null;
  note: string | null;
};

const titleOf = (i: Item) => i.problem?.title ?? i.outsideTitle ?? "Untitled problem";
const day = (d: Date) => d.toISOString().slice(0, 10);
const idOf = (title: string) => title.replace(/\s+/g, "-").toLowerCase();

function Section({ title, items, empty, detail, extra }: {
  title: string;
  items: Item[];
  empty: string;
  detail: (i: Item) => string;
  extra?: (i: Item) => React.ReactNode;
}) {
  return (
    <section aria-labelledby={idOf(title)} className="card card-pad space-y-4">
      <h2 id={idOf(title)} className="text-lg font-bold">{title} <span className="text-muted">({items.length})</span></h2>
      {items.length === 0 ? <p className="text-sm text-soft">{empty}</p> : (
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {i.problem ? (
                  <Link className="font-semibold text-brand underline" href={`/problems/${i.problem.slug}`}>{titleOf(i)}</Link>
                ) : i.outsideUrl ? (
                  <a className="font-semibold text-brand underline" href={i.outsideUrl} target="_blank" rel="noopener noreferrer">{titleOf(i)} <span className="sr-only">(opens in a new tab)</span></a>
                ) : (
                  <span className="font-semibold">{titleOf(i)}</span>
                )}
                <span className="text-sm text-soft">{detail(i)}</span>
              </div>
              {!i.problem && <p className="text-xs text-muted">Outside the site: you confirm this one yourself.</p>}
              {extra?.(i)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function RevisitsPage() {
  const user = await requireUser();
  const { due, open, passed } = await listRevisits(user.id, new Date());
  const passedText = (i: Item) => (i.passedBy === "judge" ? "Verified by the judge" : "Self-reported") + (i.passedAt ? `, ${day(i.passedAt)}` : "");
  return (
    <div className="page space-y-6">
      <header>
        <p className="text-sm font-semibold text-muted">Practice</p>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Revisits</h1>
        <p className="mt-2 max-w-2xl text-soft">
          Problems you solved only after the editorial or a hint. Solve one again on your own.
          Problems on this site pass once the judge accepts your answer after the due date. The judge checks your output, not your reasoning.
          Outside problems can’t be checked, so you confirm them yourself with a short explanation, and they are marked self-reported.
        </p>
      </header>
      <Section
        title="Due now"
        items={due as Item[]}
        empty="Nothing due. Good work."
        detail={() => "Solve it again to pass"}
        extra={(i) => (i.problem ? null : <ReportForm id={i.id} action={reportOutsideRevisit} />)}
      />
      <Section
        title="Scheduled"
        items={open as Item[]}
        empty="Nothing scheduled."
        detail={(i) => (i.dueAt ? `Next reminder ${day(i.dueAt)}` : "No more reminders. Solve it any time to pass.")}
      />
      <Section title="Passed" items={passed as Item[]} empty="No passed revisits yet." detail={passedText} />
    </div>
  );
}
