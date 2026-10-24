/** The six curriculum levels, as the website shows them (src/lib/levels.ts). `n` picks the level colour, lv1..lv6. */
export const LEVEL_META: Record<string, { label: string; n: 1 | 2 | 3 | 4 | 5 | 6; blurb: string }> = {
  FOUNDATION: { label: "Foundation", n: 1, blurb: "The Python and complexity toolkit everything else leans on." },
  BEGINNER: { label: "Beginner", n: 2, blurb: "Arrays and sorting: your first real algorithms." },
  CORE: { label: "Core", n: 3, blurb: "The patterns behind most easy and medium problems." },
  INTERMEDIATE: { label: "Intermediate", n: 4, blurb: "Data structures, graphs and your first dynamic programming." },
  ADVANCED: { label: "Advanced", n: 5, blurb: "Specialised structures and harder techniques." },
  EXPERT: { label: "Expert", n: 6, blurb: "Contest strategy and pattern recognition." },
};

export const LEVEL_ORDER = ["FOUNDATION", "BEGINNER", "CORE", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;
