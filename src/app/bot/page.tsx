import type { Metadata } from "next";
import { COMMANDS, SECTIONS } from "@/bot-serverless/commands.js";

export const metadata: Metadata = {
  title: "Telegram bot guide · Algoryva",
  description: "Every command of the Algoryva Telegram bot: practice, contests, your account, groups, classes and the leaderboard.",
};

type Command = { name: string; usage: string; summary: string; examples?: string[]; where?: string; admin?: boolean | string; subcommands?: { usage: string; summary: string; admin?: boolean }[]; section: string };

// Light and dark mode: every colour has a dark counterpart, so the guide reads well in either theme.
const MUTED = "text-slate-600 dark:text-slate-400";
const BODY = "text-slate-700 dark:text-slate-300";
const CARD = "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900";
const CODE = "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100";
const PILL = "border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300";

function Badge({ children }: { children: React.ReactNode }) {
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${PILL}`}>{children}</span>;
}

function CommandBlock({ cmd }: { cmd: Command }) {
  return (
    <article id={cmd.name} className={`scroll-mt-24 rounded-xl border p-5 ${CARD}`}>
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-mono text-lg font-semibold text-slate-900 dark:text-slate-100">/{cmd.name}</h3>
        {cmd.where === "group" && <Badge>group chats</Badge>}
        {cmd.admin === true && <Badge>admins only</Badge>}
      </header>
      <p className={`mt-2 ${BODY}`}>{cmd.summary}</p>
      <p className={`mt-3 text-sm ${MUTED}`}>Usage</p>
      <code className={`mt-1 block rounded px-3 py-2 font-mono text-sm ${CODE}`}>{cmd.usage}</code>
      {cmd.subcommands && (
        <div className="mt-4">
          <p className={`text-sm font-medium ${BODY}`}>Subcommands</p>
          <ul className="mt-2 space-y-2">
            {cmd.subcommands.map((sub) => (
              <li key={sub.usage} className="text-sm">
                <code className="font-mono text-slate-900 dark:text-slate-100">{sub.usage}</code>
                {sub.admin && <span className={`ml-2 text-xs ${MUTED}`}>(admin)</span>}
                <span className={`block ${MUTED}`}>{sub.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {cmd.examples && cmd.examples.length > 0 && !cmd.subcommands && (
        <pre className="mt-4 overflow-x-auto rounded bg-slate-900 p-3 text-sm text-slate-100 dark:bg-black">{cmd.examples.join("\n")}</pre>
      )}
    </article>
  );
}

export default function BotGuidePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl space-y-12 px-4 py-10">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">Telegram bot guide</h1>
          <p className={BODY}>
            The Algoryva bot brings Codeforces practice into Telegram: a daily problem, random problems you have not solved, contest
            alerts, and, for groups and classes, a class list, a class report and a live leaderboard. Start a chat with the bot and send
            <code className={`mx-1 rounded px-1 font-mono ${CODE}`}>/start</code>, or type <code className="font-mono">/help</code> for the list.
          </p>
        </header>

        <nav aria-label="Sections" className="flex flex-wrap gap-2 text-sm">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`} className={`rounded-full border px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 ${PILL}`}>
              {section.title}
            </a>
          ))}
          <a href="#roster" className={`rounded-full border px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 ${PILL}`}>👥 The class list</a>
          <a href="#leaderboard" className={`rounded-full border px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 ${PILL}`}>📊 The leaderboard</a>
          <a href="#support" className={`rounded-full border px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 ${PILL}`}>💬 Support</a>
        </nav>

        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24 space-y-5">
            <div>
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <p className={MUTED}>{section.blurb}</p>
            </div>
            {(COMMANDS as Command[]).filter((c) => c.section === section.id).map((cmd) => (
              <CommandBlock key={cmd.name} cmd={cmd} />
            ))}
          </section>
        ))}

        <section id="roster" className="scroll-mt-24 space-y-3">
          <h2 className="text-2xl font-semibold">👥 The class list</h2>
          <p className={BODY}>
            An admin adds students with <code className="font-mono">/roster add</code> or <code className="font-mono">/roster set</code>. The bot
            checks each handle on Codeforces. A real account joins the class and counts as registered, so students do not need{" "}
            <code className="font-mono">/connect</code>. An unknown handle is reported and not stored. Codeforces allows one request every two
            seconds, so a large class is checked over a few minutes: the bot checks as many as it can at once, and a background check
            finishes the rest. <code className="font-mono">/roster list</code> shows the progress.
          </p>
        </section>

        <section id="leaderboard" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-semibold">📊 How the leaderboard works</h2>
          <p className={BODY}>
            <code className="font-mono">/leaderboard</code> ranks the class for a period: this week (7 days), this month (30 days), or all time.
            Each member is measured on three things.
          </p>
          <ul className={`list-disc space-y-2 pl-6 ${BODY}`}>
            <li><b>Solved</b>: the number of different problems with an accepted submission inside the period.</li>
            <li><b>Consistency</b>: the days with at least one accepted solve, as a share of the period. Steady practice counts for more than one long session.</li>
            <li><b>Points</b> = solved + 2 × active days. Ties are broken by consistency, then rating, then handle, so the order is always the same.</li>
          </ul>
          <p className={BODY}>
            The table fills in as the data is checked, and the background check keeps it up to date. Press 🔄 Refresh to update it at once.
            Members who have not joined the class list appear under &quot;not registered&quot;.
          </p>
        </section>

        <section id="support" className="scroll-mt-24 space-y-2">
          <h2 className="text-2xl font-semibold">💬 Support</h2>
          <p className={BODY}>
            Email <a className="underline" href="mailto:Algoryva@gmail.com">Algoryva@gmail.com</a>, and include the command you sent and what the
            bot replied.
          </p>
        </section>
      </div>
    </main>
  );
}
