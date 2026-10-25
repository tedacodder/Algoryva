import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { ALGORITHMS, CATEGORIES, type Algorithm } from "../../lib/visualizer/registry";
import { makeStyles } from "../../lib/ui/theme";
import { withAlpha, type Palette } from "../../lib/ui/palette";
import { Icon } from "../../components/Icon";

/**
 * The Visualizer list, in the style of the web mockup: a header with back and settings, the "Interactive Playground" status line,
 * a search box, category pills, sections with counts, and cards with complexity badges and a play button.
 */
const useStyles = makeStyles((c, f) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, gap: 10, backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.line },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.sunken, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: f.extrabold, fontSize: 26, color: c.fg, letterSpacing: -0.5 },
  status: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.ok },
  statusText: { fontFamily: f.semibold, fontSize: 13, color: c.muted },
  badge: { borderRadius: 999, borderWidth: 1, borderColor: c.tint.brandLine, backgroundColor: c.tint.brand, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontFamily: f.bold, fontSize: 12, color: c.brand },
  search: { minHeight: 46, borderRadius: 16, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.surface, paddingHorizontal: 14, color: c.fg, fontFamily: f.regular, fontSize: 15 },
  pills: { gap: 8, paddingVertical: 2 },
  pill: { borderRadius: 999, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 14, minHeight: 36, justifyContent: "center" },
  pillOn: { backgroundColor: c.brand, borderColor: c.brand },
  pillText: { fontFamily: f.semibold, fontSize: 13, color: c.soft },
  pillTextOn: { color: c.brandFg },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 32, gap: 22 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: f.extrabold, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: c.muted },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.lineStrong },
  sectionCount: { fontFamily: f.semibold, fontSize: 12, color: c.muted },
  card: { backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 16, gap: 10, marginBottom: 12 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  chip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontFamily: f.mono, fontSize: 11, fontWeight: "600" },
  catChip: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  catText: { fontFamily: f.bold, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase" },
  cardTitle: { fontFamily: f.bold, fontSize: 17, color: c.fg, lineHeight: 22, flexShrink: 1 },
  cardText: { fontFamily: f.regular, fontSize: 13.5, lineHeight: 20, color: c.soft },
  play: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: c.tint.brand },
  empty: { fontFamily: f.regular, fontSize: 15, color: c.muted, textAlign: "center", paddingVertical: 30 },
}));

const CAT_KEY: Record<string, string> = { arrays: "Arrays & search", sorting: "Sorting", structures: "Stacks & queues", trees: "Trees & tries", graphs: "Graphs", dp: "Dynamic programming", techniques: "Greedy & backtracking" };

/** Colour for a category, from the theme's level colours, so each group has its own accent. */
function catColor(c: Palette, id: string): string {
  switch (id) {
    case "arrays": return c.brand;
    case "sorting": return c.lv[4];
    case "structures": return c.lv[0];
    case "trees": return c.lv[5];
    case "graphs": return c.ok;
    case "dp": return c.lv[2];
    default: return c.lv[3];
  }
}

/** Badge colour by growth rate: quadratic and worse is red, logarithmic and constant is green, linear is amber. */
function timeColor(c: Palette, t: string): string {
  if (/n²|n\^2|2\^|n!/.test(t)) return c.bad;
  if (/log|1\)|Query O\(1\)|Best O\(n\)/.test(t)) return c.ok;
  return c.warn;
}

export default function VisualizerIndex() {
  const { c, s } = useStyles();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (a: Algorithm) => (q === "" || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q));
    return CATEGORIES
      .filter((cat) => category === "all" || cat.id === category)
      .map((cat) => ({ cat, items: ALGORITHMS.filter((a) => a.category === cat.id && match(a)) }))
      .filter((g) => g.items.length > 0);
  }, [query, category]);

  const total = ALGORITHMS.length;

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <View style={s.headRow}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={s.circle}>
            <Icon name="arrowLeft" size={20} color={c.fg} />
          </Pressable>
          <Text style={s.title} accessibilityRole="header">Visualizer</Text>
          <Pressable onPress={() => router.push("/settings" as never)} accessibilityRole="button" accessibilityLabel="Settings" style={s.circle}>
            <Icon name="menu" size={20} color={c.soft} />
          </Pressable>
        </View>
        <View style={s.status}>
          <View style={s.statusLeft}>
            <View style={s.dot} />
            <Text style={s.statusText}>Interactive playground</Text>
          </View>
          <View style={s.badge}><Text style={s.badgeText}>{`${total} algorithms`}</Text></View>
        </View>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search algorithms, pointers, sort…" placeholderTextColor={c.muted} accessibilityLabel="Search algorithms" style={s.search} autoCorrect={false} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pills}>
          {[{ id: "all", label: "All" }, ...CATEGORIES.map((cat) => ({ id: cat.id, label: CAT_KEY[cat.id] ?? cat.label }))].map((p) => {
            const on = category === p.id;
            return (
              <Pressable key={p.id} onPress={() => setCategory(p.id)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={p.label} style={[s.pill, on && s.pillOn]}>
                <Text style={[s.pillText, on && s.pillTextOn]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={s.content}>
        {groups.length === 0 ? <Text style={s.empty}>No algorithms match. Try another word.</Text> : null}
        {groups.map(({ cat, items }) => {
          const accent = catColor(c, cat.id);
          return (
            <View key={cat.id} style={{ gap: 4 }}>
              <View style={[s.sectionHead, { marginBottom: 12 }]} accessibilityRole="header">
                <Text style={s.sectionTitle}>{cat.label}</Text>
                <View style={s.sectionDot} />
                <Text style={s.sectionCount}>{`${items.length} ${items.length === 1 ? "topic" : "topics"}`}</Text>
              </View>
              {items.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => router.push(`/visualizer/${a.id}` as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${a.title}. ${a.summary}. Time ${a.complexity.time}`}
                  style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
                >
                  <View style={s.chips}>
                    <View style={[s.catChip, { borderColor: withAlpha(accent, 0.4), backgroundColor: withAlpha(accent, 0.12) }]}>
                      <Text style={[s.catText, { color: accent }]}>{CAT_KEY[cat.id] ?? cat.label}</Text>
                    </View>
                    <View style={[s.chip, { backgroundColor: withAlpha(timeColor(c, a.complexity.time), 0.12) }]}>
                      <Text style={[s.chipText, { color: timeColor(c, a.complexity.time) }]}>{`O(${a.complexity.time.replace(/^O\(|\)$/g, "")})`}</Text>
                    </View>
                    <View style={[s.chip, { backgroundColor: c.sunken }]}>
                      <Text style={[s.chipText, { color: c.muted }]}>{`space ${a.complexity.space.replace(/^O\(|\)$/g, "")}`}</Text>
                    </View>
                  </View>
                  <View style={s.cardTop}>
                    <Text style={s.cardTitle}>{a.title}</Text>
                    <View style={s.play}><Icon name="play" size={16} color={c.brand} /></View>
                  </View>
                  <Text style={s.cardText} numberOfLines={3}>{a.summary}</Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
