import type { Metadata } from "next";
import Link from "next/link";
import { confirmEmail } from "@/app/auth-actions";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { SimpleForm } from "@/components/SimpleForm";
import { Icon } from "@/components/Icon";
export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };
export const dynamic = "force-dynamic";

/*
 * The link only opens this page. Nothing is changed until the user presses the button, which submits the token to
 * confirmEmail. That matters because mail scanners and link previews open links automatically, and a GET that consumed
 * the one-time token would confirm the account before the person ever clicked.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; done?: string; kind?: string }> }) {
  const { token = "", done, kind } = await searchParams;
  const change = kind === "change";

  if (done === "change") {
    return (
      <AuthFrame title="Email address updated" lead="Your Algoryva account now uses this address for sign-in and recovery.">
        <span className="mb-6 grid h-14 w-14 place-items-center rounded-full bg-ok text-white animate-pop"><Icon name="check" size={26} strokeWidth={2.4} /></span>
        <Link href="/account" className="btn btn-primary btn-lg w-full">Back to account<Icon name="arrowRight" size={18} /></Link>
      </AuthFrame>
    );
  }

  if (done === "1") {
    return (
      <AuthFrame title="Email confirmed" lead="Thanks. Your address is confirmed, and we can help you recover your account if you ever need to.">
        <span className="mb-6 grid h-14 w-14 place-items-center rounded-full bg-ok text-white animate-pop"><Icon name="check" size={26} strokeWidth={2.4} /></span>
        <Link href="/dashboard" className="btn btn-primary btn-lg w-full">Go to dashboard<Icon name="arrowRight" size={18} /></Link>
      </AuthFrame>
    );
  }

  if (!token) {
    return (
      <AuthFrame title="This link is incomplete" lead="Open the most recent Algoryva email and use the link in it, or log in to request a new one.">
        <Link href="/login" className="btn btn-primary btn-lg w-full">Log in</Link>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title={change ? "Confirm your new email" : "Confirm your email"}
      lead={change ? "Press the button to switch your Algoryva account to this address." : "Press the button to confirm this address for your Algoryva account."}
    >
      <SimpleForm
        action={confirmEmail}
        fields={[{ name: "token", label: "", hidden: token }, { name: "kind", label: "", hidden: change ? "change" : "verify" }]}
        submitLabel={change ? "Switch to this address" : "Confirm email address"}
      />
    </AuthFrame>
  );
}
