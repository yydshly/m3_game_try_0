import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const requiredFiles = [
  "index.html",
  "manifest.webmanifest",
  ".env.example",
  ".gitignore",
  "config.example.json",
  "netlify.toml",
  ".nojekyll",
  "scripts/api-check.mjs",
  "scripts/config-check.mjs",
  "scripts/minimax-adapter-check.mjs",
  "scripts/mobile-info.mjs",
  "scripts/remote-info.mjs",
  "scripts/server.mjs",
  "src/app.js",
  "src/styles.css",
  "src/assets/town-scene.svg",
  "src/data/seed.js",
  "src/domain/simulation.js",
  "src/ui/render.js",
];

const missing = requiredFiles.filter((file) => !existsSync(join(root, file)));
if (missing.length > 0) {
  console.error(`Missing files: ${missing.join(", ")}`);
  process.exit(1);
}

const html = readFileSync(join(root, "index.html"), "utf8");
const manifest = JSON.parse(readFileSync(join(root, "manifest.webmanifest"), "utf8"));

if (!html.includes('type="module" src="./src/app.js"')) {
  console.error("index.html does not load src/app.js as a module.");
  process.exit(1);
}

if (!manifest.name || !manifest.start_url || !Array.isArray(manifest.icons)) {
  console.error("manifest.webmanifest is incomplete.");
  process.exit(1);
}

await import("../src/data/seed.js");
await import("../src/domain/simulation.js");
await import("../src/ui/render.js");

console.log("Static release validation passed.");
