/**
 * Editor behaviour that does not depend on the screen: automatic indentation after Enter, and inserting text at the cursor.
 * Python uses indentation for blocks, so the editor keeps the previous line's indentation, and adds one level after a line ending in ':'.
 */
export const INDENT = "    ";

/** The indentation for the line after `line`: the same as `line`, plus one level if `line` opens a block. */
export function nextIndent(line: string): string {
  const current = /^[ \t]*/.exec(line)?.[0] ?? "";
  const body = line.trimEnd();
  return body.endsWith(":") ? current + INDENT : current;
}

/**
 * Applies a typed change: when the user has just pressed Enter (the text grew by one newline at the cursor), the new line starts with
 * the right indentation. Returns the new text and where the cursor should go.
 */
export function applyNewline(prev: string, next: string, cursor: number): { text: string; cursor: number } {
  if (next.length !== prev.length + 1 || next[cursor - 1] !== "\n") return { text: next, cursor };
  const lineStart = next.lastIndexOf("\n", cursor - 2) + 1;
  const previousLine = next.slice(lineStart, cursor - 1);
  const indent = nextIndent(previousLine);
  if (indent.length === 0) return { text: next, cursor };
  return { text: next.slice(0, cursor) + indent + next.slice(cursor), cursor: cursor + indent.length };
}

/** Inserts `insert` in place of the selection [start, end). Returns the new text and the cursor after the insert. */
export function insertAt(text: string, start: number, end: number, insert: string): { text: string; cursor: number } {
  const a = Math.max(0, Math.min(start, text.length));
  const b = Math.max(a, Math.min(end, text.length));
  return { text: text.slice(0, a) + insert + text.slice(b), cursor: a + insert.length };
}

/** Line numbers for the gutter, one per line of text. */
export function lineNumbers(text: string): string {
  const n = text.split("\n").length;
  return Array.from({ length: n }, (_, i) => String(i + 1)).join("\n");
}
