import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resendVerification } from "@/app/auth-actions";
import { requireUser } from "@/lib/auth/session";
import { maskEmail } from "@/lib/email-address";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { SimpleForm } from "@/components/SimpleForm";
import { Icon } from "@/components/Icon";
export const metadata: Metadata = { title: "Check your email", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const user = await requireUser();
  if (user.emailVerifiedAt) redirect("/dashboard");
  const delivered = (await searchParams).sent !== "0";
  return (
    <AuthFrame
      title="Check your email"
      lead={delivered ? `We sent a confirmation link to ${maskEmail(user.email)}.` : "We could not send your confirmation email just now."}
    >
      <div className="space-y-6">
        <ol className="space-y-4 text-sm text-soft">
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand">1</span>Open the email from Algoryva.</li>
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand">2</span>Press <strong className="text-fg">Confirm email address</strong>. The link works for 24 hours.</li>
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand">3</span>Not there? Check your spam or promotions folder first.</li>
        </ol>
        <div className="rounded-2xl border border-line p-4">
          <p className="mb-3 text-sm font-semibold">Did not get it?</p>
          <SimpleForm action={resendVerification} fields={[]} submitLabel="Resend confirmation email" />
        </div>
        <p className="flex items-center gap-2 text-sm text-soft">
          <Icon name="route" size={16} />
          <Link href="/onboarding" className="font-bold text-brand underline">Continue setting up your account</Link> while you wait. You can confirm later.
        </p>
      </div>
    </AuthFrame>
  );
}
