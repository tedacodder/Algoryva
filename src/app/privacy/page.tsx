import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "@/components/ui";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/privacy";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <div className="page max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Privacy policy</h1>
        <p className="mt-2 text-[15px] text-soft">Covers the Algoryva website and the Algoryva mobile app. Both use the same account and the same server.</p>
      </header>

      <Callout tone="warn" title="Draft, not yet reviewed">This text was written from what the software stores. It has not been reviewed by a lawyer and the contact address is not set yet. Do not use it as the Google Play privacy policy until both are done.</Callout>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">What we collect</h2>
        <ul className="list-disc space-y-1 pl-5 text-soft">
          <li><strong>Account:</strong> your email address, a username, and a one-way hash of your password (never the password itself).</li>
          <li><strong>Learning data:</strong> topics you completed, review schedule, quiz results, problems you solved, the mistakes and notes you write, revisit reminders, and timestamps of activity used for your streak.</li>
          <li><strong>Sign-in records:</strong> for each signed-in device, a hash of its session token, an expiry date, and a short device label such as &quot;Chrome on Windows&quot;. We use it to sign you in and to warn you about a sign-in from a new device. We do not store your IP address in the account.</li>
          <li><strong>Abuse limits:</strong> sign-in and sign-up attempts are counted per email address and, depending on how the server is set up, per network address, to slow down guessing. These counters are removed periodically.</li>
        </ul>
        <p className="text-soft">We do not run ads and we do not sell personal data. The mobile app keeps lessons and your offline progress on your device until it syncs.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Who handles it</h2>
        <p className="text-soft">The site runs on a hosting provider, stores data in a managed database, and sends account emails (verification, password reset, new sign-in alerts) through an email delivery service. A cache holds public lesson and problem content only, never personal data. These providers process data for us and have their own retention periods.</p>
      </section>

      <section id="data-deletion" className="space-y-2">
        <h2 className="text-xl font-bold">Deleting your data</h2>
        <p className="text-soft">You can delete your account at any time, in the app or on the website, on the <Link href="/delete-account" className="font-semibold underline">account deletion page</Link>. Deletion is permanent and removes your account and learning data. Backups and provider logs can keep copies until they expire on the provider&apos;s schedule.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Security</h2>
        <p className="text-soft">Passwords are hashed. Mobile sign-in uses a random token that the app keeps in the phone&apos;s secure storage, and the server stores only a hash of it. Traffic to the server uses HTTPS.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Contact</h2>
        {PRIVACY_CONTACT_EMAIL
          ? <p className="text-soft">Questions about privacy: <a className="font-semibold underline" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.</p>
          : <p className="text-soft">A privacy contact address has not been published yet.</p>}
      </section>
    </div>
  );
}
