import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { dirname, extname, isAbsolute, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const config = loadConfig();
const port = Number(envValue("PORT") ?? config.server?.port ?? 4173);
const host = getArgValue("--host") ?? envValue("HOST") ?? config.server?.host ?? "127.0.0.1";

const minimaxApiStyle =
  envValue("MINIMAX_API_STYLE") ??
  config.minimax?.apiStyle ??
  "anthropic";

const minimaxApiKey =
  envValue("MINIMAX_API_KEY") ??
  envValue("ANTHROPIC_API_KEY") ??
  config.minimax?.apiKey ??
  "";

const minimaxAnthropicBaseUrl =
  envValue("ANTHROPIC_BASE_URL") ??
  envValue("MINIMAX_ANTHROPIC_BASE_URL") ??
  config.minimax?.anthropicBaseUrl ??
  "https://api.minimaxi.com/anthropic";

const minimaxBaseUrl =
  envValue("MINIMAX_BASE_URL") ??
  config.minimax?.baseUrl ??
  "https://api.minimax.io/v1";

const minimaxModel =
  envValue("MINIMAX_MODEL") ??
  config.minimax?.model ??
  "MiniMax-M3";

const minimaxTimeoutMs = Number(envValue("MINIMAX_TIMEOUT_MS") ?? config.minimax?.timeoutMs ?? 30_000);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
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
  return {
    system:
      "You are the planning brain for a cozy multi-agent town simulation game. Choose one valid task for each resident. Keep choices practical, varied, and consistent with mood, energy, personality, memory, and town needs. Return strict JSON only.",
    userContent: JSON.stringify({
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
  };
}

function extractAnthropicText(payload) {
  return (payload?.content ?? [])
    .filter((block) => block?.type === "text")
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();
}

async function requestMiniMaxAnthropicPlan({ apiKey, baseUrl, model, state, signal }) {
  const { system, userContent } = buildMiniMaxPrompt(state);
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      temperature: 0.7,
      thinking: { type: "disabled" },
      system,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: userContent }],
        },
      ],
    }),
    signal,
  });
  return response;
}

async function requestMiniMaxOpenAiPlan({ apiKey, baseUrl, model, state, signal }) {
  const { system, userContent } = buildMiniMaxPrompt(state);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 800,
    }),
    signal,
  });
  return response;
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

// ── Event Director ──────────────────────────────────────────────────────────────

function buildEventPrompt(state) {
  return {
    system:
      "You are the event director for a cozy AI town life simulation game. Generate one small town event that feels warm, observable, and connected to the current town state. Return strict JSON only. No markdown, no explanation.",
    userContent: JSON.stringify({
      validResidentIds: ["hua", "yuan", "mimi", "zhou", "seven"],
      validPlaceIds: ["garden", "cafe", "workshop", "plaza", "forest"],
      requiredSchema: {
        event: {
          type: "m3-event",
          title: "short Chinese title under 18 characters",
          text: "Chinese event text under 120 Chinese characters",
          tone: "cozy | surprise | social | resource | memory",
          residentIds: ["valid resident ids involved"],
          placeId: "valid place id",
          suggestedFollowUp: "short Chinese suggestion under 30 characters",
        },
      },
      state,
    }),
  };
}

function normalizeMiniMaxEvent(rawEvent, state) {
  const validResidents = Array.isArray(state.residents) ? state.residents : [];
  const allowedResidentIds = new Set(validResidents.map((r) => r.id));
  const allowedPlaceIds = new Set(["garden", "cafe", "workshop", "plaza", "forest"]);
  const allowedTones = new Set(["cozy", "surprise", "social", "resource", "memory"]);

  const event = rawEvent?.event ?? rawEvent ?? {};

  const residentIds = Array.isArray(event.residentIds)
    ? event.residentIds.filter((id) => allowedResidentIds.has(id))
    : [];

  const placeId = allowedPlaceIds.has(event.placeId) ? event.placeId : "plaza";
  const tone = allowedTones.has(event.tone) ? event.tone : "cozy";
  const title = String(event.title ?? "").trim() || "小镇发生了一件小事";
  const text = String(event.text ?? "").trim() ||
    "今天的小镇很安静，居民们各自继续着自己的生活。";
  const suggestedFollowUp = String(event.suggestedFollowUp ?? "").slice(0, 60);

  return {
    type: "m3-event",
    title: title.slice(0, 36),
    text: text.slice(0, 240),
    tone,
    residentIds,
    placeId,
    suggestedFollowUp,
  };
}

async function requestMiniMaxAnthropicEvent({ apiKey, baseUrl, model, state, signal }) {
  const { system, userContent } = buildEventPrompt(state);
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      temperature: 0.85,
      system,
      messages: [{ role: "user", content: [{ type: "text", text: userContent }] }],
      thinking: { type: "disabled" },
    }),
    signal,
  });
  return response;
}

async function requestMiniMaxOpenAiEvent({ apiKey, baseUrl, model, state, signal }) {
  const { system, userContent } = buildEventPrompt(state);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      temperature: 0.85,
      max_tokens: 600,
    }),
    signal,
  });
  return response;
}

