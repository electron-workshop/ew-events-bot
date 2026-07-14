export async function handleStart(ctx) {
  await ctx.reply(
    "⚡ Welcome to the Electron Ecosystem!\n\n" +
      "Send me a link to an event and I'll add it to the shared EW calendar. Two ways to do it:\n" +
      "• /add_event <link>\n" +
      "• Just /add_event, and I'll wait for you to send the link next.\n\n" +
      "I'll show you what I found before adding anything, so you always get to confirm first."
  );
}
