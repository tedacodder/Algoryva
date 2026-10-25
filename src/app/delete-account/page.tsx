import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { Callout } from "@/components/ui";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/privacy";
import { DeleteAccountForm } from "@/app/delete-account/DeleteAccountForm";

export const metadata: Metadata = { title: "Delete your account" };
export const dynamic = "force-dynamic";

export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const done = (await searchParams).done === "1";
  const user = done ? null : await getCurrentUser();
  return (
    <div className="page max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Delete your account</h1>
        <p className="mt-2 text-[15px] text-soft">This page is for the Algoryva website and the Algoryva mobile app. Deleting an account here and deleting it in the app do exactly the same thing.</p>
      </header>

      {done && <Callout tone="ok" title="Your account was deleted">Your account and its data were removed, and you were signed out everywhere. See below for what can remain.</Callout>}

      {!done && (user ? (
        <section aria-labelledby="delete-heading" className="card card-pad space-y-4">
          <h2 id="delete-heading" className="text-lg font-bold">Confirm with your password</h2>
          <DeleteAccountForm />
        </section>
      ) : (
        <Callout tone="info" title="Sign in to delete your account">
          For your security, deletion needs a signed-in session and your password. <Link href="/login" className="font-semibold underline">Sign in</Link>, then come back to this page.
        </Callout>
      ))}

      <section aria-labelledby="what-heading" className="space-y-2">
        <h2 id="what-heading" className="text-xl font-bold">What is deleted</h2>
        <p className="text-soft">Deleting your account permanently removes your sign-in details, your progress, quiz results, solved problems, review schedule, mistake log, notes, revisits and activity, and signs you out on every device, including the mobile app. It cannot be undone.</p>
      </section>

      <section aria-labelledby="remain-heading" className="space-y-2">
        <h2 id="remain-heading" className="text-xl font-bold">What can remain</h2>
        <ul className="list-disc space-y-1 pl-5 text-soft">
          <li>Backups kept by our database host can contain your data until they expire on the host&apos;s own schedule.</li>
          <li>Server logs kept by our hosting provider and the logs of the service that delivers our emails are outside this site&apos;s control.</li>
          <li>Records used only to limit sign-in abuse that are not tied to your account (for example, by network address) are removed periodically, not instantly.</li>
        </ul>
      </section>

      <section aria-labelledby="help-heading" className="space-y-2">
        <h2 id="help-heading" className="text-xl font-bold">Cannot sign in?</h2>
        {PRIVACY_CONTACT_EMAIL
          ? <p className="text-soft">Write to <a className="font-semibold underline" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a> from the email address on the account.</p>
          : <Callout tone="warn" title="Draft: contact address pending">A contact address for deletion requests has not been published yet. This page is a draft and should not be given to Google Play until one is added.</Callout>}
        <p className="text-sm text-muted">See also the <Link href="/privacy" className="underline">privacy policy</Link>.</p>
      </section>
    </div>
  );
}
