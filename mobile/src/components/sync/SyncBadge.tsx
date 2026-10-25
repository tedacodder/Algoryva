import { Pressable, Text, View } from "react-native";
import { useEngineStatus } from "../../lib/sync/useEngineStatus";
import { makeStyles, MIN_TOUCH } from "../../lib/ui/theme";
import { getRuntime } from "../../lib/sync/runtime";

const LABEL: Record<string, string> = {
  guest: "Not signed in. Progress stays on this device.",
  synced: "Synced",
  pending: "changes waiting to sync",
  syncing: "Syncing…",
  offline: "Offline. Changes are saved.",
  error: "Sync problem",
};

/** Shows what the sync is doing, in words, with a retry when something needs one. Used on the home screen and the account screen. */
export function SyncBadge({ onPress }: { onPress?: () => void }) {
  const { c, s } = useStyles();
  const st = useEngineStatus();
  const text = st.state === "pending" ? `${st.pending} ${st.pending === 1 ? "change" : "changes"} waiting to sync`
    : st.state === "error" ? (st.message ?? LABEL.error)
    : st.state === "offline" ? LABEL.offline
    : LABEL[st.state] ?? "";
  const tone = st.state === "error" ? c.bad : st.state === "offline" || st.state === "pending" ? c.warn : st.state === "synced" ? c.ok : c.muted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Sync status: ${text}. Tap to sync now.`}
      style={s.row}
    >
      <View style={[s.dot, { backgroundColor: tone }]} />
      <Text style={[s.text, { color: tone }]}>{text}</Text>
      {st.state === "error" ? <Text style={s.retry} onPress={() => void getRuntime().engine.run()}>Retry</Text> : null}
    </Pressable>
  );
}

const useStyles = makeStyles((c, f) => ({
  row: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { fontSize: 14, fontFamily: f.semibold, flex: 1 },
  retry: { color: c.brand, fontFamily: f.bold, paddingHorizontal: 8 },
}));
