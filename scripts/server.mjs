import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { dirname, extname, isAbsolute, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTownMemorySummary } from "../src/domain/memory.js";

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

const ttsEnabled = config.tts?.enabled ?? true;
const ttsModel = config.tts?.model ?? "speech-2.8-hd";
const ttsVoiceId = config.tts?.voiceId ?? "female-tianmei";
const ttsSpeed = Number(config.tts?.speed ?? 1);
const ttsVol = Number(config.tts?.vol ?? 1);
const ttsPitch = Number(config.tts?.pitch ?? 0);
const ttsSampleRate = Number(config.tts?.sampleRate ?? 32000);
const ttsBitrate = Number(config.tts?.bitrate ?? 128000);
const ttsFormat = config.tts?.format ?? "mp3";
const ttsChannel = Number(config.tts?.channel ?? 1);
const ttsTimeoutMs = Number(config.tts?.timeoutMs ?? 30_000);
const ttsApiKey = minimaxApiKey; // shares the same key as other MiniMax services

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

function buildEventPrompt(state, memorySummary = "") {
  const memoryBlock = memorySummary
    ? `\n\n${memorySummary}\n\nYou may create an event that continues from a real memory above if it feels natural. Do NOT invent player choices or events that are not listed. If no relevant memory exists, generate a normal event for today.`
    : "";

  return {
    system:
      "You are the event director for a cozy AI town life simulation game. Generate one small town event that feels warm, observable, and connected to the current town state. Return strict JSON only. No markdown, no explanation. Return one event with exactly two gentle player choices. The choices should not require combat, danger, adult content, or destructive actions. The resultText should describe what happens after the player chooses it. Do not promise or imply numeric stat changes in resultText." +
      (memorySummary ? " Events may naturally continue from real town memories listed in the user content. Never fabricate player choices or events that are not provided in the memories." : ""),
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
          choices: [
            {
              id: "choice_a",
              label: "Chinese button label within 24 characters",
              preview: "Chinese preview text within 40 characters",
              resultText: "Chinese result description within 100 characters",
            },
            {
              id: "choice_b",
              label: "Chinese button label within 24 characters",
              preview: "Chinese preview text within 40 characters",
              resultText: "Chinese result description within 100 characters",
            },
          ],
        },
      },
      state,
      memorySummary: memorySummary,
    }),
  };
}

const FALLBACK_CHOICES = [
  {
    id: "gentle_help",
    label: "温柔地帮忙",
    preview: "让居民主动参与这件小事。",
    resultText: "居民们用温柔的方式回应了这件小事，小镇的今天多了一点故事。",
  },
  {
    id: "watch_first",
    label: "先观察一下",
    preview: "先看看事情会如何发展。",
    resultText: "你选择先观察一下，居民们把这件事记在了今天的小镇动态里。",
  },
];

function normalizeEventChoices(rawChoices) {
  const raw = Array.isArray(rawChoices) ? rawChoices : [];
  const selected = raw.slice(0, 2);

  while (selected.length < 2) {
    const fallbackIdx = selected.length;
    if (fallbackIdx < FALLBACK_CHOICES.length) {
      selected.push({ ...FALLBACK_CHOICES[fallbackIdx] });
    } else {
      selected.push({ ...FALLBACK_CHOICES[0], id: `fallback_${selected.length}` });
    }
  }

  return selected.map((choice, idx) => {
    const id = String(choice.id ?? "").trim() || (idx === 0 ? "choice_a" : "choice_b");
    const label = String(choice.label ?? "").trim() || FALLBACK_CHOICES[idx]?.label || "温柔地帮忙";
    const preview = String(choice.preview ?? "").trim() || "这个选择会被记录在小镇动态里。";
    const resultText = String(choice.resultText ?? "").trim() || "你的选择被小镇记住了，居民们继续着今天的生活。";

    return {
      id,
      label: label.slice(0, 24),
      preview: preview.slice(0, 40),
      resultText: resultText.slice(0, 100),
    };
  });
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

  const choices = normalizeEventChoices(event.choices);

  return {
    type: "m3-event",
    title: title.slice(0, 36),
    text: text.slice(0, 240),
    tone,
    residentIds,
    placeId,
    suggestedFollowUp,
    choices,
  };
}

