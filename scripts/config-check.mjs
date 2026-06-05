// Checks that configuration is reasonable without exposing real keys.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, isAbsolute, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));

function envValue(name) {
  const v = process.env[name];
  return v && v.trim() ? v : null;
}

function loadConfig() {
  const configPath = envValue("CONFIG_PATH")
    ?? normalize(join(root, "config.local.json"));
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    return null;
  }
}

const config = loadConfig();

const apiStyle =
  envValue("MINIMAX_API_STYLE")
  ?? config?.minimax?.apiStyle
  ?? "anthropic";

const model =
  envValue("MINIMAX_MODEL")
  ?? config?.minimax?.model
  ?? "MiniMax-M3";

const hasApiKey = Boolean(
  envValue("MINIMAX_API_KEY")
  ?? envValue("ANTHROPIC_API_KEY")
  ?? config?.minimax?.apiKey
);

const anthropicBaseUrl =
  envValue("ANTHROPIC_BASE_URL")
  ?? envValue("MINIMAX_ANTHROPIC_BASE_URL")
  ?? config?.minimax?.anthropicBaseUrl
  ?? "https://api.minimaxi.com/anthropic";

const openAiBaseUrl =
  envValue("MINIMAX_BASE_URL")
  ?? config?.minimax?.baseUrl
  ?? "https://api.minimax.io/v1";

const anthropicUrlConfigured = Boolean(
  envValue("ANTHROPIC_BASE_URL")
  ?? envValue("MINIMAX_ANTHROPIC_BASE_URL")
  ?? config?.minimax?.anthropicBaseUrl
);

const openAiUrlConfigured = Boolean(
  envValue("MINIMAX_BASE_URL")
  ?? config?.minimax?.baseUrl
);

const output = {
  apiStyle,
  model,
  hasApiKey,
  anthropicBaseUrl: anthropicUrlConfigured ? "(configured)" : "(default)",
  openAiBaseUrl: openAiUrlConfigured ? "(configured)" : "(default)",
};

console.log(JSON.stringify(output, null, 2));

if (!hasApiKey) {
  console.error("MiniMax API key is not configured. AI planning will use manual fallback.");
  process.exit(0); // Not a failure — app works without MiniMax
}
