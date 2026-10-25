import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { makeStyles, MIN_TOUCH } from "../../lib/ui/theme";
import { Icon, type IconName } from "../Icon";

/**
 * Controls in the website's style: the .btn, .input, .chip, .tabs, .card and .field-error recipes from globals.css.
 * Touch targets are at least 44 points; the website's controls are 40px, so the app is slightly taller for fingers.
 */
const useStyles = makeStyles((c, f) => ({
  btn: { minHeight: MIN_TOUCH, borderRadius: 10, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  btnPrimary: { backgroundColor: c.brand, borderBottomWidth: 2, borderBottomColor: "rgba(0,0,0,0.16)" },
  btnSecondary: { backgroundColor: c.surface, borderColor: c.lineStrong },
  btnQuiet: { backgroundColor: "transparent" },
  btnDanger: { backgroundColor: c.surface, borderColor: c.tint.bad },
  btnDim: { opacity: 0.5 },
  btnText: { fontFamily: f.semibold, fontSize: 15, textAlign: "center" },
  btnTextPrimary: { color: c.brandFg },
  btnTextSecondary: { color: c.fg },
  btnTextQuiet: { color: c.soft },
  btnTextDanger: { color: c.bad },
  field: { gap: 6 },
  label: { fontFamily: f.semibold, fontSize: 13, color: c.soft },
  hint: { fontSize: 12, color: c.muted, lineHeight: 17 },
  input: { minHeight: MIN_TOUCH, borderRadius: 10, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.surface, color: c.fg, paddingHorizontal: 12, fontFamily: f.regular, fontSize: 15 },
  inputMulti: { minHeight: 112, paddingTop: 10, textAlignVertical: "top" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 28, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: c.line, backgroundColor: c.sunken },
  chipText: { fontFamily: f.semibold, fontSize: 12, color: c.soft },
  chipSelectedBg: { backgroundColor: c.brand, borderColor: c.brand },
  chipSelectedText: { color: c.brandFg },
  notice: { fontFamily: f.medium, fontSize: 14, lineHeight: 20 },
  empty: { borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: c.lineStrong, backgroundColor: c.surface, paddingHorizontal: 20, paddingVertical: 28, alignItems: "center", gap: 8 },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.sunken, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: f.bold, fontSize: 15, color: c.fg, textAlign: "center" },
  emptyText: { fontSize: 14, color: c.soft, textAlign: "center", lineHeight: 20 },
  tabs: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.sunken, padding: 4 },
  tab: { flex: 1, minHeight: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  tabOn: { backgroundColor: c.surface, shadowColor: c.shadow.e2.shadowColor, shadowOpacity: c.shadow.e2.shadowOpacity, shadowRadius: c.shadow.e2.shadowRadius, shadowOffset: c.shadow.e2.shadowOffset, elevation: c.shadow.e2.elevation },
  tabText: { fontFamily: f.semibold, fontSize: 13, color: c.muted },
  tabTextOn: { color: c.fg },
  calloutBox: { flexDirection: "row", gap: 12, borderRadius: 12, borderWidth: 1, padding: 16 },
  calloutTitle: { fontFamily: f.bold, fontSize: 15, color: c.fg },
  calloutBody: { fontSize: 14, color: c.soft, lineHeight: 21, marginTop: 2 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: c.sunken, borderWidth: 1, borderColor: c.line, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: c.brand },
  headerKicker: { fontFamily: f.semibold, fontSize: 13, color: c.muted },
  pageTitle: { fontFamily: f.extrabold, fontSize: 30, lineHeight: 36, color: c.fg, letterSpacing: -0.5 },
  pageLead: { fontSize: 15, color: c.soft, lineHeight: 22, marginTop: 6 },
}));

type Variant = "primary" | "secondary" | "quiet" | "danger";

export function Button({ label, onPress, variant = "secondary", disabled, hint, icon }: { label: string; onPress: () => void; variant?: Variant; disabled?: boolean; hint?: string; icon?: IconName }) {
  const { c, s } = useStyles();
  const bg = variant === "primary" ? s.btnPrimary : variant === "danger" ? s.btnDanger : variant === "quiet" ? s.btnQuiet : s.btnSecondary;
  const tx = variant === "primary" ? s.btnTextPrimary : variant === "danger" ? s.btnTextDanger : variant === "quiet" ? s.btnTextQuiet : s.btnTextSecondary;
  const iconColor = variant === "primary" ? c.brandFg : variant === "danger" ? c.bad : variant === "quiet" ? c.soft : c.fg;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: disabled === true }}
      style={({ pressed }) => [s.btn, bg, (disabled || pressed) && s.btnDim]}
    >
      {icon ? <Icon name={icon} size={16} color={iconColor} /> : null}
      <Text style={[s.btnText, tx]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const { c, s } = useStyles();
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      <TextInput
        placeholderTextColor={c.muted}
        accessibilityLabel={label}
        style={[s.input, props.multiline && s.inputMulti]}
        {...props}
      />
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { s } = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[s.chip, selected && s.chipSelectedBg, { minHeight: MIN_TOUCH - 8 }]}
    >
      <Text style={[s.chipText, selected && s.chipSelectedText]}>{label}</Text>
    </Pressable>
  );
}