async function handleMiniMaxEvent(request, response) {
  if (!minimaxApiKey || minimaxApiKey === "your_minimax_api_key_here") {
    sendJson(response, 501, {
      error: "AI 事件导演暂时还没准备好，你可以先继续推进小镇生活。",
      technicalError: "MiniMax API key is not configured.",
      fallback: true,
    });
    return;
  }

  try {
    const { state } = await readJson(request);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), minimaxTimeoutMs);
    let minimaxResponse;

    try {
      if (minimaxApiStyle === "openai") {
        minimaxResponse = await requestMiniMaxOpenAiEvent({
          apiKey: minimaxApiKey,
          baseUrl: minimaxBaseUrl,
          model: minimaxModel,
          state,
          signal: controller.signal,
        });
      } else {
        minimaxResponse = await requestMiniMaxAnthropicEvent({
          apiKey: minimaxApiKey,
          baseUrl: minimaxAnthropicBaseUrl,
          model: minimaxModel,
          state,
          signal: controller.signal,
        });
      }
    } finally {
      clearTimeout(timeout);
    }

    const payload = await minimaxResponse.json().catch(() => ({}));

    if (!minimaxResponse.ok) {
      sendJson(response, minimaxResponse.status, {
        error: "AI 事件导演遇到了一点问题，暂时无法生成事件。",
        technicalError: payload?.error?.message ?? payload?.message ?? `MiniMax returned ${minimaxResponse.status}`,
        fallback: false,
      });
      return;
    }

    let rawText;
    let usedStyle = minimaxApiStyle;

    if (minimaxApiStyle === "openai") {
      rawText = payload?.choices?.[0]?.message?.content;
    } else {
      rawText = extractAnthropicText(payload);
      usedStyle = "anthropic";
    }

    if (!rawText) {
      sendJson(response, 502, {
        error: "AI 事件导演没有返回有效内容，请稍后重试。",
        technicalError: "No text content in response.",
        fallback: false,
      });
      return;
    }

    const parsed = extractJsonObject(rawText);
    const event = normalizeMiniMaxEvent(parsed, state);

    sendJson(response, 200, {
      event: {
        id: `m3-event-${Date.now()}`,
        ...event,
      },
      model: payload.model ?? minimaxModel,
      provider: "minimax",
      apiStyle: usedStyle,
    });
  } catch (error) {
    const isTimeout = error.name === "AbortError";
    sendJson(response, isTimeout ? 504 : 500, {
      error: isTimeout
        ? `AI 事件导演思考超时了（${minimaxTimeoutMs / 1000}s），请稍后重试。`
        : "AI 事件导演遇到未知错误，请稍后重试。",
      technicalError: isTimeout
        ? `Request timed out after ${minimaxTimeoutMs}ms.`
        : error.message,
      fallback: false,
    });
  }
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
      error: "AI 管家暂时还没准备好，你可以先手动安排居民今天的生活。",
      technicalError: "MiniMax API key is not configured. Set MINIMAX_API_KEY / ANTHROPIC_API_KEY or config.minimax.apiKey.",
      fallback: true,
    });
    return;
  }

  try {
    const { state } = await readJson(request);
    if (!state || !Array.isArray(state.residents)) {
      sendJson(response, 400, {
        error: "AI 管家收不到小镇状态，请刷新页面后重试。",
        technicalError: "Request state must include a residents array.",
        fallback: false,
      });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), minimaxTimeoutMs);
    let minimaxResponse;

    try {
      if (minimaxApiStyle === "openai") {
        minimaxResponse = await requestMiniMaxOpenAiPlan({
          apiKey: minimaxApiKey,
          baseUrl: minimaxBaseUrl,
          model: minimaxModel,
          state,
          signal: controller.signal,
        });
      } else {
        // Default: anthropic
        minimaxResponse = await requestMiniMaxAnthropicPlan({
          apiKey: minimaxApiKey,
          baseUrl: minimaxAnthropicBaseUrl,
          model: minimaxModel,
          state,
          signal: controller.signal,
        });
      }
    } finally {
      clearTimeout(timeout);
    }

    const payload = await minimaxResponse.json().catch(() => ({}));

    if (!minimaxResponse.ok) {
      sendJson(response, minimaxResponse.status, {
        error: "AI 管家遇到了一点问题，暂时无法安排居民活动。",
        technicalError: payload?.error?.message ?? payload?.message ?? `MiniMax returned ${minimaxResponse.status}`,
        fallback: false,
      });
      return;
    }

    let rawText;
    let usedStyle = minimaxApiStyle;

    if (minimaxApiStyle === "openai") {
      rawText = payload?.choices?.[0]?.message?.content;
    } else {
      rawText = extractAnthropicText(payload);
      usedStyle = "anthropic";
    }

    if (!rawText) {
      sendJson(response, 502, {
        error: "AI 管家没有返回有效内容，请稍后重试。",
        technicalError: usedStyle === "anthropic"
          ? "Anthropic response did not include text content."
          : "OpenAI response did not include message content.",
        fallback: false,
      });
      return;
    }

    const parsed = extractJsonObject(rawText);
    sendJson(response, 200, {
      ...normalizeMiniMaxPlan(parsed, state),
      model: payload.model ?? minimaxModel,
      provider: "minimax",
      apiStyle: usedStyle,
    });
  } catch (error) {
    const isTimeout = error.name === "AbortError";
    sendJson(response, isTimeout ? 504 : 500, {
      error: isTimeout
        ? `AI 管家思考超时了（${minimaxTimeoutMs / 1000}s），请稍后重试。`
        : "AI 管家遇到未知错误，请稍后重试。",
      technicalError: isTimeout
        ? `Request timed out after ${minimaxTimeoutMs}ms.`
        : error.message,
      fallback: false,
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

  if (request.method === "POST" && request.url === "/api/minimax/event") {
    handleMiniMaxEvent(request, response);
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
