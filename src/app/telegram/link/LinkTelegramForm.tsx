"use client";
import { useActionState, useEffect, useState } from "react";
import { confirmTelegramLink, unlinkTelegram, type LinkState } from "@/app/telegram/link/actions";

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/**
 * Reads the one-time token from the URL fragment (never sent to the server by the browser), posts it as a form field, and then
 * removes it from the address bar so it stays out of history.
 */
export function LinkTelegramForm({ username, linked }: { username: string; linked: boolean }) {
  const [token, setToken] = useState("");
  const [confirm, confirmAction, confirming] = useActionState<LinkState, FormData>(confirmTelegramLink, undefined);
  const [unlink, unlinkAction, unlinking] = useActionState<LinkState, FormData>(async () => unlinkTelegram(), undefined);

  useEffect(() => {
    const fromHash = window.location.hash.replace(/^#/, "");
    if (TOKEN_RE.test(fromHash)) setToken(fromHash);
    if (fromHash) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <div className="space-y-6">
      {token && !confirm?.ok && (
        <form action={confirmAction} className="space-y-3">
          <input type="hidden" name="token" value={token} />
          <p className="text-soft">Link the Telegram account that asked for this link to <strong>{username}</strong>? The link works once.</p>
          <button type="submit" className="btn btn-primary" disabled={confirming}>{confirming ? "Linking…" : "Confirm link"}</button>
        </form>
      )}
      {!token && !linked && !confirm?.ok && (
        <p className="text-soft">To link Telegram, open the link the bot sent you. It works once and expires after 15 minutes. Signed out? Sign in first, then open the link again.</p>
      )}
      {confirm && <p role="status" className={confirm.ok ? "font-semibold" : "font-semibold text-bad"}>{confirm.message}</p>}

      {linked && (
        <form action={unlinkAction} className="space-y-3">
          <p className="text-soft">Telegram is linked to this account. Disconnecting stops the bot from recognising that chat. You can link again later.</p>
          <button type="submit" className="btn btn-secondary" disabled={unlinking}>{unlinking ? "Disconnecting…" : "Disconnect Telegram"}</button>
          {unlink && <p role="status" className="font-semibold">{unlink.message}</p>}
        </form>
      )}
    </div>
  );
}
