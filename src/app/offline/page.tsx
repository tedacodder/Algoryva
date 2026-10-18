import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

export default function OfflinePage() {
  return (
    <main className="page grid min-h-[60dvh] place-items-center text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-3xl font-extrabold">You are offline</h1>
        <p className="text-soft">Algoryva needs a connection to load lessons and check answers. Your progress is saved on the server, so nothing you have done is lost.</p>
        <Link href="/" className="btn btn-primary btn-lg">Try again</Link>
      </div>
    </main>
  );
}
