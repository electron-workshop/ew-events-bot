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
  setAwaitingIssue,
  clearAwaitingIssue,
  getAwaitingIssue,
} from "../../store/awaitingIssue.js";
import {
  addFeedback,
  getFeedback,
  resolveFeedback,
  attributeFeedback,
  cancelFeedback,
  setDraftIssue,
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
function issueFooter(entry) {
  const submittedOn = new Date(entry.createdAt).toISOString().slice(0, 10);
  return `Sent via the Telegram bot on ${submittedOn}. Reference \`${entry.id}\` (sender recorded privately).`;
}

function issueBody(entry, body = entry.text) {
  return [body, "", "---", issueFooter(entry)].join("\n");
}

function adminKeyboard(id) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Create issue", `feedback_file:${id}`),
      Markup.button.callback("Write my own", `feedback_write:${id}`),
    ],
    [Markup.button.callback("Dismiss", `feedback_dismiss:${id}`)],
  ]);
}

// Asks the admin to type the issue. The buttons here are the way out, so the
// admin never has to remember a command to escape compose mode.
async function promptForIssueText(ctx, entry) {
  setAwaitingIssue(ctx.chat.id, ctx.from.id, entry.id);
  log("feedback", `${entry.id} being written by admin`);

  await ctx.reply(
    "Send the issue as you want it — first line is the title, everything after is the body.\n\n" +
      "Filing it unchanged would give:\n\n" +
      `Title: ${issueTitle(entry.text)}\n\n${entry.text}`,
    Markup.inlineKeyboard([
      [Markup.button.callback("File unchanged instead", `feedback_file:${entry.id}`)],
      [Markup.button.callback("Dismiss", `feedback_dismiss:${entry.id}`)],
    ])
  );
}

// Shows exactly what will be created, because filing is irreversible from
// here — the bot has no way to delete an issue afterwards.
async function previewIssue(ctx, entry, { title, body }) {
  await ctx.reply(
    `Here's the issue I'll create:\n\n${title}\n\n${issueBody(entry, body)}`,
    Markup.inlineKeyboard([
      [Markup.button.callback("Create issue", `issue_confirm:${entry.id}`)],
      [Markup.button.callback("Rewrite", `issue_rewrite:${entry.id}`)],
      [Markup.button.callback("Dismiss", `feedback_dismiss:${entry.id}`)],
    ])
  );
}

// Shared by the file-as-is and write-your-own paths. Leaves the feedback
// pending when GitHub refuses, so the admin can fix the token and tap again.
async function fileIssue(ctx, entry, { title, body }) {
  let issue;
  try {
    issue = await createIssue({ title, body, labels: ["feedback"] });
  } catch (error) {
    log("feedback", `${entry.id} failed to file: ${error.message}`);
    await ctx.reply(`Couldn't create the issue: ${error.message}`);
    return null;
  }

  resolveFeedback(entry.id, { status: "filed", issueUrl: issue.html_url });
  await ctx.reply(`Filed as issue #${issue.number}: ${issue.html_url}`);
  return issue;
}

// Telegram button labels have to stay short, and a display name can be
// anything at all.
const BUTTON_LABEL_MAX = 24;

function shortLabel(label) {
  return label.length > BUTTON_LABEL_MAX ? `${label.slice(0, BUTTON_LABEL_MAX - 1)}…` : label;
}

// Step one: the sender decides whether the admin sees who they are. Nothing has
// been passed on at this point — the entry is only a draft.
function askWhoToSendAs(entry) {
  return {
    text:
      `Here's what I'll pass on:\n\n${entry.text}\n\n` +
      `Send it with your name, or anonymously? Either way your name never goes on a GitHub issue.`,
    keyboard: Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `Send as ${shortLabel(entry.from.label)}`,
          `fb_who:${entry.id}:named`
        ),
        Markup.button.callback("Send anonymously", `fb_who:${entry.id}:anon`),
      ],
      [Markup.button.callback("Cancel", `fb_cancel:${entry.id}`)],
    ]),
  };
}

