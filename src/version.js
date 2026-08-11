import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Read at startup rather than importing package.json as a module — JSON imports
// still print an experimental warning on Node 22, and this runs once.
const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));

export const version = JSON.parse(readFileSync(pkgPath, "utf8")).version;
