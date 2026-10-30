// The grammY bot. It holds no state of its own: every fact lives on the website (the database), so no session storage is needed.
import { Bot, GrammyError, Keyboard } from "grammy";
import { SiteError } from "./site.js";
import { toHtml } from "./render.js";
import * as T from "./texts.js";

export const ADMIN = ["creator", "administrator"];

function keyboard() {
  return new Keyboard()
    .text("🎲 Random").text("📅 Daily").text("🏆 Contests").row()
    .text("🔗 Connect").text("👤 My Handles").text("⚙️ Settings").row()
    .text("👥 Groups").text("❓ Help")
    .resized()
    .persistent();
}

export function createBot({ token, site, botInfo }) {
  // botInfo lets a serverless function skip the getMe call on every cold start, when it is known in advance.
  const bot = new Bot(token, botInfo ? { botInfo } : {});

  // Logs the error class only. Message text, chat ids and tokens never reach the logs.
  bot.catch((error) => {
    console.error("update failed:", error.error?.name ?? "unknown");
  });

  const isPrivate = (ctx) => ctx.chat?.type === "private";

  async function reply(ctx, text, { menu = false } = {}) {
    return ctx.reply(toHtml(text), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: menu && isPrivate(ctx) ? keyboard() : undefined,
    });
  }

  // Runs one action. A website error becomes a friendly line; anything unexpected becomes the generic line.
  async function act(ctx, action, { menu = false } = {}) {
    try {
      return await reply(ctx, await action(), { menu });
    } catch (error) {
      if (error instanceof SiteError) return reply(ctx, T.errorText(error.code), { menu });
      console.error("action failed:", error?.name ?? "unknown");
      return reply(ctx, T.GENERIC, { menu });
    }
  }

  async function isGroupAdmin(ctx) {
    const member = await ctx.getAuthor();
    return ADMIN.includes(member.status);
  }

  const chatId = (ctx) => String(ctx.chat.id);

  const randomAction = (ctx, args) => async () => {
    let filter;
    try {
      filter = T.parseRandom(args);
    } catch (error) {
      return `⚠️ ${error.message}\n\n🎲 Try: /random 1200-1600 dp graphs`;
    }
    const data = await site.random(chatId(ctx), filter);
    if (data.text) return data.text;
    return { no_match: T.NO_MATCH, all_solved: T.ALL_SOLVED }[data.reason] ?? T.GENERIC;
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
    if (!handles?.length) return "👤 No handles connected yet. Use /connect <handle>.";
    const lines = handles.map((h) => `• ${h.handle} · rating ${h.rating ?? "unrated"} · ${h.solved} solved`);
    return ["👤 Connected handles", ...lines].join("\n");
  };

  // ---- commands -----------------------------------------------------------
  bot.command("start", (ctx) => {
    if (!isPrivate(ctx)) return reply(ctx, "👥 Hi group! An admin sends /enable to get the daily problem and contest alerts here.", { menu: true });
    return act(
      ctx,
      async () => {
        const data = await site.start(chatId(ctx));
        const name = ctx.from?.first_name ?? "there";
        const intro = data.created ? "🎉 Welcome aboard!" : "👋 Welcome back!";
        return `${T.WELCOME.replace("{name}", name)}\n\n${intro}\n\n${data.text ?? "🌧️ Codeforces is not answering right now. Try /daily in a few minutes."}`;
      },
      { menu: true },
    );
  });

  bot.command(["help", "menu"], (ctx) => reply(ctx, T.HELP_TEXT, { menu: true }));
  bot.command("random", (ctx) => act(ctx, randomAction(ctx, ctx.match), { menu: true }));
  bot.command("daily", (ctx) => act(ctx, async () => (await site.daily(chatId(ctx))).text ?? T.GENERIC, { menu: true }));
  bot.command("contests", (ctx) => act(ctx, async () => (await site.contests(chatId(ctx))).text ?? T.GENERIC, { menu: true }));
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

  // ---- classroom tools (group chats) --------------------------------------------------------------------------
  const inGroup = (ctx) => ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";

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
      return `📋 Roster (${data.count}): ${data.handles.length ? data.handles.join(", ") : "empty"}`;
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

  bot.command(["report", "unsolved"], async (ctx) => {
    if (!inGroup(ctx)) return reply(ctx, "📋 /report works in your group chat, where your students are.");
    return act(ctx, async () => T.formatReport(await site.groupReport(chatId(ctx))));
  });

  // ---- keyboard buttons (private chats only: Telegram does not deliver taps from groups to bots) ----
  bot.hears(Object.keys(T.KEYBOARD_BUTTONS), (ctx) => {
    if (!isPrivate(ctx)) return;
    const action = T.KEYBOARD_BUTTONS[ctx.message.text];
    const handlers = {
      random: () => act(ctx, randomAction(ctx, ""), { menu: true }),
      daily: () => act(ctx, async () => (await site.daily(chatId(ctx))).text ?? T.GENERIC, { menu: true }),
      contests: () => act(ctx, async () => (await site.contests(chatId(ctx))).text ?? T.GENERIC, { menu: true }),
      connect: () => reply(ctx, "🔗 Send your Codeforces handle like this:\n/connect tourist", { menu: true }),
      me: () => act(ctx, meAction(ctx), { menu: true }),
      settings: () => reply(ctx, T.SETTINGS_GUIDE, { menu: true }),
      groups: () => reply(ctx, T.GROUP_GUIDE, { menu: true }),
      help: () => reply(ctx, T.HELP_TEXT, { menu: true }),
    };
    return handlers[action]();
  });

  return bot;
}
