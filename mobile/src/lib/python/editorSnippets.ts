/** Snippets offered while typing in the Python Runner. Each one inserts a complete, valid block; the cursor lands on the first placeholder. */
export type EditorSnippet = { label: string; detail: string; apply: string };

export const EDITOR_SNIPPETS: EditorSnippet[] = [
  { label: "for", detail: "loop over items", apply: "for item in items:\n    pass" },
  { label: "for range", detail: "loop n times", apply: "for i in range(n):\n    pass" },
  { label: "def", detail: "define a function", apply: "def name(args):\n    return" },
  { label: "if", detail: "check a condition", apply: "if condition:\n    pass" },
  { label: "if else", detail: "two branches", apply: "if condition:\n    pass\nelse:\n    pass" },
  { label: "while", detail: "loop while true", apply: "while condition:\n    pass" },
  { label: "try", detail: "handle an error", apply: "try:\n    pass\nexcept Exception as e:\n    print(e)" },
  { label: "class", detail: "define a class", apply: "class Name:\n    def __init__(self):\n        pass" },
  { label: "read int", detail: "read a number", apply: "n = int(input())" },
  { label: "main", detail: "run as a script", apply: 'def main():\n    pass\n\nif __name__ == "__main__":\n    main()' },
];