// Step two, because these buttons sit next to each other and the choice can't
// be taken back once the admin has read it.
function askToConfirm(entry, anonymous) {
  const who = anonymous ? "anonymously" : `as ${entry.from.label}`;
  return {
    text: `Send this to the EW team ${who}?\n\n${entry.text}`,
    keyboard: Markup.inlineKeyboard([
      [Markup.button.callback(`Yes, send ${who}`, `fb_send:${entry.id}:${anonymous ? "anon" : "named"}`)],
      [Markup.button.callback("Back", `fb_back:${entry.id}`)],
      [Markup.button.callback("Cancel", `fb_cancel:${entry.id}`)],
    ]),
  };
}

function adminMessage(entry) {
  const who = entry.anonymous ? "Feedback (sent anonymously)" : `Feedback from ${entry.from.label}`;
  return `💬 ${who}:\n\n${entry.text}\n\nFile this as a GitHub issue?`;
}

// Takes what someone wrote and offers them the choice. Messages here go out
// without a parse_mode — the text is user-written and would otherwise be able
// to break the message.
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
  log("feedback", `${entry.id} drafted by ${label} (${ctx.from.id}), awaiting their choice`);

  const { text: prompt, keyboard } = askWhoToSendAs(entry);
  await ctx.reply(prompt, keyboard);
}

// Captures the admin's next message after they tap "Write my own". Registered
// before the feedback compose handler, so an admin who is somehow in both
// states finishes the issue they were writing.
export function registerIssueComposeHandler(bot) {
  bot.on("text", async (ctx, next) => {
    const feedbackId = getAwaitingIssue(ctx.chat.id, ctx.from.id);
    if (!feedbackId || !isAdmin(ctx)) return next();

    const text = ctx.message.text.trim();
    if (/^\/cancel\b/i.test(text)) {
      clearAwaitingIssue(ctx.chat.id, ctx.from.id);
      await ctx.reply("Left it pending — the buttons above still work.");
      return;
    }

    const entry = getFeedback(feedbackId);
    if (!entry || entry.status !== "pending") {
      clearAwaitingIssue(ctx.chat.id, ctx.from.id);
      await ctx.reply("That feedback isn't waiting any more.");
      return;
    }

    const lines = text.split("\n");
    const title = lines[0].trim();
    const body = lines.slice(1).join("\n").trim();
    if (!title) {
      await ctx.reply("The first line needs to be the issue title. Try again.");
      return;
    }

    // Held, not filed — the admin confirms from the preview. Compose mode ends
    // here so their next message isn't swallowed as another attempt.
    clearAwaitingIssue(ctx.chat.id, ctx.from.id);
    const draft = { title, body: body || entry.text };
    setDraftIssue(entry.id, draft);
    log("feedback", `${entry.id} has an admin-written issue awaiting confirmation`);
    await previewIssue(ctx, entry, draft);
  });
}

// Captures the admin's or user's next message after a bare /feedback.
export function registerFeedbackComposeHandler(bot) {
  bot.on("text", async (ctx, next) => {
    if (!isAwaitingFeedback(ctx.chat.id, ctx.from.id)) return next();

    clearAwaitingFeedback(ctx.chat.id, ctx.from.id);
    await submitFeedback(ctx, ctx.message.text);
  });
}

