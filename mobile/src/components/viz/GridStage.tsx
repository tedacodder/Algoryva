import { ScrollView, Text, View } from "react-native";
import type { GridFrame } from "../../lib/viz/steps";
import { makeStyles } from "../../lib/ui/theme";

const CELL_W = 56, CELL_H = 38, LABEL_W = 66;

const useStyles = makeStyles((c, f) => ({
  row: { flexDirection: "row" },
  head: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.line, backgroundColor: c.sunken },
  headText: { fontFamily: f.mono, color: c.muted, fontSize: 12 },
  cell: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
  dep: { borderColor: c.ok, borderWidth: 2 },
  active: { backgroundColor: c.tint.brand, borderColor: c.brand, borderWidth: 2 },
  cellText: { fontFamily: f.mono, color: c.fg, fontSize: 13 },
  activeText: { fontFamily: f.bold, color: c.fg },
}));

/** A DP or backtracking table in the website's style. The active cell is highlighted; dependency cells get a green border. */
export function GridStage({ f }: { f: GridFrame }) {
  const { c, s } = useStyles();
  const depSet = new Set((f.deps ?? []).map(([r, col]) => `${r},${col}`));
  const [ar, ac] = f.active ?? [-1, -1];
  const summary = `Table with ${f.rowLabels.length} rows and ${f.colLabels.length} columns. ${f.note}`;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel={summary}>
      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <View>
          <View style={s.row}>
            <View style={[s.head, { width: LABEL_W, height: CELL_H, borderWidth: 0, backgroundColor: c.bg }]} />
            {f.colLabels.map((col, j) => (
              <View key={`c${j}`} style={[s.head, { width: CELL_W, height: CELL_H }]}>
                <Text style={s.headText} numberOfLines={1}>{String(col)}</Text>
              </View>
            ))}
          </View>
          {f.cells.map((cells, i) => (
            <View key={`r${i}`} style={s.row}>
              <View style={[s.head, { width: LABEL_W, height: CELL_H }]}>
                <Text style={s.headText} numberOfLines={1}>{String(f.rowLabels[i] ?? "")}</Text>
              </View>
              {cells.map((v, j) => {
                const isActive = i === ar && j === ac;
                const isDep = depSet.has(`${i},${j}`);
                return (
                  <View
                    key={`${i}-${j}`}
                    accessibilityLabel={v === null ? "empty" : `${String(f.rowLabels[i] ?? "")} ${String(f.colLabels[j] ?? "")} equals ${String(v)}`}
                    style={[s.cell, { width: CELL_W, height: CELL_H }, isDep && s.dep, isActive && s.active]}
                  >
                    <Text style={[s.cellText, isActive && s.activeText]} numberOfLines={1}>{v === null ? "" : String(v)}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
}
