import { View } from "react-native";
import { makeStyles } from "../../lib/ui/theme";
import { Code, H, Inline } from "../common/Ui";

/**
 * Custom lessons, as the website shows them: each "## Heading" starts a block, the text under it is prose, and the first fenced code
 * block inside a block becomes that block's code sample. Same parser as the website (src/lib/lesson-markdown.ts).
 */
export type Block = { heading: string; text: string; code?: string };

export function parseLessonMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let cur: { heading: string; lines: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const body = cur.lines.join("\n");
    const m = /```[a-z+]*\n([\s\S]*?)```/.exec(body);
    const text = (m ? body.replace(m[0], "") : body).trim();
    blocks.push({ heading: cur.heading, text, ...(m ? { code: m[1].replace(/\n$/, "") } : {}) });
  };
  for (const line of src.replace(/\r\n/g, "\n").split("\n")) {
    const h = /^##\s+(.+)$/.exec(line);
    if (h) {
      flush();
      cur = { heading: h[1].trim(), lines: [] };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  flush();
  return blocks;
}

const useStyles = makeStyles(() => ({
  wrap: { gap: 26 },
  block: { gap: 12 },
  paras: { gap: 12 },
}));

export function Markdown({ source }: { source: string }) {
  const { s } = useStyles();
  const blocks = parseLessonMarkdown(source);
  return (
    <View style={s.wrap}>
      {blocks.map((b, i) => (
        <View key={i} style={s.block}>
          <H level={2}>{b.heading}</H>
          {b.text.split(/\n{2,}/).map((para, k) => (
            <Inline key={k} text={para.replace(/\n/g, " ")} />
          ))}
          {b.code ? <Code code={b.code} /> : null}
        </View>
      ))}
    </View>
  );
}