async function requestMiniMaxAnthropicEvent({ apiKey, baseUrl, model, state, memorySummary, signal }) {
  const { system, userContent } = buildEventPrompt(state, memorySummary);
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

async function requestMiniMaxOpenAiEvent({ apiKey, baseUrl, model, state, memorySummary, signal }) {
  const { system, userContent } = buildEventPrompt(state, memorySummary);
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

    const memorySummary = buildTownMemorySummary(state?.townMemory);

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
          memorySummary,
          signal: controller.signal,
        });
      } else {
        minimaxResponse = await requestMiniMaxAnthropicEvent({
          apiKey: minimaxApiKey,
          baseUrl: minimaxAnthropicBaseUrl,
          model: minimaxModel,
          state,
          memorySummary,
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

// ── Town Broadcast ─────────────────────────────────────────────────────────────────

const PHASE_MUSIC_MOOD = {
  morning: "温暖清晨",
  afternoon: "轻快午后",
  evening: "安静夜晚",
};

function buildBroadcastPrompt(state, memorySummary = "") {
  const phaseMap = { morning: "早上", afternoon: "下午", evening: "晚上" };
  const memoryBlock = memorySummary
    ? `\n\n${memorySummary}\n\nYou may naturally reference the memories above if relevant. Do NOT invent memories that are not listed above. If no relevant memory exists, simply ignore the memory section and write a normal broadcast for today.`
    : "";

  return {
    system:
      "You are the town radio host and atmosphere designer for a cozy AI town life simulation game. Generate one short Chinese town broadcast based on the current town state. The broadcast should feel warm, observable, and connected to residents, places, mood, resources, and recent events. Return strict JSON only. No markdown, no explanation." +
      (memorySummary ? " The broadcast may naturally reference real town memories listed in the user content. Never fabricate a memory that is not provided." : ""),
    userContent: JSON.stringify({
      validResidentIds: ["hua", "yuan", "mimi", "zhou", "seven"],
      validPlaceIds: ["garden", "cafe", "workshop", "plaza", "forest"],
      requiredSchema: {
        broadcast: {
          type: "town-broadcast",
          title: "short Chinese title under 16 characters",
          script: "Chinese broadcast script, 80-180 Chinese characters",
          mood: "warm | calm | lively | tired | hopeful | tense",
          musicMood: "short Chinese mood label",
          musicPrompt: "Chinese music generation prompt under 80 characters",
          relatedResidentIds: ["valid resident ids"],
          placeId: "valid place id",
          durationHint: "15-30s",
        },
      },
      state,
      memorySummary: memorySummary,
    }),
  };
}

function normalizeMiniMaxBroadcast(rawBroadcast, state) {
  const validResidents = Array.isArray(state?.residents) ? state.residents : [];
  const allowedResidentIds = new Set(validResidents.map((r) => r.id));
  const allowedPlaceIds = new Set(["garden", "cafe", "workshop", "plaza", "forest"]);
  const allowedMoods = new Set(["warm", "calm", "lively", "tired", "hopeful", "tense"]);

  const raw = rawBroadcast?.broadcast ?? rawBroadcast ?? {};

  const relatedResidentIds = Array.isArray(raw.relatedResidentIds)
    ? raw.relatedResidentIds.filter((id) => allowedResidentIds.has(id))
    : [];

  const placeId = allowedPlaceIds.has(raw.placeId) ? raw.placeId : "plaza";
  const mood = allowedMoods.has(raw.mood) ? raw.mood : "warm";
  const title = String(raw.title ?? "").trim() || "今日小镇广播";
  const script = String(raw.script ?? "").trim() ||
    "今天的小镇安静地运转着，居民们继续着自己的生活。";

  // Determine phase-based musicMood fallback
  const phaseMap = { morning: "温暖清晨", afternoon: "轻快午后", evening: "安静夜晚" };
  const phaseKey = state?.phaseIndex === 0 ? "morning" : state?.phaseIndex === 1 ? "afternoon" : "evening";
  const musicMood = String(raw.musicMood ?? "").trim() || phaseMap[phaseKey] || "温暖清晨";
  const musicPrompt = String(raw.musicPrompt ?? "").trim() ||
    "温暖、治愈、轻松的小镇生活背景音乐，适合休闲模拟游戏。";
  const durationHint = String(raw.durationHint ?? "").trim() || "15-30s";

  return {
    type: "town-broadcast",
    title: title.slice(0, 32),
    script: script.slice(0, 360),
    mood,
    musicMood: musicMood.slice(0, 40),
    musicPrompt: musicPrompt.slice(0, 120),
    relatedResidentIds,
    placeId,
    durationHint: durationHint.slice(0, 20),
  };
}

async function requestMiniMaxAnthropicBroadcast({ apiKey, baseUrl, model, state, memorySummary, signal }) {
  const { system, userContent } = buildBroadcastPrompt(state, memorySummary);
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      temperature: 0.8,
      system,
      messages: [{ role: "user", content: [{ type: "text", text: userContent }] }],
      thinking: { type: "disabled" },
    }),
    signal,
  });
  return response;
}

