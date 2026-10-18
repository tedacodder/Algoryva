import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cancelEmailChange, requestEmailChange, setRevisitEmails } from "@/app/account-actions";
import { resendVerification } from "@/app/auth-actions";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { maskEmail } from "@/lib/email-address";
import { Callout } from "@/components/ui";
import { SimpleForm } from "@/components/SimpleForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = { title: "Account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const row = await db.user.findUnique({ where: { id: user.id }, select: { email: true, pendingEmail: true, emailVerifiedAt: true, revisitEmails: true } });
  if (!row) redirect("/login");

  return (
    <div className="page space-y-6">
      <header>
        <p className="text-sm font-semibold text-muted">Settings</p>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Account</h1>
      </header>

      <section aria-labelledby="current-email" className="card card-pad space-y-4">
        <h2 id="current-email" className="text-lg font-bold">Sign-in email</h2>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{row.email}</span>
          {row.emailVerifiedAt
            ? <span className="chip text-ok"><Icon name="check" size={13} />Confirmed</span>
            : <span className="chip text-warn"><Icon name="alert" size={13} />Not confirmed yet</span>}
        </p>
        {!row.emailVerifiedAt && (
          <div className="rounded-2xl border border-line p-4">
            <p className="mb-3 text-sm text-soft">Confirm this address so we can recover your account if you forget your password.</p>
            <SimpleForm action={resendVerification} fields={[]} submitLabel="Resend confirmation email" />
          </div>
        )}
      </section>

      {row.pendingEmail && (
        <Callout tone="warn" title="Email change pending">
          <div className="space-y-3">
            <p>We are waiting for you to confirm <strong>{maskEmail(row.pendingEmail)}</strong>. Your sign-in email stays the same until then. Check that inbox and spam folder.</p>
            <form action={cancelEmailChange}>
              <SubmitButton className="btn btn-secondary btn-sm" pendingLabel="Cancelling">Cancel this change</SubmitButton>
            </form>
          </div>
        </Callout>
      )}

      <section aria-labelledby="change-email" className="card card-pad space-y-4">
        <h2 id="change-email" className="text-lg font-bold">Change email address</h2>
        <p className="text-sm text-soft">
          We will send a confirmation link to the new address and a security notice to your current one. Your address changes only after you confirm the new one.
        </p>
        <SimpleForm
          action={requestEmailChange}
          fields={[
            { name: "email", label: "New email address", type: "email", autoComplete: "email" },
            { name: "password", label: "Current password", type: "password", autoComplete: "current-password" },
          ]}
          submitLabel="Send confirmation link"
        />
      </section>

      <section aria-labelledby="reminders" className="card card-pad space-y-4">
        <h2 id="reminders" className="text-lg font-bold">Revisit reminders</h2>
        <p className="text-sm text-soft">At most one email a day, and only when problems are due for review.</p>
        <form action={setRevisitEmails} className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="on" defaultChecked={row.revisitEmails} className="h-4 w-4" />
            Email me revisit reminders
          </label>
          <SubmitButton className="btn btn-secondary btn-sm" pendingLabel="Saving">Save</SubmitButton>
        </form>
      </section>
    </div>
  );
}
