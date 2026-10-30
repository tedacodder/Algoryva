import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Callout } from "@/components/ui";
import { LinkTelegramForm } from "@/app/telegram/link/LinkTelegramForm";

export const metadata: Metadata = { title: "Link Telegram" };
export const dynamic = "force-dynamic";

/**
 * Confirmation page for linking Telegram. Nothing happens on page load: the token is read from the URL fragment in the browser
 * and is spent only by the explicit "Confirm link" button, so link previews and prefetchers cannot consume it.
 */
export default async function TelegramLinkPage() {
  const user = await getCurrentUser();
  const link = user ? await db.telegramLink.findUnique({ where: { userId: user.id }, select: { userId: true } }) : null;
  return (
    <div className="page max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Link Telegram</h1>
        <p className="mt-2 text-[15px] text-soft">Connect your Algoryva account to the Algoryva bot so daily challenges, progress and reminders work in Telegram. The bot never asks for your password.</p>
      </header>
      {user ? (
        <section aria-labelledby="link-heading" className="card card-pad space-y-4">
          <h2 id="link-heading" className="text-lg font-bold">Signed in as {user.username}</h2>
          <LinkTelegramForm username={user.username} linked={Boolean(link)} />
        </section>
      ) : (
        <Callout tone="info" title="Sign in to link Telegram">
          <Link href="/login" className="font-semibold underline">Sign in</Link>, then open the link from the bot again. Links work once and expire after 15 minutes.
        </Callout>
      )}
    </div>
  );
}
