import { log } from "../logger.js";

// answerCbQuery only dismisses the button's loading spinner. It is not worth
// aborting a handler over — a transient ECONNRESET here used to mean the tap
// did nothing at all, because the real work came after it.
export async function answerCb(ctx, text) {
  try {
    await ctx.answerCbQuery(text);
  } catch (error) {
    log("callback", `answerCbQuery failed (continuing): ${error.message}`);
  }
}
