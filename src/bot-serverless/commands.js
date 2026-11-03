export const SUPPORT_EMAIL = "Algoryva@gmail.com";

// The single source of truth for the bot's commands. The /help command in the bot and the public guide on the website both read this list.
export const SECTIONS = [
  { id: "practice", title: "🎲 Practice", blurb: "Problems for you, every day." },
  { id: "contests", title: "🏆 Contests", blurb: "Upcoming Codeforces contests and reminders." },
  { id: "account", title: "👤 Your account", blurb: "Connect your Codeforces handle." },
  { id: "settings", title: "⚙️ Settings", blurb: "Choose what you receive." },
  { id: "groups", title: "👥 Groups and classes", blurb: "For group admins, and for students in a group." },
];

export const COMMANDS = [
  { name: "start", section: "practice", usage: "/start", summary: "Open the menu and get today's problem.", examples: ["/start"], where: "private" },
  { name: "random", section: "practice", usage: "/random [rating | low-high] [tags]", summary: "A random problem you have not solved yet.", examples: ["/random", "/random 1400", "/random 1200-1600 dp graphs"], where: "any" },
  { name: "daily", section: "practice", usage: "/daily", summary: "Today's challenge.", examples: ["/daily"], where: "any" },
  { name: "support", section: "practice", usage: "/support", summary: "How to reach the team. Email: Algoryva@gmail.com", examples: ["/support"], where: "any" },
  { name: "help", section: "practice", usage: "/help [command]", summary: "The command list, or the details of one command.", examples: ["/help", "/help roster"], where: "any" },
  { name: "contests", section: "contests", usage: "/contests", summary: "Upcoming contests, soonest first, with Ethiopian and UTC time and a countdown.", examples: ["/contests"], where: "any" },
  { name: "next", section: "contests", usage: "/next", summary: "The next contest, with the time left.", examples: ["/next"], where: "any" },
  { name: "connect", section: "account", usage: "/connect <handle>", summary: "Link your Codeforces handle, so problems you solved are skipped.", examples: ["/connect tourist"], where: "any" },
  { name: "me", section: "account", usage: "/me", summary: "Your connected handles, with rating and solved count.", examples: ["/me"], where: "any" },
  { name: "disconnect", section: "account", usage: "/disconnect [handle]", summary: "Unlink one handle, or all of them.", examples: ["/disconnect", "/disconnect tourist"], where: "any" },
  { name: "notify", section: "settings", usage: "/notify daily|contests on|off", summary: "Turn the daily problem or the contest alerts on or off.", examples: ["/notify daily off", "/notify contests on"], where: "any" },
  { name: "stop", section: "settings", usage: "/stop", summary: "Stop all messages in this chat.", examples: ["/stop"], where: "any" },
  { name: "enable", section: "groups", usage: "/enable", summary: "Turn on the daily problem and contest alerts in this group.", examples: ["/enable"], where: "group", admin: true },
  { name: "disable", section: "groups", usage: "/disable", summary: "Turn the group's messages off.", examples: ["/disable"], where: "group", admin: true },
  {
    name: "roster",
    section: "groups",
    usage: "/roster <list | add | remove | set | clear>",
    summary: "Manage the class list of Codeforces handles. The list is what /report and /leaderboard check.",
    where: "group",
    admin: "for changes",
    subcommands: [
      { usage: "/roster list", summary: "Show the class list. Anyone can use it.", examples: ["/roster list"], admin: false },
      { usage: "/roster add <handles>", summary: "Add handles, separated by spaces or commas.", examples: ["/roster add tourist jiangly"], admin: true },
      { usage: "/roster remove <handles>", summary: "Remove handles from the list.", examples: ["/roster remove jiangly"], admin: true },
      { usage: "/roster set <handles>", summary: "Replace the whole list with these handles.", examples: ["/roster set tourist jiangly ksun48"], admin: true },
      { usage: "/roster clear", summary: "Empty the list.", examples: ["/roster clear"], admin: true },
    ],
  },
  {
    name: "setdaily",
    section: "groups",
    usage: "/setdaily <problem> | reset",
    summary: "Set the group's own daily problem, or go back to the default.",
    where: "group",
    admin: true,
    subcommands: [
      { usage: "/setdaily 1800C", summary: "Use problem C of contest 1800.", examples: ["/setdaily 1800C"], admin: true },
      { usage: "/setdaily 1800/C", summary: "The same, written with a slash.", examples: ["/setdaily 1800/C"], admin: true },
      { usage: "/setdaily <Codeforces link>", summary: "Paste the problem's Codeforces link.", examples: ["/setdaily https://codeforces.com/problemset/problem/1800/C"], admin: true },
      { usage: "/setdaily reset", summary: "Go back to the default daily problem.", examples: ["/setdaily reset"], admin: true },
    ],
  },
  { name: "report", section: "groups", usage: "/report", summary: "Who is registered, who solved the group's problem, and who has not.", examples: ["/report"], where: "group" },
  {
    name: "leaderboard",
    section: "groups",
    usage: "/leaderboard [week | month | all]",
    summary: "The group's ranking by problems solved, consistency and rating. Refresh with the button under the table.",
    examples: ["/leaderboard", "/leaderboard month", "/leaderboard all"],
    where: "group",
  },
];

export const commandByName = (name) => COMMANDS.find((c) => c.name === name);
