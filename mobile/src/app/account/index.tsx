import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ApiError, NetworkError } from "../../lib/api/client";
import { isSignedIn, subscribeSession } from "../../lib/auth/session";
import { getRuntime } from "../../lib/sync/runtime";
import { SyncBadge } from "../../components/sync/SyncBadge";
import { useEngineStatus } from "../../lib/sync/useEngineStatus";
import { makeStyles, MIN_TOUCH } from "../../lib/ui/theme";
import { countPending } from "../../lib/learner/snapshot";
import { getDatabase } from "../../lib/db/open";
import { Card, H, P } from "../../components/common/Ui";
import type { AuthOutcome } from "../../lib/account/account";

type Mode = "signin" | "register";

function explain(e: unknown): string {
  if (e instanceof NetworkError) return e.message;
  if (e instanceof ApiError) return e.message;
  return "Something went wrong. Try again.";
}

/** Account screen: sign in or create an account, sync status, sign out, and delete the account. Signing in never merges silently. */
export default function AccountScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { s } = useStyles();
  const [signedIn, setSignedIn] = useState(isSignedIn());
  useEffect(() => subscribeSession(() => setSignedIn(isSignedIn())), []);
  const status = useEngineStatus();
  const [choice, setChoice] = useState<Extract<AuthOutcome, { kind: "choose" }> | null>(null);
  const [mode, setMode] = useState<Mode>(params.mode === "register" ? "register" : "signin");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    void getDatabase().then((db) => countPending(db)).then(setPendingCount);
  }, [status.pending, signedIn]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    // Checked before any request is sent, and shown as they are (not through the generic error text below).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMessage("Enter a valid email address.");
    if (mode === "register" && password.length < 10) return setMessage("Use a password of at least 10 characters.");
    await run(async () => {
    const acc = getRuntime().account;
    const out = mode === "signin"
      ? await acc.signIn({ email: email.trim(), password })
      : await acc.register({ email: email.trim(), username: username.trim(), password });
    setPassword("");
    if (out.kind === "choose") setChoice(out);
    else setMessage("Signed in. Your progress is syncing.");
    });
  };

  const resolve = (c: "combine" | "account") => run(async () => {
    await getRuntime().account.chooseLink(c);
    setChoice(null);
    setMessage(c === "combine" ? "Your device's changes will be sent to your account." : "Your account&apos;s progress is now on this device.");
  });

  const signOut = (discard: boolean) => run(async () => {
    const r = await getRuntime().account.signOut({ discardPending: discard });
    setMessage(r.kind === "signed-out" ? "Signed out." : `${r.pending} changes are not synced yet.`);
  });

  const deleteAccount = () => run(async () => {
    await getRuntime().account.deleteAccount(deletePassword);
    setDeletePassword("");
    setMessage("Your account and its data were deleted from the server and from this device.");
  });

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {message ? <Text style={s.notice} accessibilityLiveRegion="polite">{message}</Text> : null}

      {choice ? (
        <Card>
          <H level={2}>Your account already has progress</H>
          <P>{`This device has ${choice.pending} ${choice.pending === 1 ? "change" : "changes"} that are not synced yet, and your account also has progress.`}</P>
          <P>Combine them to send this device&apos;s changes to your account, or use your account and discard the unsynced changes on this device.</P>
          <Btn label="Combine both" onPress={() => resolve("combine")} primary disabled={busy} />
          <Btn label="Use my account and discard unsynced changes" onPress={() => resolve("account")} disabled={busy} />
        </Card>
      ) : null}

      {!signedIn ? (
        <Card>
          <H level={2}>{mode === "signin" ? "Sign in" : "Create an account"}</H>
          <P>You can keep learning without an account. Sign in to back up your progress and use it on other devices.</P>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          {mode === "register" ? <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" /> : null}
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <Btn label={mode === "signin" ? "Sign in" : "Create account"} onPress={submit} primary disabled={busy || !email || !password} />
          <Btn
            label={mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
            onPress={() => setMode(mode === "signin" ? "register" : "signin")}
          />
        </Card>
      ) : (
        <>
          <Card>
            <H level={2}>Sync</H>
            <SyncBadge onPress={() => void run(() => getRuntime().engine.run())} />
            {status.lastSyncedAt ? <Text style={s.meta}>Last synced {new Date(status.lastSyncedAt).toLocaleString()}</Text> : null}
            {status.issues.length > 0 ? (
              <>
                <Text style={s.warn}>Some changes were not accepted by the server:</Text>
                {status.issues.slice(0, 5).map((i, k) => <Text key={k} style={s.meta}>• {i.reason}</Text>)}
                <Btn label="Dismiss" onPress={() => getRuntime().engine.dismissIssues()} />
              </>
            ) : null}
            <Btn label="Sync now" onPress={() => void run(() => getRuntime().engine.run())} primary disabled={busy} />
          </Card>

          <Card>
            <H level={2}>Sign out</H>
            {pendingCount > 0 ? (
              <>
                <P>{`${pendingCount} ${pendingCount === 1 ? "change is" : "changes are"} not synced yet.`}</P>
                <Btn label="Sign out and keep these changes on this device" onPress={() => signOut(false)} disabled={busy} />
                <Btn label="Discard unsynced changes and sign out" onPress={() => signOut(true)} disabled={busy} />
              </>
            ) : (
              <Btn label="Sign out" onPress={() => signOut(false)} disabled={busy} />
            )}
          </Card>

          <Card>
            <H level={2}>Delete account</H>
            <P>This deletes your account and all its progress on the server and removes it from this device. It cannot be undone.</P>
            <Field label="Your password" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry />
            <Btn label="Delete my account permanently" onPress={deleteAccount} disabled={busy || !deletePassword} danger />
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function Field(props: { label: string; value: string; onChangeText: (t: string) => void; keyboardType?: "email-address"; autoCapitalize?: "none"; secureTextEntry?: boolean }) {
  const { c, s } = useStyles();
  return (
    <View style={s.field}>
      <Text style={s.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize}
        autoCorrect={false}
        secureTextEntry={props.secureTextEntry}
        accessibilityLabel={props.label}
        placeholderTextColor={c.muted}
        style={s.input}
      />
    </View>
  );
}

function Btn({ label, onPress, primary, danger, disabled }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  const { c, s } = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled === true }}
      style={({ pressed }) => [s.btn, primary && s.btnPrimary, danger && s.btnDanger, (disabled || pressed) && { opacity: 0.55 }]}
    >
      <Text style={[s.btnText, primary && { color: c.brandFg }, danger && { color: c.fg }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c, f) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  notice: { color: c.fg, backgroundColor: c.surface, borderRadius: 10, padding: 12, fontSize: 15, lineHeight: 22 },
  warn: { color: c.warn, fontFamily: f.bold },
  meta: { color: c.muted, fontSize: 14, lineHeight: 20 },
  field: { gap: 4 },
  label: { color: c.muted, fontSize: 13, fontFamily: f.bold },
  input: { minHeight: MIN_TOUCH, borderRadius: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.sunken, color: c.fg, paddingHorizontal: 12, fontSize: 16 },
  btn: { minHeight: MIN_TOUCH, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.sunken, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: c.brand, borderColor: c.brand },
  btnDanger: { backgroundColor: c.surface, borderColor: c.tint.badLine },
  btnText: { color: c.fg, fontFamily: f.bold, fontSize: 15, textAlign: "center" },
}));
