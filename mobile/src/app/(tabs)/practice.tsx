import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { getDatabase } from "../../lib/db/open";
import { loadProblems } from "../../lib/content/repository";
import { loadSolvedIds } from "../../lib/learner/queries";
import { useLoad } from "../../lib/hooks/useLoad";
import { platformOf } from "../../lib/practice/platform";
import { makeStyles, MIN_TOUCH } from "../../lib/ui/theme";
import { Chip, Empty, Tag } from "../../components/common/Controls";
import { Icon } from "../../components/Icon";

/** Practice, as on the website: Algoryva problems (judged here) and curated links to LeetCode, Codeforces and HackerRank. */
const useStyles = makeStyles((c, f) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  title: { fontFamily: f.extrabold, fontSize: 28, color: c.fg, letterSpacing: -0.5 },
  lead: { fontFamily: f.regular, fontSize: 14.5, lineHeight: 21, color: c.soft },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 6 },
  row: { minHeight: MIN_TOUCH + 12, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14, gap: 6, justifyContent: "center" },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  rowTitle: { fontFamily: f.bold, fontSize: 16, color: c.fg, flex: 1 },
  rowMeta: { fontFamily: f.regular, fontSize: 13, color: c.muted },
  solved: { flexDirection: "row", alignItems: "center", gap: 6 },
  error: { fontFamily: f.regular, color: c.bad, padding: 20 },
}));

type Filter = "all" | "algoryva" | "LeetCode" | "Codeforces" | "HackerRank";

export default function PracticeTab() {
  const { c, s } = useStyles();
  const [filter, setFilter] = useState<Filter>("all");
  const data = useLoad(async () => {
    const db = await getDatabase();
    const [problems, solved] = await Promise.all([loadProblems(db), loadSolvedIds(db)]);
    return { problems, solved: [...solved] };
  }, "practice");

  const rows = useMemo(() => {
    if (!data.data) return [];
    return data.data.problems.filter((p) => {
      if (filter === "all") return true;
      if (filter === "algoryva") return p.kind === "INTERNAL";
      return platformOf(p.externalUrl)?.name === filter;
    });
  }, [data.data, filter]);

  if (data.loading) return <Text style={s.error}>Loading…</Text>;
  if (data.error || !data.data) return <Text style={s.error} accessibilityRole="alert">{data.error ?? "Could not load the problems."}</Text>;
  const solvedSet = new Set(data.data.solved);
  const count = (f: Filter) => (f === "all" ? data.data!.problems.length : f === "algoryva" ? data.data!.problems.filter((p) => p.kind === "INTERNAL").length : data.data!.problems.filter((p) => platformOf(p.externalUrl)?.name === f).length);

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={s.content}
      data={rows}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={
        <View style={{ gap: 6 }}>
          <Text style={s.title} accessibilityRole="header">Practice</Text>
          <Text style={s.lead}>Solve Algoryva problems here, where the answer is checked. Curated problems on LeetCode, Codeforces and HackerRank open on their own site, and you mark them solved here.</Text>
          <View style={s.filters}>
            {(["all", "algoryva", "LeetCode", "Codeforces", "HackerRank"] as Filter[]).map((f) => (
              <Chip key={f} label={`${f === "all" ? "All" : f === "algoryva" ? "Algoryva" : f} (${count(f)})`} selected={filter === f} onPress={() => setFilter(f)} />
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        data.data.problems.length === 0 ? (
          <Empty title="No problems downloaded yet" text="Connect to the internet and restart the app. Problems are downloaded with the lessons." />
        ) : (
          <Empty title="No problems here" text="Try another filter." />
        )
      }
      renderItem={({ item }) => {
        const platform = item.kind === "EXTERNAL" ? platformOf(item.externalUrl) : null;
        const isSolved = solvedSet.has(item.id);
        return (
          <Link href={`/problems/${item.slug}` as never} asChild>
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.difficulty.toLowerCase()}${platform ? `, on ${platform.name}` : ""}${isSolved ? ", solved" : ""}`} style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}>
              <View style={s.rowTop}>
                <Text style={s.rowTitle}>{item.title}</Text>
                <Tag label={item.difficulty.toLowerCase()} tone="brand" />
              </View>
              <View style={s.solved}>
                {isSolved ? <Icon name="check" size={14} color={c.ok} /> : null}
                <Text style={s.rowMeta}>{platform ? `Opens on ${platform.name}` : "Checked here"}{isSolved ? " · solved" : ""}</Text>
                {platform ? <Icon name="arrowUpRight" size={14} color={c.muted} /> : null}
              </View>
            </Pressable>
          </Link>
        );
      }}
    />
  );
}
