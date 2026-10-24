/** Tiny Python-flavoured tokenizer for code blocks. Pure and dependency-free; the output re-joins to the exact input. */
export type Token = { t: "kw" | "str" | "num" | "com" | "fn" | "bi" | "txt"; v: string };

const KEYWORDS = new Set("and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield True False None".split(" "));
const BUILTINS = new Set("print len range sum min max sorted reversed enumerate zip map filter list dict set tuple int str float bool abs any all input open isinstance type iter next heapq deque".split(" "));

const RE = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g;

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  const push = (t: Token["t"], v: string) => { if (v) out.push({ t, v }); };
  for (const m of src.matchAll(RE)) {
    const at = m.index ?? 0;
    push("txt", src.slice(last, at));
    if (m[1]) push("com", m[0]);
    else if (m[2]) push("str", m[0]);
    else if (m[3]) push("num", m[0]);
    else {
      const w = m[0], next = src.slice(at + w.length).match(/^\s*\(/);
      const prev = src.slice(Math.max(0, at - 5), at);
      if (KEYWORDS.has(w)) push("kw", w);
      else if (/\bdef\s+$/.test(prev + " ") || /def $/.test(prev)) push("fn", w);
      else if (BUILTINS.has(w) && next) push("bi", w);
      else if (next) push("fn", w);
      else push("txt", w);
    }
    last = at + m[0].length;
  }
  push("txt", src.slice(last));
  return out;
}