/** A status chip, in the website's tones: brand, ok, warn or bad. */
export function Tag({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "brand" | "ok" | "warn" | "bad" }) {
  const { c, s } = useStyles();
  const color = tone === "brand" ? c.brand : tone === "ok" ? c.ok : tone === "warn" ? c.warn : tone === "bad" ? c.bad : c.soft;
  const bg = tone === "brand" ? c.tint.brand : tone === "ok" ? c.tint.ok : tone === "warn" ? c.tint.warn : tone === "bad" ? c.tint.bad : c.sunken;
  const border = tone === "brand" ? c.tint.brandLine : tone === "ok" ? c.tint.okLine : tone === "warn" ? c.tint.warnLine : tone === "bad" ? c.tint.badLine : c.line;
  return (
    <View style={[s.chip, { backgroundColor: bg, borderColor: border, minHeight: 24 }]} accessible accessibilityLabel={label}>
      <Text style={[s.chipText, { color }]}>{label}</Text>
    </View>
  );
}

export function Notice({ text, tone = "info" }: { text: string; tone?: "info" | "error" | "ok" }) {
  const { c, s } = useStyles();
  const color = tone === "error" ? c.bad : tone === "ok" ? c.ok : c.fg;
  return <Text style={[s.notice, { color }]} accessibilityRole={tone === "error" ? "alert" : undefined} accessibilityLiveRegion="polite">{text}</Text>;
}

export function Empty({ text, icon = "inbox", title }: { text: string; icon?: IconName; title?: string }) {
  const { c, s } = useStyles();
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><Icon name={icon} size={20} color={c.muted} /></View>
      {title ? <Text style={s.emptyTitle}>{title}</Text> : null}
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

/** Segmented control: the website's .tabs. Used for the theme choice and other small choices. */
export function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const { s } = useStyles();
  return (
    <View style={s.tabs} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityLabel={o.label} accessibilityState={{ selected: on }} style={[s.tab, on && s.tabOn]}>
            <Text style={[s.tabText, on && s.tabTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Callout: the website's tinted notice box (info, warn, ok, bad). */
export function Callout({ tone = "info", title, children }: { tone?: "info" | "warn" | "ok" | "bad"; title?: string; children: string }) {
  const { c, s } = useStyles();
  const color = tone === "warn" ? c.warn : tone === "ok" ? c.ok : tone === "bad" ? c.bad : c.brand;
  const bg = tone === "warn" ? c.tint.warnFaint : tone === "ok" ? c.tint.okFaint : tone === "bad" ? c.tint.badFaint : c.tint.brandFaint;
  const border = tone === "warn" ? c.tint.warnLine : tone === "ok" ? c.tint.okLine : tone === "bad" ? c.tint.badLine : c.tint.brandLine;
  const icon: IconName = tone === "ok" ? "check" : tone === "info" ? "info" : "alert";
  return (
    <View style={[s.calloutBox, { backgroundColor: bg, borderColor: border }]} accessibilityRole={tone === "bad" ? "alert" : undefined}>
      <Icon name={icon} size={18} color={color} />
      <View style={{ flex: 1 }}>
        {title ? <Text style={s.calloutTitle}>{title}</Text> : null}
        <Text style={[s.calloutBody, title ? { marginTop: 2 } : null]}>{children}</Text>
      </View>
    </View>
  );
}

/** The website's progress bar (.bar). The value is shown as text for screen readers, not by colour alone. */
export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const { s } = useStyles();
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`${label}: ${value} of ${max}`} accessibilityValue={{ min: 0, max, now: value }}>
      <View style={s.progressTrack}><View style={[s.progressFill, { width: `${pct}%` }]} /></View>
    </View>
  );
}

/** The website's page heading: a small kicker, the title, and a lead line. */
export function PageHeader({ title, lead, kicker }: { title: string; lead?: string; kicker?: string }) {
  const { s } = useStyles();
  return (
    <View accessibilityRole="header" style={{ gap: 4 }}>
      {kicker ? <Text style={s.headerKicker}>{kicker}</Text> : null}
      <Text style={s.pageTitle}>{title}</Text>
      {lead ? <Text style={s.pageLead}>{lead}</Text> : null}
    </View>
  );
}
