// Validates both Anthropic and OpenAI MiniMax adapter paths.
// Does NOT call real external APIs — all servers are local mocks.

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createInitialState } from "../src/domain/state.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const APP_ANTH_PORT = 5195;
const APP_OAI_PORT = 5198;
const UP_ANTH_PORT = 5196;
const UP_OAI_PORT = 5197;

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function postWithRetry(url, body) {
  for (let i = 0; i < 60; i++) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: resp.status, body: await resp.json() };
    } catch {
      await wait(100);
    }
  }
  throw new Error("Could not connect to app server");
}

function startServer(server, port) {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

async function run() {
  // --- Anthropic mock upstream ---
  const anthUp = createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      content: [{
        type: "text",
        text: JSON.stringify({
          assignments: [
            { residentId: "hua", taskId: "plant", reason: "Garden comfort." },
            { residentId: "yuan", taskId: "repair", reason: "Craft match." },
            { residentId: "mimi", taskId: "cook", reason: "Cook role." },
            { residentId: "zhou", taskId: "chat", reason: "Social match." },
            { residentId: "seven", taskId: "forage", reason: "Explorer match." },
          ],
          townNote: "Anthropic plan for all residents.",
        }),
      }],
    }));
  });

  // --- OpenAI mock upstream ---
  const oaiUp = createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      model: "MiniMax-M2.1",
      choices: [{
        message: {
          content: JSON.stringify({
            assignments: [
              { residentId: "hua", taskId: "plant", reason: "Garden comfort." },
              { residentId: "yuan", taskId: "repair", reason: "Craft match." },
              { residentId: "mimi", taskId: "cook", reason: "Cook role." },
              { residentId: "zhou", taskId: "chat", reason: "Social match." },
              { residentId: "seven", taskId: "forage", reason: "Explorer match." },
            ],
            townNote: "OpenAI plan for all residents.",
          }),
        },
      }],
    }));
  });

  await startServer(anthUp, UP_ANTH_PORT);
  await startServer(oaiUp, UP_OAI_PORT);

  const state = createInitialState();

  // --- Test Anthropic path ---
  const appAnth = spawn(process.execPath, ["scripts/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(APP_ANTH_PORT),
      MINIMAX_API_KEY: "fake-anth-key",
      MINIMAX_MODEL: "MiniMax-M3",
      MINIMAX_API_STYLE: "anthropic",
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${UP_ANTH_PORT}`,
      CONFIG_PATH: "__missing",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let anthResult;
  try {
    anthResult = await postWithRetry(`http://127.0.0.1:${APP_ANTH_PORT}/api/minimax/plan`, { state });
  } finally {
    appAnth.kill();
  }

  await wait(800);

  // --- Test OpenAI path ---
  const appOai = spawn(process.execPath, ["scripts/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(APP_OAI_PORT),
      MINIMAX_API_KEY: "fake-oai-key",
      MINIMAX_MODEL: "MiniMax-M2.1",
      MINIMAX_API_STYLE: "openai",
      MINIMAX_BASE_URL: `http://127.0.0.1:${UP_OAI_PORT}`,
      CONFIG_PATH: "__missing",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let oaiResult;
  try {
    oaiResult = await postWithRetry(`http://127.0.0.1:${APP_OAI_PORT}/api/minimax/plan`, { state });
  } finally {
    appOai.kill();
  }

  anthUp.close();
  oaiUp.close();

  // --- Validate ---
  const anth = anthResult.body;
  const anthAssignments = anth.assignments ?? [];
  const anthOk =
    anthResult.status === 200 &&
    anthAssignments.length === 5 &&
    anthAssignments.every((a) => a.residentId && a.taskId) &&
    anth.apiStyle === "anthropic" &&
    anth.provider === "minimax";

  const oai = oaiResult.body;
  const oaiAssignments = oai.assignments ?? [];
  const oaiOk =
    oaiResult.status === 200 &&
    oaiAssignments.length === 5 &&
    oaiAssignments.every((a) => a.residentId && a.taskId) &&
    oai.apiStyle === "openai" &&
    oai.provider === "minimax";

  const output = {
    anthropic: { httpStatus: anthResult.status, assignments: anthAssignments.length, apiStyle: anth.apiStyle, provider: anth.provider, ok: anthOk },
    openai: { httpStatus: oaiResult.status, assignments: oaiAssignments.length, apiStyle: oai.apiStyle, provider: oai.provider, ok: oaiOk },
    allOk: anthOk && oaiOk,
  };

  console.log(JSON.stringify(output, null, 2));
  if (!anthOk || !oaiOk) {
    console.error("FAILED: one or both API styles did not return valid plans");
    process.exit(1);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
