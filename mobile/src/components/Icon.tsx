import Svg, { Path } from "react-native-svg";
import { useTheme } from "../lib/ui/theme";

/**
 * The website's icon set (src/components/Icon.tsx): 24px grid, stroke-based paths. Same names, same shapes.
 */
export const PATHS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  route: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 19a2 2 0 0 1 2-2h13",
  code: "m8 8-4 4 4 4 M16 8l4 4-4 4 M14 5l-4 14",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0z M8 6H5a2 2 0 0 0 2 4 M16 6h3a2 2 0 0 1-2 4 M12 13v4 M8 21h8 M10 17h4",
  note: "M6 3h9l4 4v14H6z M15 3v4h4 M9 12h6 M9 16h6",
  alert: "M12 3 2 20h20z M12 10v4 M12 17.5v.01",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0",
  users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20a6 6 0 0 1 12 0 M17 11a3 3 0 1 0-1-5.8 M21 20a6 6 0 0 0-4-5.6",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M5 19l1.5-1.5 M17.5 6.5 19 5",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  lock: "M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4",
  arrowRight: "M5 12h14 M13 6l6 6-6 6",
  arrowLeft: "M19 12H5 M11 6l-6 6 6 6",
  arrowUpRight: "M7 17 17 7 M8 7h9v9",
  external: "M14 4h6v6 M20 4l-9 9 M18 14v5H5V6h5",
  flame: "M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2",
  chevronRight: "m9 6 6 6-6 6",
  chevronDown: "m6 9 6 6 6-6",
  plus: "M12 5v14 M5 12h14",
  x: "M6 6l12 12 M18 6 6 18",
  menu: "M4 7h16 M4 12h16 M4 17h16",
  panelLeft: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M9.5 4v16",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  layers: "M12 3 3 8l9 5 9-5z M3 12l9 5 9-5 M3 16l9 5 9-5",
  chart: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  flag: "M5 21V4 M5 4h11l-2 4 2 4H5",
  edit: "M4 20h4L19 9l-4-4L4 16z M14 6l4 4",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  eyeOff: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M3 3l18 18",
  copy: "M8 8h12v12H8z M16 8V4H4v12h4",
  play: "M7 4v16l13-8z",
  pause: "M8 5v14 M16 5v14",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7",
  stepForward: "M5 5v14l10-7z M19 5v14",
  stepBack: "M19 5v14L9 12z M5 5v14",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z",
  grid: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v5 M12 8v.01",
  logout: "M9 4H5v16h4 M16 8l4 4-4 4 M20 12H9",
  list: "M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01",
  filter: "M4 5h16l-6 8v6l-4-2v-4z",
  inbox: "M3 13l3-8h12l3 8v6H3z M3 13h5l1 3h6l1-3h5",
  pencil: "M4 20l1-4L16 5l3 3L8 19z",
  timer: "M10 2h4 M12 14l3-3 M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16z",
  award: "M12 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M8.5 14 7 21l5-3 5 3-1.5-7",
} as const;

export type IconName = keyof typeof PATHS;


/** One icon, drawn as SVG. Colour follows the theme's text colour unless a colour is given. */
export function Icon({ name, size = 18, strokeWidth = 1.75, color }: { name: IconName; size?: number; strokeWidth?: number; color?: string }) {
  const { palette } = useTheme();
  const ink = color ?? palette.fg;
  const filled = name === "play";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? ink : "none"} stroke={ink} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" importantForAccessibility="no" accessible={false}>
      <Path d={PATHS[name]} />
    </Svg>
  );
}
