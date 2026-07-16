import { isAdmin } from "../isAdmin.js";
import { startAwaitingBroadcast } from "../../store/broadcastState.js";
import { log } from "../../logger.js";

export async function handleBlast(ctx) {
  if (!isAdmin(ctx)) {
    log("blast", `unauthorized /blast attempt by ${ctx.from.id}`);
    await ctx.reply("This command is only available to the bot admin.");
    return;
  }

  startAwaitingBroadcast();
  await ctx.reply(
    "Send me the message you'd like to broadcast to everyone who's DM'd this bot. I'll show you a preview before sending anything."
  );
}
