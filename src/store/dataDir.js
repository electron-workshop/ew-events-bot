import path from "node:path";
import { fileURLToPath } from "node:url";

// Where the bot's few JSON files live. It's an env var because in a container
// the app directory is rebuilt on every deploy — pointing DATA_DIR at a mounted
// volume is what stops a redeploy from wiping who has messaged the bot, every
// reminder anyone has set, and any feedback waiting to be triaged.
//
// Unset, it falls back to src/data/ next to the code, which is right for
// running straight on a VM.
const DEFAULT_DIR = fileURLToPath(new URL("../data/", import.meta.url));

export const dataDir = process.env.DATA_DIR || DEFAULT_DIR;

/** Absolute path to one of the bot's data files. */
export function dataFile(name) {
  return path.join(dataDir, name);
}
