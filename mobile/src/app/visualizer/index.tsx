import { Link } from "expo-router";
import { ScrollView, Text, Pressable, View } from "react-native";
import { ALGORITHMS, CATEGORIES } from "../../lib/visualizer/registry";
import { makeStyles, MIN_TOUCH } from "../../lib/ui/theme";

/** Interactive algorithms, grouped as the website groups them. Each opens a screen where you can change the input and step through. */
export default function VisualizerIndex() {
  const { s } = useStyles();
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {CATEGORIES.map((c) => {
        const items = ALGORITHMS.filter((a) => a.category === c.id);
        if (items.length === 0) return null;
        return (
          <View key={c.id} style={s.group}>
            <Text style={s.groupTitle} accessibilityRole="header">{c.label}</Text>
            {items.map((a) => (
              <Link key={a.id} href={`/visualizer/${a.id}` as never} asChild>
                <Pressable accessibilityRole="button" accessibilityLabel={`${a.title}. ${a.summary}`} style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}>
                  <Text style={s.rowTitle}>{a.title}</Text>
                  <Text style={s.rowSummary} numberOfLines={2}>{a.summary}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((c, f) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  group: { gap: 8 },
  groupTitle: { color: c.muted, fontSize: 13, fontFamily: f.bold, textTransform: "uppercase" },
  row: { minHeight: MIN_TOUCH + 8, backgroundColor: c.surface, borderRadius: 12, padding: 14, gap: 4, justifyContent: "center" },
  rowTitle: { color: c.fg, fontSize: 16, fontFamily: f.bold },
  rowSummary: { color: c.muted, fontSize: 13, lineHeight: 18 },
}));
