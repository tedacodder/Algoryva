/**
 * Autocomplete and find-and-replace for the Python editor. Pure functions, so they are tested without the screen.
 */
export const PY_KEYWORDS = ["and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except", "False", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "None", "nonlocal", "not", "or", "pass", "raise", "return", "True", "try", "while", "with", "yield"];
export const PY_BUILTINS = ["abs", "all", "any", "bin", "bool", "chr", "dict", "dir", "divmod", "enumerate", "filter", "float", "format", "hex", "input", "int", "isinstance", "len", "list", "map", "max", "min", "open", "ord", "pow", "print", "range", "reversed", "round", "set", "sorted", "str", "sum", "tuple", "type", "zip"];
export const PY_METHODS = ["append", "extend", "insert", "remove", "pop", "clear", "index", "count", "sort", "reverse", "keys", "values", "items", "get", "add", "discard", "update", "split", "join", "strip", "replace", "startswith", "endswith", "lower", "upper"];

/** The word being typed just before the cursor, and where it starts. */
export function wordBeforeCursor(text: string, cursor: number): { start: number; word: string } {
  const end = Math.max(0, Math.min(cursor, text.length));
  let start = end;
  while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1]!)) start--;
  return { start, word: text.slice(start, end) };
}

/** Names the program itself defines (functions, classes, and assigned variables). */
export function namesInProgram(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/^\s*(?:def|class)\s+([A-Za-z_]\w*)/gm)) found.add(m[1]!);
  for (const m of text.matchAll(/^\s*([A-Za-z_]\w*)\s*=(?!=)/gm)) found.add(m[1]!);
  for (const m of text.matchAll(/\bfor\s+([A-Za-z_]\w*)\s+in\b/g)) found.add(m[1]!);
  return [...found];
}

/**
 * Suggestions for the word at the cursor: names from the program first, then keywords, built-ins and common methods.
 * Nothing is suggested for an empty word, and an exact match is not repeated.
 */
export function suggestionsAt(text: string, cursor: number, max = 8): { start: number; word: string; options: string[] } {
  const { start, word } = wordBeforeCursor(text, cursor);
  if (word.length === 0) return { start, word, options: [] };
  const lower = word.toLowerCase();
  const pool = [...namesInProgram(text), ...PY_KEYWORDS, ...PY_BUILTINS, ...PY_METHODS];
  const seen = new Set<string>();
  const options: string[] = [];
  for (const candidate of pool) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (candidate !== word && candidate.toLowerCase().startsWith(lower)) options.push(candidate);
    if (options.length >= max) break;
  }
  return { start, word, options };
}

/** Start positions of every match of `query` (case-insensitive unless `caseSensitive`). Empty query has no matches. */
export function findMatches(text: string, query: string, caseSensitive = false): number[] {
  if (query.length === 0) return [];
  const hay = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const out: number[] = [];
  let at = hay.indexOf(needle);
  while (at !== -1) {
    out.push(at);
    at = hay.indexOf(needle, at + needle.length);
  }
  return out;
}

/** The first match at or after `from`, wrapping to the start. Returns null when there are no matches. */
export function nextMatch(matches: number[], from: number): number | null {
  if (matches.length === 0) return null;
  const after = matches.find((m) => m >= from);
  return after ?? matches[0]!;
}

/** Replaces every match of `query` with `replacement`. Returns the new text and how many were replaced. */
export function replaceAll(text: string, query: string, replacement: string, caseSensitive = false): { text: string; count: number } {
  const matches = findMatches(text, query, caseSensitive);
  if (matches.length === 0) return { text, count: 0 };
  let out = "";
  let last = 0;
  for (const m of matches) {
    out += text.slice(last, m) + replacement;
    last = m + query.length;
  }
  out += text.slice(last);
  return { text: out, count: matches.length };
}
