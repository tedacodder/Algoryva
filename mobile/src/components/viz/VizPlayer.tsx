import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { makeStyles, MIN_TOUCH } from "../../lib/ui/theme";
import { ArrayStage } from "./ArrayStage";
import { GraphStage } from "./GraphStage";
import { GridStage } from "./GridStage";
import type { VizView } from "./types";

const TICK_MS = 1400;

/**
 * Plays a visualization frame by frame: previous, play or pause, next, and back to the start. Autoplay stops at the last frame
 * (it never wraps), and it pauses while the app is in the background, because the interval is tied to the screen.
 */
export function VizPlayer({ viz, onIndexChange }: { viz: VizView; onIndexChange?: (index: number) => void }) {
  const { s } = useStyles();
  const total = viz.frames.length;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [shown, setShown] = useState(viz);
  if (shown !== viz) {
    // A new visualization starts from its first frame. Adjusting state during render avoids an extra render pass.
    setShown(viz);
    setI(0);
    setPlaying(false);
  }

  useEffect(() => { onIndexChange?.(i); }, [i, onIndexChange]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setI((cur) => {
        if (cur >= total - 1) {
          setPlaying(false);
          return cur;
        }
        return cur + 1;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, total]);

  const last = Math.max(0, total - 1);
  const note = frameNote(viz, Math.min(i, last));

  const go = (n: number) => { setPlaying(false); setI(Math.max(0, Math.min(last, n))); };

  return (
    <View style={s.wrap} accessibilityLabel={`Visualization: ${viz.title}`}>
      <Text style={s.title} accessibilityRole="header">{viz.title}</Text>

      <View style={s.stage}>
        {renderStage(viz, Math.min(i, last), s.muted)}
      </View>

      <Text style={s.note} accessibilityLiveRegion="polite">{note}</Text>

      <View style={s.controls}>
        <Btn label="Go to start" onPress={() => go(0)} disabled={i === 0} />
        <Btn label="Previous step" onPress={() => go(i - 1)} disabled={i === 0} />
        <Btn label={playing ? "Pause" : "Play"} onPress={() => (i >= last ? (go(0), setPlaying(true)) : setPlaying((p) => !p))} primary />
        <Btn label="Next step" onPress={() => go(i + 1)} disabled={i >= last} />
      </View>
      <Text style={s.counter} accessibilityLabel={`Step ${i + 1} of ${total}`}>Step {total === 0 ? 0 : i + 1} of {total}</Text>
    </View>
  );
}

function Btn({ label, onPress, disabled, primary }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  const { s } = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled === true }}
      style={({ pressed }) => [s.btn, primary && s.btnPrimary, (disabled || pressed) && s.btnDim]}
    >
      <Text style={[s.btnText, primary && s.btnTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

/** Picks the right renderer for the frame kind. Each branch is narrowed, so the frame type always matches the stage. */
function renderStage(viz: VizView, index: number, muted: object) {
  switch (viz.kind) {
    case "array": {
      const f = viz.frames[index];
      return f ? <ArrayStage f={f} /> : <Text style={muted}>No frames to show.</Text>;
    }
    case "graph": {
      const f = viz.frames[index];
      return f ? <GraphStage f={f} /> : <Text style={muted}>No frames to show.</Text>;
    }
    case "grid": {
      const f = viz.frames[index];
      return f ? <GridStage f={f} /> : <Text style={muted}>No frames to show.</Text>;
    }
  }
}

function frameNote(viz: VizView, index: number): string {
  const f = viz.frames[index];
  return f?.note ?? "";
}

const useStyles = makeStyles((c, f) => ({
  wrap: { gap: 12, backgroundColor: c.surface, borderRadius: 12, padding: 14 },
  title: { color: c.fg, fontSize: 16, fontFamily: f.bold },
  stage: { minHeight: 80 },
  note: { color: c.fg, fontSize: 15, lineHeight: 22 },
  muted: { color: c.muted },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: { minHeight: MIN_TOUCH, minWidth: 80, paddingHorizontal: 12, borderRadius: 10, backgroundColor: c.sunken, alignItems: "center", justifyContent: "center", flexGrow: 1 },
  btnPrimary: { backgroundColor: c.brand },
  btnDim: { opacity: 0.45 },
  btnText: { color: c.fg, fontSize: 14, fontFamily: f.bold, textAlign: "center" },
  btnTextPrimary: { color: c.brandFg },
  counter: { color: c.muted, fontSize: 13 },
}));