async function requestMiniMaxOpenAiBroadcast({ apiKey, baseUrl, model, state, memorySummary, signal }) {
  const { system, userContent } = buildBroadcastPrompt(state, memorySummary);
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
      temperature: 0.8,
      max_tokens: 800,
    }),
    signal,
  });
  return response;
}

async function handleMiniMaxBroadcast(request, response) {
  if (!minimaxApiKey || minimaxApiKey === "your_minimax_api_key_here") {
    sendJson(response, 501, {
      error: "小镇广播暂时还没准备好，你可以先继续安排居民生活。",
      technicalError: "MiniMax API key is not configured.",
      fallback: true,
    });
    return;
  }

  try {
    const { state } = await readJson(request);

    const memorySummary = buildTownMemorySummary(state?.townMemory);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), minimaxTimeoutMs);
    let minimaxResponse;

    try {
      if (minimaxApiStyle === "openai") {
        minimaxResponse = await requestMiniMaxOpenAiBroadcast({
          apiKey: minimaxApiKey,
          baseUrl: minimaxBaseUrl,
          model: minimaxModel,
          state,
          memorySummary,
          signal: controller.signal,
        });
      } else {
        minimaxResponse = await requestMiniMaxAnthropicBroadcast({
          apiKey: minimaxApiKey,
          baseUrl: minimaxAnthropicBaseUrl,
          model: minimaxModel,
          state,
          memorySummary,
          signal: controller.signal,
        });
      }
    } finally {
      clearTimeout(timeout);
    }

    const payload = await minimaxResponse.json().catch(() => ({}));

    if (!minimaxResponse.ok) {
      sendJson(response, minimaxResponse.status, {
        error: "小镇广播暂时没有播出，请稍后再试。",
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
        error: "小镇广播没有返回有效内容，请稍后重试。",
        technicalError: "No text content in response.",
        fallback: false,
      });
      return;
    }

    const parsed = extractJsonObject(rawText);
    const broadcast = normalizeMiniMaxBroadcast(parsed, state);

    sendJson(response, 200, {
      broadcast: {
        id: `broadcast-${Date.now()}`,
        ...broadcast,
      },
      model: payload.model ?? minimaxModel,
      provider: "minimax",
      apiStyle: usedStyle,
    });
  } catch (error) {
    const isTimeout = error.name === "AbortError";
    sendJson(response, isTimeout ? 504 : 500, {
      error: isTimeout
        ? `小镇广播超时了（${minimaxTimeoutMs / 1000}s），请稍后重试。`
        : "小镇广播遇到未知错误，请稍后重试。",
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

// ── TTS (Text-to-Speech) ─────────────────────────────────────────────────────────

async function handleMiniMaxTts(request, response) {
  if (!ttsEnabled) {
    sendJson(response, 501, {
      error: "TTS 功能已禁用。",
      technicalError: "TTS is not enabled in config.",
    });
    return;
  }

  if (!ttsApiKey || ttsApiKey === "your_minimax_api_key_here") {
    sendJson(response, 501, {
      error: "语音合成暂时不可用，请在配置中启用 MiniMax API Key。",
      technicalError: "MiniMax API key is not configured for TTS.",
    });
    return;
  }

  let body;
  try {
    const raw = await readJson(request);
    body = raw;
  } catch {
    sendJson(response, 400, { error: "Invalid request body.", technicalError: "JSON parse error." });
    return;
  }

  const text = String(body?.text ?? "").trim();
  if (!text) {
    sendJson(response, 400, { error: "广播文本为空。", technicalError: "text is empty." });
    return;
  }
  if (text.length > 3000) {
    sendJson(response, 400, {
      error: `广播文本超过 3000 字符限制（当前 ${text.length} 字符）。`,
      technicalError: `text length ${text.length} exceeds 3000.`,
    });
    return;
  }

  try {
    // Build payload with strict type coercion per MiniMax API spec
    const ttsPayload = {
      model: String(ttsModel || "speech-2.8-hd"),
      text,
      stream: false,
      voice_setting: {
        voice_id: String(ttsVoiceId || "male-qn-qingse"),
        speed: Number(ttsSpeed ?? 1),
        vol: Number(ttsVol ?? 1),
        pitch: Number(ttsPitch ?? 0),
      },
      audio_setting: {
        sample_rate: Number(ttsSampleRate ?? 32000),
        bitrate: Number(ttsBitrate ?? 128000),
        format: String(ttsFormat || "mp3"),
        channel: Number(ttsChannel ?? 1),
      },
      subtitle_enable: false,
      output_format: "hex",
    };

    // Validate no NaN slipped through (would indicate bad config)
    if (
      Number.isNaN(ttsPayload.voice_setting.speed) ||
      Number.isNaN(ttsPayload.voice_setting.vol) ||
      Number.isNaN(ttsPayload.voice_setting.pitch) ||
      Number.isNaN(ttsPayload.audio_setting.sample_rate) ||
      Number.isNaN(ttsPayload.audio_setting.bitrate) ||
      Number.isNaN(ttsPayload.audio_setting.channel)
    ) {
      sendJson(response, 500, {
        error: "TTS 配置参数无效。",
        technicalError: "NaN detected in TTS numeric config.",
      });
      return;
    }

    // Request diagnostic log (no secrets)
    console.info("[tts] request summary", {
      model: ttsPayload.model,
      textLength: text.length,
      voiceId: ttsPayload.voice_setting.voice_id,
      speed: ttsPayload.voice_setting.speed,
      vol: ttsPayload.voice_setting.vol,
      pitch: ttsPayload.voice_setting.pitch,
      sampleRate: ttsPayload.audio_setting.sample_rate,
      bitrate: ttsPayload.audio_setting.bitrate,
      bitrateType: typeof ttsPayload.audio_setting.bitrate,
      format: ttsPayload.audio_setting.format,
      channel: ttsPayload.audio_setting.channel,
      outputFormat: ttsPayload.output_format,
      hasApiKey: Boolean(ttsApiKey && ttsApiKey !== "your_minimax_api_key_here"),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ttsTimeoutMs);

    const ttsResponse = await fetch("https://api.minimaxi.com/v1/t2a_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ttsApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ttsPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const payload = await ttsResponse.json().catch(() => ({}));

    // Response diagnostic log (no secrets)
    console.error("[tts] MiniMax response summary", {
      httpStatus: ttsResponse.status,
      statusCode: payload?.base_resp?.status_code,
      statusMsg: payload?.base_resp?.status_msg,
      traceId: payload?.trace_id ?? payload?.extra_info?.trace_id,
      hasData: Boolean(payload?.data),
      dataStatus: payload?.data?.status,
      hasAudio: Boolean(payload?.data?.audio),
      audioLength: payload?.data?.audio?.length || 0,
      audioFormat: payload?.extra_info?.audio_format,
      audioSize: payload?.extra_info?.audio_size,
    });

    if (!ttsResponse.ok) {
      sendJson(response, ttsResponse.status, {
        ok: false,
        error: `语音合成 HTTP 失败（${ttsResponse.status}）`,
        statusCode: payload?.base_resp?.status_code ?? ttsResponse.status,
        statusMsg: payload?.base_resp?.status_msg ?? "",
        traceId: payload?.trace_id ?? payload?.extra_info?.trace_id ?? null,
      });
      return;
    }

    if (payload?.base_resp?.status_code !== 0) {
      sendJson(response, 502, {
        ok: false,
        error: `语音合成失败：${payload?.base_resp?.status_msg || "未知错误"}`,
        statusCode: payload?.base_resp?.status_code,
        statusMsg: payload?.base_resp?.status_msg || "",
        traceId: payload?.trace_id ?? payload?.extra_info?.trace_id ?? null,
      });
      return;
    }

    const audioHex = payload?.data?.audio;
    if (!payload?.data) {
      sendJson(response, 502, {
        ok: false,
        error: `语音合成返回空数据：${payload?.base_resp?.status_msg || "未知错误"}`,
        statusCode: payload?.base_resp?.status_code ?? 0,
        statusMsg: payload?.base_resp?.status_msg || "",
        traceId: payload?.trace_id ?? payload?.extra_info?.trace_id ?? null,
      });
      return;
    }

    if (!audioHex || typeof audioHex !== "string" || audioHex.length === 0) {
      sendJson(response, 502, {
        ok: false,
        error: `语音合成未返回音频：${payload?.base_resp?.status_msg || "未知错误"}`,
        statusCode: payload?.base_resp?.status_code ?? 0,
        statusMsg: payload?.base_resp?.status_msg || "",
        traceId: payload?.trace_id ?? payload?.extra_info?.trace_id ?? null,
      });
      return;
    }

    // Convert hex audio to base64 data URL
    const audioBuffer = Buffer.from(audioHex, "hex");
    const audioBase64 = audioBuffer.toString("base64");
    const audioUrl = `data:audio/${ttsPayload.audio_setting.format};base64,${audioBase64}`;

    sendJson(response, 200, {
      ok: true,
      audioUrl,
      traceId: payload?.trace_id ?? payload?.extra_info?.trace_id ?? null,
      extraInfo: {
        audioLength: payload?.data?.audio?.length ?? audioHex.length,
        audioSize: payload?.extra_info?.audio_size ?? audioBuffer.length,
        audioFormat: payload?.extra_info?.audio_format ?? ttsPayload.audio_setting.format,
        statusCode: payload?.base_resp?.status_code,
        statusMsg: payload?.base_resp?.status_msg,
      },
    });
  } catch (error) {
    const isTimeout = error.name === "AbortError";
    sendJson(response, isTimeout ? 504 : 500, {
      ok: false,
      error: isTimeout
        ? `语音合成超时了（${ttsTimeoutMs / 1000}s），请稍后重试。`
        : "语音合成遇到未知错误，请稍后重试。",
      technicalError: isTimeout
        ? `TTS request timed out after ${ttsTimeoutMs}ms.`
        : error.message,
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

  if (request.method === "POST" && request.url === "/api/minimax/broadcast") {
    handleMiniMaxBroadcast(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/api/minimax/tts") {
    handleMiniMaxTts(request, response);
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
