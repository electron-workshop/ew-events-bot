# The bot is a long-running poller — no ports, only outbound calls to
# api.telegram.org and Google.
FROM node:22-alpine

WORKDIR /app

# Dependencies first so a code-only change doesn't reinstall them.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY CHANGELOG.md ./

ENV NODE_ENV=production

# Who has messaged the bot, everyone's reminders, and feedback waiting to be
# triaged all live here. Mount a volume at this path — without one, a redeploy
# starts the bot with no idea who its users are.
ENV DATA_DIR=/app/data
VOLUME ["/app/data"]

CMD ["node", "src/index.js"]
