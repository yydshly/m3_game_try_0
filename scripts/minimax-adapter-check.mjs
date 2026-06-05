import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createInitialState } from "../src/domain/state.js";

const upstreamPort = 5184;
const appPort = 4185;

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

const upstream = createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/chat/completions") {
    sendJson(response, 404, { error: "not found" });
    return;
  }

  sendJson(response, 200, {
    model: "fake-minimax",
    choices: [
      {
        message: {
          content:
            '<think>Planning privately.</think>\n```json\n{"assignments":[{"residentId":"hua","taskId":"plant","reason":"She likes the garden and can lift comfort."},{"residentId":"yuan","taskId":"repair","reason":"Repairs match his craft role."}],"townNote":"MiniMax suggests comfort first."}\n```',
        },
      },
    ],
  });
});

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithRetry(url, body) {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
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

await listen(upstream, upstreamPort);

const app = spawn(process.execPath, ["scripts/server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    PORT: String(appPort),
    CONFIG_PATH: "__missing_config_for_minimax_adapter_check.json",
    MINIMAX_API_KEY: "fake-key",
    MINIMAX_BASE_URL: `http://127.0.0.1:${upstreamPort}`,
    MINIMAX_MODEL: "fake-minimax",
  },
  stdio: ["ignore", "ignore", "pipe"],
});

try {
  const result = await postWithRetry(`http://127.0.0.1:${appPort}/api/minimax/plan`, {
    state: createInitialState(),
  });

  const assignments = result.body.assignments ?? [];
  const ids = new Set(assignments.map((assignment) => assignment.residentId));
  const hasFallback = assignments.some((assignment) => assignment.reason.includes("Fallback assignment"));

  if (result.status !== 200 || assignments.length !== 5 || ids.size !== 5 || !hasFallback) {
    console.error(result);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: result.status,
        assignments: assignments.length,
        provider: result.body.provider,
        model: result.body.model,
        fallbackCovered: hasFallback,
      },
      null,
      2,
    ),
  );
} finally {
  app.kill();
  upstream.close();
}
