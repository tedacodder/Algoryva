import { Link } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { getDatabase } from "../../lib/db/open";
import { loadProblems } from "../../lib/content/repository";
import { useLoad } from "../../lib/hooks/useLoad";
import { makeStyles, MIN_TOUCH } from "../../lib/ui/theme";

export default function ProblemsIndex() {
  const { s } = useStyles();
  const problems = useLoad(async () => loadProblems(await getDatabase()), "problems");
  if (problems.loading) return <Text style={s.muted}>Loading…</Text>;
  if (problems.error) return <Text style={s.error} accessibilityRole="alert">{problems.error}</Text>;
  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={s.content}
      data={problems.data ?? []}
      keyExtractor={(p) => p.id}
      ListEmptyComponent={<Text style={s.muted}>No problems yet.</Text>}
      renderItem={({ item }) => (
        <Link href={`/problems/${item.slug}` as never} asChild>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.difficulty.toLowerCase()}`} style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}>
            <View style={s.rowTop}>
              <Text style={s.rowTitle}>{item.title}</Text>
              <Text style={s.badge}>{item.difficulty.toLowerCase()}</Text>
            </View>
            <Text style={s.rowMeta}>{item.kind === "EXTERNAL" ? "Solved on an external site" : "Checked on the site"}</Text>
          </Pressable>
        </Link>
      )}
    />
  );
}

const useStyles = makeStyles((c, f) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, gap: 10 },
  row: { minHeight: MIN_TOUCH + 8, backgroundColor: c.surface, borderRadius: 12, padding: 14, gap: 4, justifyContent: "center" },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  rowTitle: { color: c.fg, fontSize: 17, fontFamily: f.bold, flex: 1 },
  rowMeta: { color: c.muted, fontSize: 13 },
  badge: { color: c.brand, fontSize: 13, fontFamily: f.bold, textTransform: "capitalize" },
  muted: { color: c.muted, padding: 20 },
  error: { color: c.bad, padding: 20 },
}));
