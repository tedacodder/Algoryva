/**
 * The website's colour tokens (src/app/globals.css), converted to hex. Light is the website's "paper" theme, dark is its "ink" theme.
 * Keep these in step with globals.css: they are the same colours, so the app and the site look like one product.
 */
export type ThemeMode = "light" | "dark";

export type Palette = {
  mode: ThemeMode;
  bg: string; surface: string; sunken: string;
  line: string; lineStrong: string;
  fg: string; soft: string; muted: string;
  brand: string; brandFg: string; brandSoft: string;
  logoWord: string;
  ok: string; warn: string; bad: string;
  lv: [string, string, string, string, string, string];
  codeBg: string; codeFg: string;
  tok: { kw: string; str: string; num: string; com: string; fn: string; bi: string };
  /** Translucent tints used by the website's /10, /5 and /25 utilities. */
  tint: { brand: string; brandFaint: string; ok: string; okFaint: string; warn: string; warnFaint: string; bad: string; badFaint: string; brandLine: string; okLine: string; warnLine: string; badLine: string };
  shadow: { e1: ShadowStyle; e2: ShadowStyle };
};

export type ShadowStyle = { shadowColor: string; shadowOpacity: number; shadowRadius: number; shadowOffset: { width: number; height: number }; elevation: number };

const alpha = (hex: string, a: number): string => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const build = (p: Omit<Palette, "tint" | "shadow">): Palette => ({
  ...p,
  tint: {
    brand: alpha(p.brand, 0.1), brandFaint: alpha(p.brand, 0.05), brandLine: alpha(p.brand, 0.25),
    ok: alpha(p.ok, 0.1), okFaint: alpha(p.ok, 0.06), okLine: alpha(p.ok, 0.3),
    warn: alpha(p.warn, 0.1), warnFaint: alpha(p.warn, 0.06), warnLine: alpha(p.warn, 0.3),
    bad: alpha(p.bad, 0.1), badFaint: alpha(p.bad, 0.05), badLine: alpha(p.bad, 0.3),
  },
  shadow: p.mode === "light"
    ? {
        e1: { shadowColor: "#1C2433", shadowOpacity: 0.04, shadowRadius: 1, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
        e2: { shadowColor: "#1C2433", shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
      }
    : {
        e1: { shadowColor: "#000000", shadowOpacity: 0.3, shadowRadius: 1, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
        e2: { shadowColor: "#000000", shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
      },
});

export const LIGHT: Palette = build({
  mode: "light",
  bg: "#F4FAFA", surface: "#FFFFFF", sunken: "#E9F0F4",
  line: "#DAE3EA", lineStrong: "#BAC8D6",
  fg: "#1C2433", soft: "#3C485E", muted: "#5E6A80",
  brand: "#3A59E0", brandFg: "#FFFFFF", brandSoft: "#E5ECFD",
  logoWord: "#1C2433",
  ok: "#0A8064", warn: "#A56000", bad: "#C81E3C",
  lv: ["#0D8C80", "#589414", "#C48400", "#E06014", "#D62854", "#803EE6"],
  codeBg: "#F9FCFD", codeFg: "#1C2433",
  tok: { kw: "#6D28D9", str: "#0A785C", num: "#A35A00", com: "#787EA0", fn: "#1D4ED8", bi: "#BE185D" },
});

export const DARK: Palette = build({
  mode: "dark",
  bg: "#151B29", surface: "#20283B", sunken: "#0F1420",
  line: "#303A52", lineStrong: "#485470",
  fg: "#E8EEF7", soft: "#B8C2D4", muted: "#8E9AB0",
  brand: "#789CFF", brandFg: "#0A0E20", brandSoft: "#1F2C54",
  logoWord: "#FAFEFF",
  ok: "#34D3A5", warn: "#F5B23C", bad: "#FF6B84",
  lv: ["#2DD4BF", "#A3E635", "#FACC15", "#FB923C", "#FB7185", "#A78BFA"],
  codeBg: "#0F1420", codeFg: "#E2E8F4",
  tok: { kw: "#BEA0FF", str: "#5EEABE", num: "#FCC45A", com: "#767EA8", fn: "#93B4FF", bi: "#F9A8D4" },
});

export const paletteFor = (mode: ThemeMode): Palette => (mode === "dark" ? DARK : LIGHT);

// Tones used by the website's callouts and cards, derived from the palette above.
export const brandFaint = (p: Palette): string => p.tint.brandFaint;

/** A colour with a given opacity, for soft tints (badges, selected cards). */
export function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
