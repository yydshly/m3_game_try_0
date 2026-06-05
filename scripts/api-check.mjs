import { spawn } from "node:child_process";

const port = 4184;
const server = spawn(process.execPath, ["scripts/server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, PORT: String(port), CONFIG_PATH: "__missing_config_for_api_check.json", MINIMAX_API_KEY: "" },
  stdio: ["ignore", "ignore", "pipe"],
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithRetry(url) {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: { residents: [] } }),
      });
      return {
        status: response.status,
        body: await response.json(),
      };
    } catch (error) {
      lastError = error;
      await wait(100);
    }
  }
  throw lastError;
}

try {
  const result = await postWithRetry(`http://127.0.0.1:${port}/api/minimax/plan`);
  if (result.status !== 501 || !result.body.error?.includes("MiniMax API key is not configured")) {
    console.error(result);
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  server.kill();
}
