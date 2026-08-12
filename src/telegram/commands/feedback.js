import { setAwaitingFeedback } from "../../store/awaitingFeedback.js";
import { isRateLimited, RATE_LIMIT } from "../../store/pendingFeedback.js";
import { isGithubConfigured } from "../../services/github.js";
import { submitFeedback } from "../handlers/feedback.js";
import { config } from "../../config.js";
import { log } from "../../logger.js";

export async function handleFeedback(ctx) {
  const text = (ctx.message.text || "").replace(/^\/feedback(@\S+)?\s*/i, "").trim();

  // Without an admin to approve it, nothing would ever reach GitHub — better
  // to say so than to promise it was passed on.
  if (!isGithubConfigured() || !config.adminChatId) {
    log("feedback", "/feedback used but GITHUB_TOKEN or ADMIN_CHAT_ID isn't configured");
    await ctx.reply("Feedback isn't set up yet — please pass it on to the EW team directly.");
    return;
  }

  if (isRateLimited(ctx.from.id)) {
    log("feedback", `rate limited ${ctx.from.id}`);
    await ctx.reply(
      `You've sent ${RATE_LIMIT} pieces of feedback in the last hour — give it a bit before sending more.`
    );
    return;
  }

  if (text) {
    await submitFeedback(ctx, text);
    return;
  }

  setAwaitingFeedback(ctx.chat.id, ctx.from.id);
  await ctx.reply(
    "What's on your mind? Send it in your next message — a bug, an idea, anything.\n\n" +
      "The EW team sees your Telegram username. If it becomes a GitHub issue, your name isn't included — " +
      "so avoid putting anything personal in the message itself."
  );
}
