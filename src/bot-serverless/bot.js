// The grammY bot. It holds no state of its own: every fact lives on the website (the database), so no session storage is needed.
import { Bot, GrammyError, Keyboard } from "grammy"; // eslint-disable-line no-unused-vars
import { SiteError } from "./site.js";
import { toHtml } from "./render.js";
import * as T from "./texts.js";
import * as F from "./formatting.js";

export const ADMIN = ["creator", "administrator"];
const DAILY_OPENERS = ["🧠 Brain teaser of the day", "🔥 Fresh from Codeforces", "⚡ Quick challenge for you", "🎯 Today's target", "🧩 Puzzle time"];
const RANDOM_OPENERS = ["🎲 Random pick, no excuses", "🎰 Spin! Here is your problem", "🃏 Your card is…"];
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

function keyboard() {
  return new Keyboard()
    .text("🎲 Random").text("📅 Daily").text("🏆 Contests").row()
    .text("⏰ Next Contest").text("🔗 Connect").text("👤 My Handles").row()
    .text("⚙️ Settings").text("👥 Groups").text("❓ Help")
    .resized()
    .persistent();
}

const byStart = (contests) => [...contests].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

export function createBot({ token, site, botInfo }) {
  // botInfo lets a serverless function skip the getMe call on every cold start, when it is known in advance.
  const bot = new Bot(token, botInfo ? { botInfo } : {});

  // Logs the error class only. Message text, chat ids and tokens never reach the logs.
  bot.catch((error) => {
    console.error("update failed:", error.error?.name ?? "unknown");
  });

  const isPrivate = (ctx) => ctx.chat?.type === "private";
  const inGroup = (ctx) => ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
  const chatId = (ctx) => String(ctx.chat.id);

  async function replyHtml(ctx, html, { menu = false } = {}) {
    return ctx.reply(html, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: menu && isPrivate(ctx) ? keyboard() : undefined,
    });
  }

  // Plain text from the website is formatted here; pre-formatted HTML is sent as it is.
  const reply = (ctx, text, opts) => replyHtml(ctx, toHtml(text), opts);
  const htmlOf = (out) => (typeof out === "string" ? toHtml(out) : out.html);

  // Runs one action. A website error becomes a friendly line; anything unexpected becomes the generic line.
  async function act(ctx, action, opts = {}) {
    try {
      const out = await action();
      return typeof out === "string" ? reply(ctx, out, opts) : replyHtml(ctx, out.html, opts);
    } catch (error) {
      if (error instanceof SiteError) return reply(ctx, T.errorText(error.code), opts);
      console.error("action failed:", error?.name ?? "unknown");
      return reply(ctx, T.GENERIC, opts);
    }
  }

  async function isGroupAdmin(ctx) {
    const member = await ctx.getAuthor();
    return ADMIN.includes(member.status);
  }

  // ---- actions shared by commands and buttons ---------------------------------------------------------------------
  const dailyOut = (data) => {
    if (!data.problem) return data.text ?? T.GENERIC;
    const group = data.problem.group ? "👥 Group challenge · " : "";
    const header = `${pickOne(DAILY_OPENERS)} · ${group}${data.problem.day} UTC`;
    return { html: F.problemHtml(data.problem, { header, personalized: data.problem.personalized }) };
  };

  const randomAction = (ctx, args) => async () => {
    let filter;
    try {
      filter = T.parseRandom(args);
    } catch (error) {
      return `⚠️ ${error.message}\n\n🎲 Try: /random 1200-1600 dp graphs`;
    }
    const data = await site.random(chatId(ctx), filter);
    if (data.problem) return { html: F.problemHtml(data.problem, { header: pickOne(RANDOM_OPENERS), personalized: data.problem.personalized }) };
    if (data.text) return data.text;
    return { no_match: T.NO_MATCH, all_solved: T.ALL_SOLVED }[data.reason] ?? T.GENERIC;
  };

  const contestsAction = (ctx) => async () => {
    const data = await site.contests(chatId(ctx));
    if (data.contests?.length) return { html: F.contestsHtml(data.contests) };
    return data.text ?? T.GENERIC;
  };

  const nextAction = (ctx) => async () => {
    const data = await site.contests(chatId(ctx));
    const first = byStart(data.contests ?? [])[0];
    if (!first) return data.text ?? "📭 No upcoming Codeforces contests right now.";
    return { html: F.nextContestHtml(first) };
  };

  const connectAction = (ctx, arg) => async () => {
    const handle = T.parseHandle(arg);
    if (!handle) return "🔗 Send your Codeforces handle like this: /connect tourist";
    const info = await site.connect(chatId(ctx), isPrivate(ctx) ? "private" : "group", handle);
    const rating = info.rating != null ? ` (rating ${info.rating})` : "";
    return `✅ Connected ${info.handle}${rating}. I'll skip problems you have solved from now on.`;
  };

  const meAction = (ctx) => async () => {
    const { handles } = await site.me(chatId(ctx));
    return { html: F.meHtml(handles) };
  };

  // ---- commands -------------------------------------------------------------------------------------------------
  bot.command("start", (ctx) => {
    if (!isPrivate(ctx)) return replyHtml(ctx, "👥 Hi group! An admin sends /enable to get the daily problem and contest alerts here.", { menu: true });
    return act(
      ctx,
      async () => {
        const data = await site.start(chatId(ctx));
        const name = ctx.from?.first_name ?? "there";
        const intro = data.created ? "🎉 Welcome aboard!" : "👋 Welcome back!";
        const daily = data.text ?? "🌧️ Codeforces is not answering right now. Try /daily in a few minutes.";
        return { html: `${toHtml(T.WELCOME.replace("{name}", name))}\n\n${intro}\n\n${toHtml(daily)}` };
      },
      { menu: true },
    );
  });

  bot.command(["help", "menu"], (ctx) => replyHtml(ctx, F.helpHtml(), { menu: true }));
  bot.command("random", (ctx) => act(ctx, randomAction(ctx, ctx.match), { menu: true }));
  bot.command("daily", (ctx) => act(ctx, async () => dailyOut(await site.daily(chatId(ctx))), { menu: true }));
  bot.command("contests", (ctx) => act(ctx, contestsAction(ctx), { menu: true }));
  bot.command("next", (ctx) => act(ctx, nextAction(ctx), { menu: true }));
  bot.command("connect", (ctx) => act(ctx, connectAction(ctx, ctx.match)));
  bot.command("me", (ctx) => act(ctx, meAction(ctx), { menu: true }));

  bot.command("disconnect", (ctx) =>
    act(ctx, async () => {
      const handle = ctx.match ? T.parseHandle(ctx.match) : null;
      if (ctx.match && !handle) return "✏️ That is not a valid handle. Example: /disconnect tourist";
      const { removed } = await site.disconnect(chatId(ctx), handle ?? undefined);
      return removed ? "🧾 Disconnected." : "🧾 Nothing to disconnect here.";
    }),
  );

  bot.command("enable", async (ctx) => {
    if (isPrivate(ctx)) return reply(ctx, "👥 /enable works in a group chat.");
    if (!(await isGroupAdmin(ctx))) return reply(ctx, T.NOT_ADMIN);
    return act(ctx, async () => {
      await site.group(chatId(ctx), true);
      return "👥 Enabled! The daily problem and contest alerts will show up here. Admins can /disable any time.";
    }, { menu: true });
  });

  bot.command("disable", async (ctx) => {
    if (isPrivate(ctx)) return reply(ctx, "👥 /disable works in a group chat.");
    if (!(await isGroupAdmin(ctx))) return reply(ctx, T.NOT_ADMIN);
    return act(ctx, async () => {
      await site.group(chatId(ctx), false);
      return "🛑 Group messages are off. An admin can /enable them again.";
    });
  });

  bot.command("notify", async (ctx) => {
    const parsed = T.parseNotify(ctx.match);
    if (!parsed) return reply(ctx, "⚙️ Use: /notify daily on, /notify daily off, /notify contests on, or /notify contests off.");
    if (!isPrivate(ctx) && !(await isGroupAdmin(ctx))) return reply(ctx, T.NOT_ADMIN);
    const [what, on] = parsed;
    return act(ctx, async () => {
      await site.settings(chatId(ctx), what === "daily" ? { dailyCf: on } : { contestAlerts: on });
      return `⚙️ ${on ? "Turned on" : "Turned off"} ${what === "daily" ? "the daily problem" : "contest alerts"}.`;
    });
  });

  bot.command("stop", (ctx) =>
    act(ctx, async () => ((await site.stop(chatId(ctx))).stopped ? "🛑 Stopped. Send /start whenever you want me back." : "📭 You were not subscribed.")),
  );

  // ---- classroom tools (group chats) ----------------------------------------------------------------------------
  bot.command("roster", async (ctx) => {
    if (!inGroup(ctx)) return reply(ctx, "👥 /roster works in your group chat.");
    let parsed;
    try {
      parsed = T.parseRoster(ctx.match);
    } catch (error) {
      return reply(ctx, `⚠️ ${error.message}`);
    }
    if (parsed.action !== "list" && !(await isGroupAdmin(ctx))) return reply(ctx, T.NOT_ADMIN);
    return act(ctx, async () => {
      const data = await site.roster(chatId(ctx), parsed.action, parsed.handles);
      return { html: F.meHtml(data.handles.map((handle) => ({ handle, rating: null, solved: 0 }))).replace("Connected handles", `Roster (${data.count})`) };
    });
  });

  bot.command("setdaily", async (ctx) => {
    if (!inGroup(ctx)) return reply(ctx, "👥 /setdaily works in your group chat.");
    if (!(await isGroupAdmin(ctx))) return reply(ctx, T.NOT_ADMIN);
    let parsed;
    try {
      parsed = T.parseSetDaily(ctx.match);
    } catch (error) {
      return reply(ctx, `⚠️ ${error.message}`);
    }
    return act(ctx, async () => {
      const data = await site.groupProblem(chatId(ctx), parsed.problem);
      if (!data.ref) return "📌 Reset. The group uses the default daily problem again.";
      return `📌 Set: ${data.name} (${data.ref}). Send /daily to post it now. The scheduled message uses it from tomorrow.`;
    });
  });

  bot.command(["report", "unsolved"], (ctx) => {
    if (!inGroup(ctx)) return reply(ctx, "📋 /report works in your group chat, where your students are.");
    return act(ctx, async () => ({ html: F.reportHtml(await site.groupReport(chatId(ctx))) }));
  });

  // ---- keyboard buttons (private chats only: Telegram does not deliver taps from groups to bots) ----------------
  bot.hears(Object.keys(T.KEYBOARD_BUTTONS), (ctx) => {
    if (!isPrivate(ctx)) return undefined;
    const handlers = {
      random: () => act(ctx, randomAction(ctx, ""), { menu: true }),
      daily: () => act(ctx, async () => dailyOut(await site.daily(chatId(ctx))), { menu: true }),
      contests: () => act(ctx, contestsAction(ctx), { menu: true }),
      next: () => act(ctx, nextAction(ctx), { menu: true }),
      connect: () => reply(ctx, "🔗 Send your Codeforces handle like this:\n/connect tourist", { menu: true }),
      me: () => act(ctx, meAction(ctx), { menu: true }),
      settings: () => reply(ctx, T.SETTINGS_GUIDE, { menu: true }),
      groups: () => reply(ctx, T.GROUP_GUIDE, { menu: true }),
      help: () => replyHtml(ctx, F.helpHtml(), { menu: true }),
    };
    return handlers[T.KEYBOARD_BUTTONS[ctx.message.text]]();
  });

  return bot;
}
