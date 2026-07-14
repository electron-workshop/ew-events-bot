import { Markup } from "telegraf";
import { fetchPageText } from "../../services/fetchPage.js";
import { extractEvent } from "../../services/extractEvent.js";
import { createPending } from "../../store/pendingEvents.js";
import { formatFieldsSummary } from "../formatEvent.js";

const URL_PATTERN = /https?:\/\/\S+/i;

export async function handleAddEvent(ctx) {
  const text = ctx.message.text || "";
  const match = text.match(URL_PATTERN);

  if (!match) {
    await ctx.reply("Usage: /add_event <link to the event page>");
    return;
  }

  const url = match[0];
  const statusMessage = await ctx.reply("Fetching that page and reading the details...");

  const pageText = await fetchPageText(url);
  if (!pageText) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      undefined,
      "I couldn't read that page automatically (it may need JavaScript to load, or didn't respond). " +
        "Manual paste/screenshot submission isn't wired up yet — please add this event manually for now, or try a different link (e.g. a plain event page instead of a social media post)."
    );
    return;
  }

  let extraction;
  try {
    extraction = await extractEvent(pageText, url);
  } catch (error) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      undefined,
      `Something went wrong extracting the details (${error.message}). Please try again in a moment.`
    );
    return;
  }

  if (!extraction.complete) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      undefined,
      "I could read the page but couldn't find enough detail (at least a title and date) to create an event. " +
        "Please add this one manually for now."
    );
    return;
  }

  const requester = ctx.from;
  const pendingId = createPending({
    chatId: ctx.chat.id,
    requesterId: requester.id,
    requesterName: requester.username ? `@${requester.username}` : requester.first_name,
    sourceUrl: url,
    fields: extraction.fields,
  });

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
