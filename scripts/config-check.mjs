import { spawn } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInitialState } from "../src/domain/state.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const configPath = join(root, "config.check.local.json");
const upstreamPort = 5194;
const appPort = 4194;

writeFileSync(
  configPath,
  JSON.stringify(
    {
      server: {
        host: "127.0.0.1",
        port: appPort,
      },
      minimax: {
        apiKey: "fake-key-from-config",
        model: "fake-model-from-config",
        baseUrl: `http://127.0.0.1:${upstreamPort}`,
        timeoutMs: 5000,
      },
    },
    null,
    2,
  ),
);

const upstream = await startFakeMiniMax(upstreamPort);
const cleanEnv = { ...process.env };
delete cleanEnv.PORT;
delete cleanEnv.HOST;
delete cleanEnv.MINIMAX_API_KEY;
delete cleanEnv.MINIMAX_BASE_URL;
delete cleanEnv.MINIMAX_MODEL;
delete cleanEnv.MINIMAX_TIMEOUT_MS;

const app = spawn(process.execPath, ["scripts/server.mjs"], {
  cwd: root,
  env: {
    ...cleanEnv,
    CONFIG_PATH: configPath,
  },
  stdio: ["ignore", "ignore", "pipe"],
});

try {
  const result = await postWithRetry(`http://127.0.0.1:${appPort}/api/minimax/plan`, {
    state: createInitialState(),
  });

  if (result.status !== 200 || result.body.model !== "fake-model-from-config" || result.body.assignments?.length !== 5) {
    console.error(result);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: result.status,
        model: result.body.model,
        assignments: result.body.assignments.length,
        configLoaded: true,
      },
      null,
      2,
    ),
  );
} finally {
  app.kill();
  upstream.close();
  rmSync(configPath, { force: true });
}

function startFakeMiniMax(port) {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          model: "fake-model-from-config",
          choices: [
            {
              message: {
                content:
                  '{"assignments":[{"residentId":"hua","taskId":"plant","reason":"Garden comfort."},{"residentId":"yuan","taskId":"repair","reason":"Craft match."},{"residentId":"mimi","taskId":"cook","reason":"Cook role."},{"residentId":"zhou","taskId":"chat","reason":"Social role."},{"residentId":"seven","taskId":"forage","reason":"Explorer role."}],"townNote":"Config based MiniMax plan."}',
              },
            },
          ],
        }),
      );
    });
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
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
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError;
}
