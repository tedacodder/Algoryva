// Turns the website's plain text into Telegram HTML. Every piece is escaped first, so user text cannot inject markup.
const LABELS = ["Rating", "Tags", "Starts", "Length", "Register", "Invite code", "Members", "Level", "Streak", "Solved", "Badges", "Input", "Expected", "Sample", "Connected handles"];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LABEL_RE = new RegExp(`(?<![\\w<])(${LABELS.map(escapeRe).join("|")})(?=[:\\s])`, "g");

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function toHtml(text) {
  const lines = text.split("\n");
  const out = lines.map((raw, index) => {
    const line = escapeHtml(raw);
    // The first line is a title only when the message has more lines. A one-line answer stays plain.
    if (index === 0 && lines.length > 1 && line.trim()) return `<b>${line}</b>`;
    return line.replace(LABEL_RE, "<b>$1</b>");
  });
  return out
    .join("\n")
    .replace(/(<b>Rating<\/b> )(\S+)/g, "$1<code>$2</code>")
    .replace(/^• (\S+) ·/gm, "• <code>$1</code> ·")
    .replace(/🏷️ ((?:#[^\s<]+ ?)+)/g, "🏷️ <tg-spoiler>$1</tg-spoiler>");
}
