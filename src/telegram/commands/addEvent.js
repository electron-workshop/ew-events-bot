import { Markup } from "telegraf";
import { fetchPageText } from "../../services/fetchPage.js";
import { extractEvent } from "../../services/extractEvent.js";
import { createPending } from "../../store/pendingEvents.js";
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
    log("add_event", "no URL found in message");
    await ctx.reply("Usage: /add_event <link to the event page>");
    return;
  }

  const url = match[0];
  log("add_event", `matched URL: ${url}`);
  const statusMessage = await ctx.reply("Fetching that page and reading the details...");

  log("fetch", `fetching ${url}`);
  const pageText = await fetchPageText(url);
  if (!pageText) {
    log("fetch", `failed or empty result for ${url}`);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      undefined,
      "I couldn't read that page automatically (it may need JavaScript to load, or didn't respond). " +
        "Manual paste/screenshot submission isn't wired up yet — please add this event manually for now, or try a different link (e.g. a plain event page instead of a social media post)."
    );
    return;
  }
  log("fetch", `got ${pageText.length} chars of text from ${url}`);

  let extraction;
  try {
    log("extract", `sending page text to Ollama for ${url}`);
    extraction = await extractEvent(pageText, url);
    log("extract", `result:`, extraction);
  } catch (error) {
    log("extract", `error: ${error.message}`);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      undefined,
      `Something went wrong extracting the details (${error.message}). Please try again in a moment.`
    );
    return;
  }

  if (!extraction.complete) {
    log("extract", "incomplete extraction (missing title or date), stopping");
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      undefined,
      "I could read the page but couldn't find enough detail (at least a title and date) to create an event. " +
        "Please add this one manually for now."
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
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        Markup.button.callback("Confirm", `confirm:${pendingId}`),
        Markup.button.callback("Edit", `edit:${pendingId}`),
        Markup.button.callback("Cancel", `cancel:${pendingId}`),
      ]),
    }
  );
}
