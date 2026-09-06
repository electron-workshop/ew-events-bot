import { Markup } from "telegraf";
import { fetchPage } from "../../services/fetchPage.js";
import { eventFromJsonLd } from "../../services/eventFromJsonLd.js";
import { miniAppKeyboard, hasMiniApp } from "../miniApp.js";
import { createPending } from "../../store/pendingEvents.js";
import { setAwaitingLink } from "../../store/awaitingLink.js";
import { formatFieldsSummary } from "../formatEvent.js";
import { log } from "../../logger.js";

const URL_PATTERN = /https?:\/\/\S+/i;

export async function handleAddEvent(ctx) {
  const text = ctx.message.text || "";
  const match = text.match(URL_PATTERN);
  const requester = ctx.from;
  const requesterLabel = requester.username ? `@${requester.username}` : requester.first_name;

  log("add_event", `received from ${requesterLabel} (${requester.id}) in chat ${ctx.chat.id}: "${text}"`);

  if (!match) {
    log("add_event", "no URL in command, waiting for a follow-up message with the link");
    setAwaitingLink(ctx.chat.id, requester.id);
    await ctx.reply("Sure — send me the event link in your next message.");
    return;
  }

  await processEventUrl(ctx, match[0]);
}

export async function processEventUrl(ctx, url) {
  const requester = ctx.from;
  const requesterLabel = requester.username ? `@${requester.username}` : requester.first_name;

  log("add_event", `processing URL: ${url}`);
  const statusMessage = await ctx.reply("Fetching that page and reading the details...");

  log("fetch", `fetching ${url}`);
  const page = await fetchPage(url);

  // The bot reads an event out of the page's own structured data. When a page
  // doesn't publish any, there's nothing to read and no guessing to be done —
  // the app has a form for exactly that, so hand it over rather than failing.
  const extraction = page?.eventJsonLd ? eventFromJsonLd(page.eventJsonLd, url) : null;

  if (!extraction) {
    log("add_event", page ? `no usable structured data on ${url}` : `couldn't fetch ${url}`);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      undefined,
      "That page doesn't publish its event details in a way I can read.\n\n" +
        (hasMiniApp()
          ? "Open the app below and paste the link there — you can fill in the details yourself and it'll go on the same calendar."
          : "Please add this one to the calendar manually for now."),
      miniAppKeyboard(ctx, "Add it in the app")
    );
    return;
  }

  const pendingId = createPending({
    chatId: ctx.chat.id,
    requesterId: requester.id,
    requesterName: requesterLabel,
    sourceUrl: url,
    fields: extraction.fields,
  });
  log("add_event", `created pending ${pendingId}, awaiting confirmation`);

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    statusMessage.message_id,
    undefined,
    `Here's what I found:\n\n${formatFieldsSummary(extraction.fields)}\n\nAdd this to the calendar?`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        Markup.button.callback("Confirm", `confirm:${pendingId}`),
        Markup.button.callback("Edit", `edit:${pendingId}`),
        Markup.button.callback("Cancel", `cancel:${pendingId}`),
      ]),
    }
  );
}
