import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";
import { LIGHT, paletteFor, type Palette, type ThemeMode } from "./palette";
import { FONTS, type FontSet } from "./fonts";
import { resolveMode, type Preference } from "./theme-types";

export type { Preference } from "./theme-types";

/** Touch targets: the website's controls are 40px; the app keeps at least 44 points for fingers and screen readers. */
export const MIN_TOUCH = 44;

type ThemeValue = { palette: Palette; mode: ThemeMode; preference: Preference; setPreference: (p: Preference) => void };

const ThemeContext = createContext<ThemeValue>({ palette: LIGHT, mode: "light", preference: "system", setPreference: () => undefined });

/**
 * Provides the palette for light or dark mode. The preference is loaded once (`load`) and saved when it changes (`save`).
 * Until the saved preference is loaded, the app shows the "system" choice, so the first frame never flashes the wrong mode.
 */
export function ThemeProvider({ children, load, save }: { children: ReactNode; load?: () => Promise<Preference>; save?: (p: Preference) => Promise<void> }) {
  const [preference, setPref] = useState<Preference>("system");
  const system = useColorScheme();

  useEffect(() => {
    let alive = true;
    void load?.().then((p) => {
      if (alive) setPref(p);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
    // load is provided once by the app; it is not expected to change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const mode = resolveMode(preference, system);
    return {
      palette: paletteFor(mode),
      mode,
      preference,
      setPreference: (p: Preference) => {
        setPref(p);
        void save?.(p).catch(() => undefined);
      },
    };
  }, [preference, system, save]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/**
 * Builds StyleSheet styles from the current palette. Use it in a component as `const { c, s } = useStyles();`, where `c` is the palette
 * and `s` holds the styles. The styles are rebuilt only when the palette changes.
 */
type StyleMap = Record<string, ViewStyle | TextStyle | ImageStyle>;

export function makeStyles<T extends StyleMap>(factory: (c: Palette, f: FontSet) => T) {
  return function useStyles(): { c: Palette; s: T } {
    const { palette } = useTheme();
    return useMemo(() => ({ c: palette, s: StyleSheet.create<T>(factory(palette, FONTS)) }), [palette]);
  };
}
