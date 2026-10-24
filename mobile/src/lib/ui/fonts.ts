/**
 * The website's typefaces: Bricolage Grotesque for text and JetBrains Mono for code. React Native picks a font by its exact name,
 * so each weight has its own name. The files are loaded once at startup (see src/app/_layout.tsx and fontFiles.ts).
 */
export const FONTS = {
  regular: "BricolageGrotesque_400Regular",
  medium: "BricolageGrotesque_500Medium",
  semibold: "BricolageGrotesque_600SemiBold",
  bold: "BricolageGrotesque_700Bold",
  extrabold: "BricolageGrotesque_800ExtraBold",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
  monoBold: "JetBrainsMono_700Bold",
} as const;

export type FontSet = typeof FONTS;

/** CSS-style weight to the matching font name. */
export const fontForWeight = (w: string | number | undefined): string => {
  switch (String(w)) {
    case "800": return FONTS.extrabold;
    case "700": case "bold": return FONTS.bold;
    case "600": return FONTS.semibold;
    case "500": return FONTS.medium;
    default: return FONTS.regular;
  }
};
