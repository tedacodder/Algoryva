import { useMemo } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";
import type { GraphFrame } from "../../lib/viz/steps";
import { makeStyles } from "../../lib/ui/theme";
import type { Palette } from "../../lib/ui/palette";

/** Node states, per theme: waiting (amber), current (blue), finished (green), hit (violet). */
function nodeColors(c: Palette, state: string | undefined) {
  const dark = c.mode === "dark";
  switch (state) {
    case "queued": return { fill: dark ? "#78350F" : "#FEF3C7", stroke: c.warn };
    case "cur": return { fill: dark ? "#0C4A6E" : "#E0F2FE", stroke: c.brand };
    case "done": return { fill: dark ? "#14532D" : "#DCFCE7", stroke: c.ok };
    case "hit": return { fill: dark ? "#4C1D95" : "#EDE9FE", stroke: dark ? "#A78BFA" : "#7C3AED" };
    default: return { fill: c.surface, stroke: c.lineStrong };
  }
}

const useStyles = makeStyles((c, f) => ({
  wrap: { gap: 10 },
  structure: { gap: 6 },
  structureLabel: { fontFamily: f.bold, color: c.muted, fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase" },
  chips: { flexDirection: "row", gap: 6 },
  chip: { fontFamily: f.mono, color: c.fg, backgroundColor: c.tint.brand, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  empty: { fontFamily: f.regular, color: c.muted, fontSize: 13 },
  order: { fontFamily: f.regular, color: c.muted, fontSize: 13 },
  key: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  keyItem: { fontFamily: f.bold, fontSize: 12 },
}));

/**
 * Draws a graph or tree frame. The website uses a fixed 300-unit viewBox; here node positions are scaled to the screen width while
 * keeping their proportions, so the layout matches the web version.
 */
export function GraphStage({ f }: { f: GraphFrame }) {
  const { c, s } = useStyles();
  const { width: screen } = useWindowDimensions();
  const drawWidth = Math.min(screen - 48, 420);

  const layout = useMemo(() => {
    const xs = f.nodes.map((n) => n.x);
    const ys = f.nodes.map((n) => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 28;
    const spanX = Math.max(1, maxX - minX), spanY = Math.max(1, maxY - minY);
    const scale = Math.min((drawWidth - pad * 2) / spanX, 1.6);
    const height = Math.max(160, spanY * scale + pad * 2 + 40);
    const place = (x: number, y: number) => ({ x: pad + (x - minX) * scale + ((drawWidth - pad * 2) - spanX * scale) / 2, y: pad + (y - minY) * scale });
    const pos = new Map(f.nodes.map((n) => [n.id, place(n.x, n.y)]));
    return { height, pos, pill: f.nodes.some((n) => (n.label ?? n.id).length > 2) };
  }, [f, drawWidth]);

  const seen = f.nodes.filter((n) => f.state[n.id]).map((n) => `${n.label ?? n.id} ${f.state[n.id]}`).join(", ");
  const summary = `Graph. ${seen || "No node reached yet"}. ${f.structure.label}: ${f.structure.items.join(", ") || "empty"}`;
  const r = layout.pill ? 14 : 16;

  return (
    <View style={s.wrap}>
      <Svg width={drawWidth} height={layout.height} accessibilityLabel={summary}>
        {f.edges.map((e) => {
          const a = layout.pos.get(e.a), b = layout.pos.get(e.b);
          if (!a || !b) return null;
          const lit = f.state[e.a] && f.state[e.b];
          const stroke = e.mark === "pick" ? c.brand : e.mark === "cur" ? c.warn : lit ? c.brand : c.line;
          const width = e.mark === "pick" ? 3.4 : e.mark === "cur" ? 3 : lit ? 2.2 : 1.6;
          return (
            <Line key={`${e.a}-${e.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={width} strokeDasharray={e.mark === "skip" ? "4 3" : undefined} opacity={e.mark === "skip" ? 0.4 : 1} />
          );
        })}
        {f.edges.map((e) => {
          if (e.w === undefined) return null;
          const a = layout.pos.get(e.a), b = layout.pos.get(e.b);
          if (!a || !b) return null;
          return (
            <SvgText key={`w-${e.a}-${e.b}`} x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle" fontSize={11} fontWeight="700" fill={c.fg}>
              {String(e.w)}
            </SvgText>
          );
        })}
        {f.nodes.map((n) => {
          const p = layout.pos.get(n.id);
          if (!p) return null;
          const st = f.state[n.id];
          const { fill, stroke } = nodeColors(c, st);
          const label = n.label ?? n.id;
          return (
            <G key={n.id} opacity={!st && layout.pill ? 0.45 : 1}>
              {layout.pill ? (
                <Rect x={p.x - 24} y={p.y - 12} width={48} height={24} rx={12} fill={fill} stroke={stroke} strokeWidth={2} />
              ) : (
                <Circle cx={p.x} cy={p.y} r={r} fill={fill} stroke={stroke} strokeWidth={2.2} />
              )}
              <SvgText x={p.x} y={p.y + 4} textAnchor="middle" fontSize={layout.pill ? 11 : 13} fontWeight="700" fill={c.fg}>{label}</SvgText>
              {f.text[n.id] ? (
                <SvgText x={p.x} y={p.y + (layout.pill ? 26 : 30)} textAnchor="middle" fontSize={11} fontWeight="700" fill={c.muted}>{f.text[n.id]}</SvgText>
              ) : null}
            </G>
          );
        })}
      </Svg>

      <View style={s.structure}>
        <Text style={s.structureLabel}>{f.structure.label}</Text>
        {f.structure.items.length === 0 ? (
          <Text style={s.empty}>empty</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.chips}>
              {f.structure.items.map((it, k) => (
                <Text key={`${it}-${k}`} style={s.chip}>{it}</Text>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
      {f.order.length > 0 ? <Text style={s.order}>{`Visited in order: ${f.order.join("  ")}`}</Text> : null}
      <View style={s.key} accessibilityLabel="Colour key: amber is waiting, blue is current, green is finished">
        <Text style={[s.keyItem, { color: c.warn }]}>● waiting</Text>
        <Text style={[s.keyItem, { color: c.brand }]}>● current</Text>
        <Text style={[s.keyItem, { color: c.ok }]}>● finished</Text>
      </View>
    </View>
  );
}
