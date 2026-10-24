import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { getDatabase } from "../../lib/db/open";
import { loadTopics } from "../../lib/content/repository";
import { loadDueRevisits, loadDueTopicReviews, loadMistakes, loadProgressMap, loadSolvedIds } from "../../lib/learner/queries";
import { completedSlugs } from "../../lib/learner/apply";
import { nextTopic } from "../../lib/rules/next";
import { LEVEL_META, LEVEL_ORDER } from "../../lib/rules/levels";
import { useLoad } from "../../lib/hooks/useLoad";
import { getRuntime } from "../../lib/sync/runtime";
import { makeStyles } from "../../lib/ui/theme";
import { Brand } from "../../components/common/Brand";
import { Button, ProgressBar, Tag } from "../../components/common/Controls";
import { Icon, type IconName } from "../../components/Icon";
import { SyncBadge } from "../../components/sync/SyncBadge";

/**
 * The home dashboard, laid out as the website's dashboard: header, greeting, mastery and solved counts, what is next, reviews due,
 * the six levels, and the tools. Every number comes from this phone's data (the same data the website shows once you sync).
 */
const useStyles = makeStyles((c, f) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.surface, marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
  kicker: { fontFamily: f.bold, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: c.brand },
  greet: { fontFamily: f.extrabold, fontSize: 26, lineHeight: 32, color: c.fg, letterSpacing: -0.5 },
  lead: { fontFamily: f.regular, fontSize: 14.5, lineHeight: 22, color: c.soft },
  grid: { flexDirection: "row", gap: 10 },
  metric: { flex: 1, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 14, gap: 6 },
  metricLabel: { fontFamily: f.bold, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: c.muted },
  metricValue: { fontFamily: f.extrabold, fontSize: 26, color: c.fg },
  metricSub: { fontFamily: f.semibold, fontSize: 12, color: c.brand },
  card: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 16, gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontFamily: f.extrabold, fontSize: 18, color: c.fg },
  unitLabel: { fontFamily: f.bold, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: c.muted },
  unitTitle: { fontFamily: f.extrabold, fontSize: 20, color: c.fg, lineHeight: 26 },
  row2: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: c.bad, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { fontFamily: f.extrabold, fontSize: 12, color: c.brandFg },
  reviewRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.sunken, borderRadius: 12, padding: 12 },
  reviewTitle: { fontFamily: f.bold, fontSize: 14.5, color: c.fg },
  reviewMeta: { fontFamily: f.regular, fontSize: 12, color: c.muted },
  levelRow: { gap: 6 },
  levelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  levelName: { fontFamily: f.bold, fontSize: 14, color: c.fg },
  levelCount: { fontFamily: f.semibold, fontSize: 12, color: c.muted },
  tools: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tool: { width: "48%", backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 14, gap: 8, minHeight: 96 },
  toolLabel: { fontFamily: f.bold, fontSize: 14.5, color: c.fg },
  toolSub: { fontFamily: f.regular, fontSize: 12, color: c.muted, lineHeight: 17 },
  error: { fontFamily: f.regular, color: c.bad, padding: 20 },
}));

