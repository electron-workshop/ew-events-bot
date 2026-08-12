import { Markup } from "telegraf";
import { config } from "../../config.js";
import { isAdmin } from "../isAdmin.js";
import { answerCb } from "../answerCb.js";
import { createIssue } from "../../services/github.js";
import {
  isAwaitingFeedback,
  clearAwaitingFeedback,
} from "../../store/awaitingFeedback.js";
import {
  addFeedback,
  getFeedback,
  resolveFeedback,
  isRateLimited,
  RATE_LIMIT,
} from "../../store/pendingFeedback.js";
import { log } from "../../logger.js";

const TITLE_MAX = 60;

function issueTitle(text) {
  const firstLine = text.split("\n").find((line) => line.trim()) || "Feedback from Telegram";
  const trimmed = firstLine.trim();
  return trimmed.length > TITLE_MAX ? `${trimmed.slice(0, TITLE_MAX - 1)}…` : trimmed;
}

// Deliberately identity-free: issues may end up public, and a Telegram username
// (let alone the numeric ID, which a person can't change) would be permanent and
// searchable. Only the date is included — a precise timestamp plus a small group
// of users is enough to work out who sent what. The reference maps back to
// src/data/feedback.json on the server, which is where the sender is recorded.
function issueBody(entry) {
  const submittedOn = new Date(entry.createdAt).toISOString().slice(0, 10);
  return [
    entry.text,
    "",
    "---",
    `Sent via the Telegram bot on ${submittedOn}. Reference \`${entry.id}\` (sender recorded privately).`,
  ].join("\n");
}

// Records the feedback and asks the admin whether to turn it into an issue.
// Messages here go out without a parse_mode — the text is user-written and
// would otherwise be able to break the message.
export async function submitFeedback(ctx, text) {
  if (isRateLimited(ctx.from.id)) {
    log("feedback", `rate limited ${ctx.from.id}`);
    await ctx.reply(
      `You've sent ${RATE_LIMIT} pieces of feedback in the last hour — give it a bit before sending more.`
    );
    return;
  }

  const label = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
  const entry = addFeedback({
    text,
    from: { id: ctx.from.id, label },
    chatId: ctx.chat.id,
  });
  log("feedback", `${entry.id} received from ${label} (${ctx.from.id})`);

  await ctx.reply("Thanks — passed on to the EW team. 🙏");

  if (!config.adminChatId) {
    log("feedback", `${entry.id} stored, but ADMIN_CHAT_ID isn't set so nobody was notified`);
    return;
  }

  await ctx.telegram.sendMessage(
    config.adminChatId,
    `💬 Feedback from ${label}:\n\n${text}\n\nFile this as a GitHub issue?`,
    Markup.inlineKeyboard([
      Markup.button.callback("Create issue", `feedback_file:${entry.id}`),
      Markup.button.callback("Dismiss", `feedback_dismiss:${entry.id}`),
    ])
  );
}

// Captures the admin's or user's next message after a bare /feedback.
export function registerFeedbackComposeHandler(bot) {
  bot.on("text", async (ctx, next) => {
    if (!isAwaitingFeedback(ctx.chat.id, ctx.from.id)) return next();

    clearAwaitingFeedback(ctx.chat.id, ctx.from.id);
    await submitFeedback(ctx, ctx.message.text);
  });
}

export function registerFeedbackActionHandlers(bot) {
  bot.action(/^feedback_file:(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) {
      await answerCb(ctx);
      return;
    }

    const entry = getFeedback(ctx.match[1]);
    if (!entry) {
      await answerCb(ctx, "That feedback is no longer available.");
      return;
    }
    if (entry.status !== "pending") {
      await answerCb(ctx, `Already ${entry.status}.`);
      return;
    }

    await answerCb(ctx, "Creating the issue...");

    let issue;
    try {
      issue = await createIssue({
        title: issueTitle(entry.text),
        body: issueBody(entry),
        labels: ["feedback"],
      });
    } catch (error) {
      log("feedback", `${entry.id} failed to file: ${error.message}`);
      await ctx.reply(`Couldn't create the issue: ${error.message}`);
      return;
    }

    resolveFeedback(entry.id, { status: "filed", issueUrl: issue.html_url });
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await ctx.reply(`Filed as issue #${issue.number}: ${issue.html_url}`);
  });

  bot.action(/^feedback_dismiss:(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) {
      await answerCb(ctx);
      return;
    }

    const entry = getFeedback(ctx.match[1]);
    if (entry) resolveFeedback(entry.id, { status: "dismissed" });
    log("feedback", `${ctx.match[1]} dismissed by ${ctx.from.id}`);

    await answerCb(ctx, "Dismissed.");
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
  });
}
