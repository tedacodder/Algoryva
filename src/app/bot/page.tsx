import type { Metadata } from "next";
import { COMMANDS, SECTIONS } from "@/bot-serverless/commands.js";

export const metadata: Metadata = {
  title: "Telegram bot guide · Algoryva",
  description: "Every command of the Algoryva Telegram bot: practice, contests, your account, groups, classes and the leaderboard.",
};

type Command = { name: string; usage: string; summary: string; examples?: string[]; where?: string; admin?: boolean | string; subcommands?: { usage: string; summary: string; admin?: boolean }[] };

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600">{children}</span>;
}

function CommandBlock({ cmd }: { cmd: Command }) {
  return (
    <article id={cmd.name} className="scroll-mt-24 rounded-xl border border-slate-200 p-5">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-mono text-lg font-semibold">/{cmd.name}</h3>
        {cmd.where === "group" && <Badge>group chats</Badge>}
        {cmd.admin === true && <Badge>admins only</Badge>}
      </header>
      <p className="mt-2 text-slate-700">{cmd.summary}</p>
      <p className="mt-3 text-sm text-slate-500">Usage</p>
      <code className="mt-1 block rounded bg-slate-100 px-3 py-2 font-mono text-sm">{cmd.usage}</code>
      {cmd.subcommands && (
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700">Subcommands</p>
          <ul className="mt-2 space-y-2">
            {cmd.subcommands.map((sub) => (
              <li key={sub.usage} className="text-sm">
                <code className="font-mono">{sub.usage}</code>
                {sub.admin && <span className="ml-2 text-xs text-slate-500">(admin)</span>}
                <span className="block text-slate-600">{sub.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {cmd.examples && cmd.examples.length > 0 && !cmd.subcommands && (
        <pre className="mt-4 overflow-x-auto rounded bg-slate-900 p-3 text-sm text-slate-100">{cmd.examples.join("\n")}</pre>
      )}
    </article>
  );
}

export default function BotGuidePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-12 px-4 py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">Telegram bot guide</h1>
        <p className="text-slate-700">
          The Algoryva bot brings Codeforces practice into Telegram: a daily problem, random problems you have not solved, contest
          alerts, and, for groups and classes, a roster, a class report and a leaderboard. Start a chat with the bot and send
          <code className="mx-1 font-mono">/start</code>, or type <code className="font-mono">/help</code> for the list.
        </p>
      </header>

      <nav aria-label="Sections" className="flex flex-wrap gap-2 text-sm">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="rounded-full border border-slate-300 px-3 py-1 hover:bg-slate-100">
            {section.title}
          </a>
        ))}
        <a href="#leaderboard" className="rounded-full border border-slate-300 px-3 py-1 hover:bg-slate-100">
          📊 How the leaderboard works
        </a>
      </nav>

      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-24 space-y-5">
          <div>
            <h2 className="text-2xl font-semibold">{section.title}</h2>
            <p className="text-slate-600">{section.blurb}</p>
          </div>
          {(COMMANDS as Command[])
            .filter((c) => (c as unknown as { section: string }).section === section.id)
            .map((cmd) => (
              <CommandBlock key={cmd.name} cmd={cmd} />
            ))}
        </section>
      ))}

      <section id="roster" className="scroll-mt-24 space-y-3">
        <h2 className="text-2xl font-semibold">👥 How the class list works</h2>
        <p className="text-slate-700">
          When a group admin adds handles with <code className="font-mono">/roster add</code> or <code className="font-mono">/roster set</code>,
          the bot checks each one on Codeforces. A real account is added to the class and counts as registered, so students do not need
          to run <code className="font-mono">/connect</code> separately. A handle Codeforces does not know is reported and not stored. A
          handle beyond the checks of one request is reported as not checked yet. Send those again to check them.
        </p>
      </section>

      <section id="support" className="scroll-mt-24 space-y-2">
        <h2 className="text-2xl font-semibold">💬 Support</h2>
        <p className="text-slate-700">
          Email <a className="underline" href="mailto:Algoryva@gmail.com">Algoryva@gmail.com</a>, and include the command you sent and what the
          bot replied.
        </p>
      </section>

      <section id="leaderboard" className="scroll-mt-24 space-y-4">
        <h2 className="text-2xl font-semibold">📊 How the leaderboard works</h2>
        <p className="text-slate-700">
          <code className="font-mono">/leaderboard</code> ranks the group&apos;s members for a period: this week (7 days), this month
          (30 days), or all time. Each member is measured on three things.
        </p>
        <ul className="list-disc space-y-2 pl-6 text-slate-700">
          <li>
            <b>Solved</b>: the number of different problems with an accepted submission inside the period.
          </li>
          <li>
            <b>Days</b> and <b>Cons</b> (consistency): the days with at least one accepted solve, and that number as a share of the
            period. Steady practice counts for more than one long session.
          </li>
          <li>
            <b>Score</b> = solved + 2 × active days. Ties are broken by consistency, then rating, then handle, so the order is always
            the same.
          </li>
        </ul>
        <p className="text-slate-700">
          Codeforces allows only a few checks per second, so a refresh checks a batch of students. The table shows who is still being
          checked, and pressing <b>🔄 Refresh</b> continues. Members who have not connected a handle appear under &quot;not registered&quot;.
        </p>
      </section>
    </main>
  );
}
