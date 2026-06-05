import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { dirname, extname, isAbsolute, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const config = loadConfig();
const port = Number(envValue("PORT") ?? config.server?.port ?? 4173);
const host = getArgValue("--host") ?? envValue("HOST") ?? config.server?.host ?? "127.0.0.1";
const minimaxApiKey = envValue("MINIMAX_API_KEY") ?? config.minimax?.apiKey ?? "";
const minimaxBaseUrl = envValue("MINIMAX_BASE_URL") ?? config.minimax?.baseUrl ?? "https://api.minimax.io/v1";
const minimaxModel = envValue("MINIMAX_MODEL") ?? config.minimax?.model ?? "MiniMax-M2.1";
const minimaxTimeoutMs = Number(envValue("MINIMAX_TIMEOUT_MS") ?? config.minimax?.timeoutMs ?? 30_000);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function envValue(name) {
  const value = process.env[name];
  return value && value.trim() ? value : null;
}

function loadConfig() {
  const configuredPath = envValue("CONFIG_PATH");
  const configPath = configuredPath
    ? normalize(isAbsolute(configuredPath) ? configuredPath : join(root, configuredPath))
    : normalize(join(root, "config.local.json"));
  if (!existsSync(configPath)) return {};

  try {
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    console.error(`Failed to read config.local.json: ${error.message}`);
    process.exit(1);
  }
}

function getLanUrls() {
  const urls = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        urls.push(`http://${entry.address}:${port}`);
      }
    }
  }
  return urls;
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 120_000) {
      throw new Error("Request body is too large.");
    }
  }
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function buildMiniMaxPrompt(state) {
  return [
    {
      role: "system",
      content:
        "You are the planning brain for a cozy multi-agent town simulation game. Choose one valid task for each resident. Keep choices practical, varied, and consistent with mood, energy, personality, memory, and town needs. Return strict JSON only.",
    },
    {
      role: "user",
      content: JSON.stringify({
        validTaskIds: ["plant", "cook", "repair", "chat", "forage", "rest"],
        taskMeanings: {
          plant: "care for garden, improves comfort",
          cook: "prepare food at cafe, improves mood but uses supplies",
          repair: "repair facilities, improves comfort but uses supplies and energy",
          chat: "socialize at plaza, improves mood and relationship chance",
          forage: "gather supplies in forest, uses energy",
          rest: "recover at cafe",
        },
        requiredSchema: {
          assignments: [{ residentId: "string", taskId: "validTaskId", reason: "short reason under 24 words" }],
          townNote: "one short sentence for the player",
        },
        state,
      }),
    },
  ];
}

function stripThinkTags(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function stripCodeFence(text) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function extractJsonObject(text) {
  const cleaned = stripCodeFence(stripThinkTags(String(text ?? "")));
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("MiniMax response did not contain a JSON object.");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function fallbackTaskForResident(resident, state) {
  if (resident.energy < 30) return "rest";
  if ((state.town?.supplies ?? 0) <= 3) return "forage";
  return resident.preferredTask ?? "chat";
}

function normalizeMiniMaxPlan(rawPlan, state) {
  const residents = Array.isArray(state.residents) ? state.residents : [];
  const allowedResidents = new Set(residents.map((resident) => resident.id));
  const allowedTasks = new Set(["plant", "cook", "repair", "chat", "forage", "rest"]);
  const assignments = Array.isArray(rawPlan.assignments) ? rawPlan.assignments : [];
  const normalized = [];

  for (const assignment of assignments) {
    if (!allowedResidents.has(assignment?.residentId) || !allowedTasks.has(assignment?.taskId)) continue;
    if (normalized.some((item) => item.residentId === assignment.residentId)) continue;
    normalized.push({
      residentId: assignment.residentId,
      taskId: assignment.taskId,
      reason: String(assignment.reason ?? "").slice(0, 160),
    });
  }

  for (const resident of residents) {
    if (normalized.some((item) => item.residentId === resident.id)) continue;
    const taskId = fallbackTaskForResident(resident, state);
    normalized.push({
      residentId: resident.id,
      taskId,
      reason: "Fallback assignment because MiniMax did not return a valid task for this resident.",
    });
  }

  return {
    assignments: normalized,
    townNote: String(rawPlan.townNote ?? "MiniMax created a plan for the next phase.").slice(0, 220),
  };
}

async function handleMiniMaxPlan(request, response) {
  if (!minimaxApiKey || minimaxApiKey === "your_minimax_api_key_here") {
    sendJson(response, 501, {
      error: "MiniMax API key is not configured. Set MINIMAX_API_KEY or add minimax.apiKey to config.local.json, then restart the server.",
      fallback: true,
    });
    return;
  }

  try {
    const { state } = await readJson(request);
    if (!state || !Array.isArray(state.residents)) {
      sendJson(response, 400, { error: "Request state must include a residents array." });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), minimaxTimeoutMs);
    let minimaxResponse;
    try {
      minimaxResponse = await fetch(`${minimaxBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${minimaxApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: minimaxModel,
          messages: buildMiniMaxPrompt(state),
          temperature: 0.7,
          max_tokens: 800,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = await minimaxResponse.json().catch(() => ({}));
    if (!minimaxResponse.ok) {
      sendJson(response, minimaxResponse.status, {
        error: payload?.error?.message ?? payload?.message ?? `MiniMax returned ${minimaxResponse.status}`,
      });
      return;
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      sendJson(response, 502, { error: "MiniMax response did not include message content." });
      return;
    }

    const parsed = extractJsonObject(content);
    sendJson(response, 200, {
      ...normalizeMiniMaxPlan(parsed, state),
      model: payload.model ?? minimaxModel,
      provider: "minimax",
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.name === "AbortError" ? `MiniMax request timed out after ${minimaxTimeoutMs}ms.` : error.message,
    });
  }
}

function resolvePath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://localhost:${port}`).pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const fullPath = normalize(join(root, requested));
  if (!fullPath.startsWith(root)) return null;
  if (!existsSync(fullPath)) return null;
  if (!statSync(fullPath).isFile()) return null;
  return fullPath;
}

const server = createServer((request, response) => {
  if (request.method === "POST" && request.url === "/api/minimax/plan") {
    handleMiniMaxPlan(request, response);
    return;
  }

  const filePath = resolvePath(request.url);
  if (!filePath) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(filePath).pipe(response);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Try PORT=4174 npm run mobile or stop the existing server.`);
    process.exit(1);
  }
  if (error.code === "EACCES") {
    console.error(`Cannot listen on ${host}:${port}. Try another port or allow Node.js through your firewall.`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, host, () => {
  console.log(`AI Town Life running at http://127.0.0.1:${port}`);
  if (host === "0.0.0.0" || host === "::") {
    const lanUrls = getLanUrls();
    if (lanUrls.length > 0) {
      console.log("Mobile/LAN URLs:");
      for (const url of lanUrls) {
        console.log(`  ${url}`);
      }
      console.log("Use a phone on the same Wi-Fi network. If it does not open, allow Node.js through Windows Firewall.");
    }
  }
});
