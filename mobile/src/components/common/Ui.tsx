import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { makeStyles } from "../../lib/ui/theme";
import { tokenize } from "../../lib/highlight";
import { Icon, type IconName } from "../Icon";

/**
 * Text and code in the website's style: .prose-lesson, .inline-code, .code-block, .table-clean and .card.
 * Text sizes follow the system font scale because they are set in points, and the layout wraps.
 */
const useStyles = makeStyles((c, f) => ({
  h1: { fontFamily: f.extrabold, fontSize: 28, lineHeight: 34, color: c.fg, letterSpacing: -0.5 },
  h2: { fontFamily: f.extrabold, fontSize: 22, lineHeight: 28, color: c.fg, letterSpacing: -0.3, marginTop: 6 },
  h3: { fontFamily: f.bold, fontSize: 17, lineHeight: 23, color: c.fg, marginTop: 4 },
  p: { fontFamily: f.regular, fontSize: 16.5, lineHeight: 28, color: c.fg },
  list: { gap: 8 },
  bulletRow: { flexDirection: "row", gap: 10 },
  bulletDot: { color: c.muted, fontSize: 16, lineHeight: 26, width: 10 },
  bulletText: { flex: 1, fontFamily: f.regular, fontSize: 16, lineHeight: 26, color: c.soft },
  inlineCode: { fontFamily: f.mono, fontSize: 14, color: c.fg, backgroundColor: c.sunken },
  strong: { fontFamily: f.bold, color: c.fg },
  codeFig: { borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.codeBg, overflow: "hidden" },
  codeCaption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: c.line, paddingHorizontal: 14, paddingVertical: 6 },
  codeLabel: { fontFamily: f.mono, fontSize: 12, color: c.muted },
  copy: { minHeight: 32, paddingHorizontal: 8, justifyContent: "center" },
  copyText: { fontFamily: f.semibold, fontSize: 12, color: c.muted },
  code: { fontFamily: f.mono, fontSize: 13.5, lineHeight: 23, color: c.codeFg, padding: 14 },
  tableWrap: { borderRadius: 12, borderWidth: 1, borderColor: c.line, overflow: "hidden" },
  tr: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  td: { fontFamily: f.regular, fontSize: 14, color: c.fg, paddingHorizontal: 12, paddingVertical: 10, minWidth: 96 },
  th: { fontFamily: f.semibold, color: c.muted, backgroundColor: c.surface },
  sectionLabel: { fontFamily: f.bold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase" },
  card: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 18, gap: 10, shadowColor: c.shadow.e1.shadowColor, shadowOpacity: c.shadow.e1.shadowOpacity, shadowRadius: c.shadow.e1.shadowRadius, shadowOffset: c.shadow.e1.shadowOffset, elevation: c.shadow.e1.elevation },
}));

/** `code` and **bold** inside prose. Nothing else is interpreted, so lesson text cannot inject markup. */
export function Inline({ text, style }: { text: string; style?: object }) {
  const { s } = useStyles();
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter((p) => p.length > 0);
  return (
    <Text style={[s.p, style]}>
      {parts.map((p, i) => {
        if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return <Text key={i} style={s.inlineCode}>{` ${p.slice(1, -1)} `}</Text>;
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <Text key={i} style={s.strong}>{p.slice(2, -2)}</Text>;
        return <Text key={i}>{p}</Text>;
      })}
    </Text>
  );
}

export function H({ children, level = 2 }: { children: string; level?: 1 | 2 | 3 }) {
  const { s } = useStyles();
  return <Text accessibilityRole="header" style={level === 1 ? s.h1 : level === 2 ? s.h2 : s.h3}>{children}</Text>;
}

export function P({ children }: { children: string }) {
  return <Inline text={children} />;
}

export function Bullets({ items }: { items: string[] }) {
  const { s } = useStyles();
  return (
    <View style={s.list}>
      {items.map((t, i) => (
        <View key={i} style={s.bulletRow}>
          <Text style={s.bulletDot}>{"›"}</Text>
          <View style={{ flex: 1 }}><Inline text={t} style={s.bulletText} /></View>
        </View>
      ))}
    </View>
  );
}

/** A code block with a caption (language and copy button) and syntax colours, as on the website. */
export function Code({ code, label = "python" }: { code: string; label?: string }) {
  const { c, s } = useStyles();
  const [copied, setCopied] = useState(false);
  return (
    <View style={s.codeFig} accessibilityLabel={`Code: ${label}`}>
      <View style={s.codeCaption}>
        <Text style={s.codeLabel}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copied ? "Copied" : "Copy code"}
          onPress={async () => {
            await Clipboard.setStringAsync(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          style={s.copy}
        >
          <Text style={s.copyText}>{copied ? "Copied" : "Copy"}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <Text style={s.code} selectable>
          {tokenize(code).map((t, i) => (
            <Text key={i} style={{ color: t.t === "txt" ? c.codeFg : c.tok[t.t === "kw" ? "kw" : t.t === "str" ? "str" : t.t === "num" ? "num" : t.t === "com" ? "com" : t.t === "fn" ? "fn" : "bi"], fontStyle: t.t === "com" ? "italic" : "normal", fontWeight: t.t === "kw" ? "700" : "400" }}>
              {t.v}
            </Text>
          ))}
        </Text>
      </ScrollView>
    </View>
  );
}

export function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  const { s } = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={s.tableWrap}>
      <View>
        <View style={s.tr}>{head.map((h, j) => <Text key={`h${j}`} style={[s.td, s.th]}>{h}</Text>)}</View>
        {rows.map((r, i) => (
          <View key={i} style={s.tr}>{r.map((cell, j) => <Text key={j} style={s.td}>{cell}</Text>)}</View>
        ))}
      </View>
    </ScrollView>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  const { s } = useStyles();
  return <View style={s.card}>{children}</View>;
}

/** The website's section label: a small icon and uppercase kicker in a tone, then the title. */
export function SectionHead({ icon, label, tone = "brand", title }: { icon: IconName; label: string; tone?: "brand" | "warn" | "ok" | "muted"; title: string }) {
  const { c, s } = useStyles();
  const color = tone === "warn" ? c.warn : tone === "ok" ? c.ok : tone === "muted" ? c.muted : c.brand;
  return (
    <View style={{ gap: 4 }} accessibilityRole="header">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name={icon} size={14} color={color} />
        <Text style={[s.sectionLabel, { color }]}>{label}</Text>
      </View>
      <Text style={s.h2}>{title}</Text>
    </View>
  );
}