// The buttons the *sender* sees, deciding how their feedback is attributed.
// Only the person who wrote it may touch these.
export function registerFeedbackChoiceHandlers(bot) {
  async function ownDraft(ctx, id) {
    const entry = getFeedback(id);
    if (!entry || String(entry.from.id) !== String(ctx.from.id)) {
      await answerCb(ctx, "That's not yours to send.");
      return null;
    }
    if (entry.status !== "draft") {
      await answerCb(ctx, entry.status === "cancelled" ? "Already cancelled." : "Already sent.");
      return null;
    }
    return entry;
  }

  bot.action(/^fb_who:([^:]+):(named|anon)$/, async (ctx) => {
    const entry = await ownDraft(ctx, ctx.match[1]);
    if (!entry) return;

    await answerCb(ctx);
    const { text, keyboard } = askToConfirm(entry, ctx.match[2] === "anon");
    await ctx.editMessageText(text, keyboard).catch(async () => {
      await ctx.reply(text, keyboard);
    });
  });

  bot.action(/^fb_back:(.+)$/, async (ctx) => {
    const entry = await ownDraft(ctx, ctx.match[1]);
    if (!entry) return;

    await answerCb(ctx);
    const { text, keyboard } = askWhoToSendAs(entry);
    await ctx.editMessageText(text, keyboard).catch(async () => {
      await ctx.reply(text, keyboard);
    });
  });

  bot.action(/^fb_cancel:(.+)$/, async (ctx) => {
    const entry = await ownDraft(ctx, ctx.match[1]);
    if (!entry) return;

    cancelFeedback(entry.id);
    log("feedback", `${entry.id} cancelled by its sender`);
    await answerCb(ctx, "Cancelled.");
    await ctx.editMessageText("Cancelled — nothing was sent.").catch(() => {});
  });

  bot.action(/^fb_send:([^:]+):(named|anon)$/, async (ctx) => {
    const draft = await ownDraft(ctx, ctx.match[1]);
    if (!draft) return;

    const anonymous = ctx.match[2] === "anon";
    const entry = attributeFeedback(draft.id, { anonymous });
    log("feedback", `${entry.id} sent ${anonymous ? "anonymously" : `as ${entry.from.label}`}`);

    await answerCb(ctx, "Sent.");
    await ctx.editMessageText(`Thanks — passed on to the EW team. 🙏`).catch(() => {});

    if (!config.adminChatId) {
      log("feedback", `${entry.id} stored, but ADMIN_CHAT_ID isn't set so nobody was notified`);
      return;
    }

    await ctx.telegram.sendMessage(config.adminChatId, adminMessage(entry), adminKeyboard(entry.id));
  });
}

export function registerFeedbackActionHandlers(bot) {
  async function pendingForAdmin(ctx, id) {
    if (!isAdmin(ctx)) {
      await answerCb(ctx);
      return null;
    }

    const entry = getFeedback(id);
    if (!entry) {
      await answerCb(ctx, "That feedback is no longer available.");
      return null;
    }
    if (entry.status !== "pending") {
      await answerCb(ctx, `Already ${entry.status}.`);
      return null;
    }
    return entry;
  }

  bot.action(/^feedback_file:(.+)$/, async (ctx) => {
    const entry = await pendingForAdmin(ctx, ctx.match[1]);
    if (!entry) return;

    await answerCb(ctx, "Creating the issue...");
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    // Reachable from the compose prompt, so make sure the admin isn't left
    // waiting to type an issue that's already been filed.
    clearAwaitingIssue(ctx.chat.id, ctx.from.id);
    await fileIssue(ctx, entry, {
      title: issueTitle(entry.text),
      body: issueBody(entry),
    });
  });

  // Lets the admin rewrite the issue before it's filed. Useful when the
  // feedback is rambling, or when the first line — which would otherwise
  // become the title — has the sender's name in it.
  bot.action(/^feedback_write:(.+)$/, async (ctx) => {
    const entry = await pendingForAdmin(ctx, ctx.match[1]);
    if (!entry) return;

    await answerCb(ctx);
    // Take the buttons off the message being answered, so there's only ever
    // one live set of buttons for this piece of feedback.
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await promptForIssueText(ctx, entry);
  });

  bot.action(/^issue_rewrite:(.+)$/, async (ctx) => {
    const entry = await pendingForAdmin(ctx, ctx.match[1]);
    if (!entry) return;

    await answerCb(ctx);
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await promptForIssueText(ctx, entry);
  });

  bot.action(/^issue_confirm:(.+)$/, async (ctx) => {
    const entry = await pendingForAdmin(ctx, ctx.match[1]);
    if (!entry) return;

    if (!entry.draftIssue) {
      await answerCb(ctx, "Nothing written yet.");
      return;
    }

    await answerCb(ctx, "Creating the issue...");
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    clearAwaitingIssue(ctx.chat.id, ctx.from.id);
    await fileIssue(ctx, entry, {
      title: entry.draftIssue.title,
      body: issueBody(entry, entry.draftIssue.body),
    });
  });

  bot.action(/^feedback_dismiss:(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) {
      await answerCb(ctx);
      return;
    }

    const entry = getFeedback(ctx.match[1]);
    if (entry) resolveFeedback(entry.id, { status: "dismissed" });
    log("feedback", `${ctx.match[1]} dismissed by ${ctx.from.id}`);

    clearAwaitingIssue(ctx.chat.id, ctx.from.id);
    await answerCb(ctx, "Dismissed.");
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
  });
}
