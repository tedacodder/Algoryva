import { ScrollView, Text, View } from "react-native";
import type { Aux, Frame } from "../../lib/viz/steps";
import { makeStyles } from "../../lib/ui/theme";
import { markStyle } from "./types";

const CELL = 46;

const useStyles = makeStyles((c, f) => ({
  rowBlock: { marginBottom: 10, gap: 4 },
  rowInner: { gap: 6, paddingVertical: 2 },
  auxLabel: { fontFamily: f.bold, color: c.muted, fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase" },
  cellWrap: { alignItems: "center" },
  markText: { fontFamily: f.bold, color: c.warn, fontSize: 10, minHeight: 12, textAlign: "center" },
  cell: { width: "100%", borderWidth: 2, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 2, backgroundColor: c.surface },
  value: { fontFamily: f.mono, color: c.fg, fontSize: 16 },
  valueSmall: { fontSize: 13 },
  index: { fontFamily: f.regular, color: c.muted, fontSize: 10, marginTop: 2 },
  structure: { marginTop: 6, gap: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { fontFamily: f.mono, color: c.fg, backgroundColor: c.tint.brand, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  empty: { fontFamily: f.regular, color: c.muted, fontSize: 13 },
}));

function Row({ values, marks, dim, label, small }: { values: (number | string)[]; marks: Frame["marks"]; dim?: Set<number>; label?: string; small?: boolean }) {
  const { c, s } = useStyles();
  const size = small ? CELL - 12 : CELL;
  return (
    <View style={s.rowBlock}>
      {label ? <Text style={s.auxLabel}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.rowInner}>
        {values.map((v, i) => {
          const labels = marks[i];
          const style = markStyle(c, labels && labels.length ? labels[labels.length - 1] : undefined);
          const hasMark = labels && labels.length > 0;
          const faded = dim?.has(i) === true && !hasMark;
          return (
            <View key={i} style={[s.cellWrap, { width: size }]}>
              <Text style={s.markText} numberOfLines={1}>{labels ? labels.join(" ") : " "}</Text>
              <View style={[s.cell, { height: size, borderColor: hasMark ? style.border : c.lineStrong, backgroundColor: hasMark ? style.bg : c.surface, opacity: faded ? 0.35 : 1 }]}>
                <Text style={[s.value, small && s.valueSmall]} numberOfLines={1} adjustsFontSizeToFit>{String(v)}</Text>
              </View>
              <Text style={s.index}>{String(i)}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function ArrayStage({ f }: { f: Frame }) {
  const { s } = useStyles();
  const dim = f.dim ? new Set(f.dim) : undefined;
  const summary = [
    `Array ${f.values.join(", ")}`,
    ...(f.aux ?? []).map((a: Aux) => `${a.label}: ${a.values.join(", ")}`),
    ...(f.structure ? [`${f.structure.label}: ${f.structure.items.join(", ") || "empty"}`] : []),
  ].join(". ");
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary}>
      <Row values={f.values} marks={f.marks} dim={dim} />
      {(f.aux ?? []).map((a) => (
        <Row key={a.label} label={a.label} values={a.values} marks={a.marks} small />
      ))}
      {f.structure ? (
        <View style={s.structure}>
          <Text style={s.auxLabel}>{f.structure.label}</Text>
          {f.structure.items.length === 0 ? (
            <Text style={s.empty}>empty</Text>
          ) : (
            <View style={s.chips}>
              {f.structure.items.map((it, k) => (
                <Text key={`${it}-${k}`} style={s.chip}>{it}</Text>
              ))}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}