type Level = { level: string; name: string; n: number; done: number; total: number };

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const { c, s } = useStyles();
  const data = useLoad(async () => {
    const db = await getDatabase();
    const now = new Date();
    const iso = now.toISOString();
    const [topics, done, , solved, mistakes, dueTopics, dueRevisits] = await Promise.all([
      loadTopics(db), completedSlugs(db), loadProgressMap(db), loadSolvedIds(db), loadMistakes(db),
      loadDueTopicReviews(db, iso), loadDueRevisits(db, iso),
    ]);
    const published = topics.filter((t) => t.status === "PUBLISHED");
    const next = nextTopic(topics, done);
    const levels: Level[] = LEVEL_ORDER.map((lv) => {
      const inLevel = published.filter((t) => t.level === lv);
      return { level: lv, name: LEVEL_META[lv]?.label ?? lv, n: LEVEL_META[lv]?.n ?? 1, done: inLevel.filter((t) => done.has(t.slug)).length, total: inLevel.length };
    }).filter((l) => l.total > 0);
    return {
      total: published.length,
      done: published.filter((t) => done.has(t.slug)).length,
      solved: solved.size,
      mistakes: mistakes.length,
      next: next ? { slug: next.slug, title: next.title, level: next.level } : null,
      dueTopics,
      dueRevisits,
      levels,
    };
  }, "dashboard");

  const reload = data.reload;
  useEffect(() => getRuntime().engine.subscribe(() => reload()), [reload]);

  if (data.loading) return <Text style={s.error}>Loading…</Text>;
  if (data.error || !data.data) return <Text style={s.error} accessibilityRole="alert">{data.error ?? "Could not load the dashboard."}</Text>;
  const d = data.data;
  const dueCount = d.dueTopics.length + d.dueRevisits.length;
  const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
  const nextLevel = d.next ? LEVEL_META[d.next.level] : null;
  const nextLevelColor = nextLevel ? c.lv[nextLevel.n - 1] : c.brand;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Brand size="sm" />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <SyncBadge />
          <Pressable onPress={() => router.push("/reviews" as never)} accessibilityRole="button" accessibilityLabel={`Reviews: ${dueCount} due`} style={s.iconBtn}>
            <Icon name="clock" size={20} color={c.fg} />
          </Pressable>
          <Pressable onPress={() => router.push("/profile" as never)} accessibilityRole="button" accessibilityLabel="Profile" style={s.avatar}>
            <Icon name="user" size={18} color={c.brandFg} />
          </Pressable>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={s.kicker}>Algoryva Track</Text>
        <Text style={s.greet} accessibilityRole="header">{`${greeting(new Date())}`}</Text>
        <Text style={s.lead}>{d.next ? `Next up: ${d.next.title}. Read it, check yourself, then mark it complete.` : "You have finished every available topic. Practise problems or review what you learned."}</Text>
      </View>

      <View style={s.grid}>
        <View style={s.metric} accessibilityLabel={`Mastery: ${d.done} of ${d.total} topics`}>
          <View style={s.cardTop}>
            <Text style={s.metricLabel}>Mastery</Text>
            <Icon name="award" size={18} color={c.brand} />
          </View>
          <Text style={s.metricValue}>{`${d.done}`}<Text style={s.metricSub}>{` / ${d.total}`}</Text></Text>
          <ProgressBar value={d.done} max={d.total} label="Topics completed" />
          <Text style={s.metricSub}>{`${pct}% of the curriculum`}</Text>
        </View>
        <View style={s.metric} accessibilityLabel={`Solved: ${d.solved} problems`}>
          <View style={s.cardTop}>
            <Text style={s.metricLabel}>Solved</Text>
            <Icon name="check" size={18} color={c.ok} />
          </View>
          <Text style={s.metricValue}>{`${d.solved}`}</Text>
          <Text style={s.metricSub}>{d.mistakes > 0 ? `${d.mistakes} mistakes logged` : "Problems you have solved"}</Text>
        </View>
      </View>

      {d.next ? (
        <View style={s.card} accessibilityLabel={`Up next: ${d.next.title}`}>
          <View style={s.cardTop}>
            <Tag label={nextLevel?.label ?? d.next.level} tone="brand" />
            <Tag label="Prerequisites met" tone="ok" />
          </View>
          <View style={{ gap: 4 }}>
            <Text style={s.unitLabel}>Up next</Text>
            <Text style={s.unitTitle}>{d.next.title}</Text>
          </View>
          <View style={s.row2}>
            <View style={s.flex}><Button label="Start lesson" variant="primary" icon="play" onPress={() => router.push(`/learn/${d.next!.slug}` as never)} /></View>
            <View style={s.flex}><Button label="Quiz" onPress={() => router.push("/quiz" as never)} /></View>
          </View>
          <View style={{ height: 3, borderRadius: 2, backgroundColor: nextLevelColor, width: 48 }} />
        </View>
      ) : null}

      <View style={s.card}>
        <View style={s.cardTop}>
          <Text style={s.cardTitle}>Reviews due</Text>
          {dueCount > 0 ? <View style={s.badge}><Text style={s.badgeText}>{String(dueCount)}</Text></View> : null}
        </View>
        {dueCount === 0 ? (
          <Text style={s.reviewMeta}>Nothing is due today. Reviews come back on a 1, 3, 7, 14 and 30 day schedule.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {d.dueTopics.slice(0, 3).map((t) => (
              <View key={`t-${t.slug}`} style={s.reviewRow}>
                <Icon name="refresh" size={18} color={c.brand} />
                <View style={s.flex}>
                  <Text style={s.reviewTitle}>{t.title}</Text>
                  <Text style={s.reviewMeta}>{`Review ${t.step + 1} of the schedule`}</Text>
                </View>
              </View>
            ))}
            {d.dueRevisits.slice(0, Math.max(0, 3 - d.dueTopics.length)).map((r) => (
              <View key={`r-${r.id}`} style={s.reviewRow}>
                <Icon name="target" size={18} color={c.warn} />
                <View style={s.flex}>
                  <Text style={s.reviewTitle}>{r.problemTitle ?? r.outsideTitle ?? "A problem to revisit"}</Text>
                  <Text style={s.reviewMeta}>Revisit</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        <Button label={dueCount > 0 ? `Start reviews (${dueCount})` : "Open reviews"} variant="primary" onPress={() => router.push("/reviews" as never)} />
      </View>

      <View style={s.card}>
        <View style={s.cardTop}>
          <Text style={s.cardTitle}>Six levels, cool to hot</Text>
          <Icon name="layers" size={18} color={c.brand} />
        </View>
        {d.levels.map((l) => (
          <View key={l.level} style={s.levelRow}>
            <View style={s.levelHead}>
              <Text style={s.levelName}>{l.name}</Text>
              <Text style={s.levelCount}>{`${l.done} of ${l.total}`}</Text>
            </View>
            <ProgressBar value={l.done} max={l.total} label={`${l.name} progress`} />
          </View>
        ))}
        <Button label="Open the curriculum" onPress={() => router.push("/learn" as never)} />
      </View>

      <Text style={[s.kicker, { marginTop: 4 }]}>Tools</Text>
      <View style={s.tools}>
        <ToolTile icon="note" label="Mistakes" sub={d.mistakes > 0 ? `${d.mistakes} logged` : "Log what went wrong"} href="/mistakes" />
        <ToolTile icon="edit" label="Notes" sub="Your notes" href="/notes" />
        <ToolTile icon="play" label="Python Runner" sub="Write and run Python offline" href="/python/runner" />
        <ToolTile icon="menu" label="Settings" sub="Appearance, privacy, data" href="/settings" />
      </View>
    </ScrollView>
  );
}

function ToolTile({ icon, label, sub, href }: { icon: IconName; label: string; sub: string; href: string }) {
  const { c, s } = useStyles();
  return (
    <Pressable onPress={() => router.push(href as never)} accessibilityRole="button" accessibilityLabel={`${label}: ${sub}`} style={s.tool}>
      <Icon name={icon} size={22} color={c.brand} />
      <Text style={s.toolLabel}>{label}</Text>
      <Text style={s.toolSub}>{sub}</Text>
    </Pressable>
  );
}
