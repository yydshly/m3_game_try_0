import { createInitialState, upgradeState } from "./domain/state.js";
import { advancePhase, applyAgentPlan, assignTask, resetAssignments } from "./domain/simulation.js";
import { applyChoiceMemory, buildTownMemoryReferences } from "./domain/memory.js";
import { buildAiDirectorContext, selectTownLifeScenario } from "./domain/aiDirector.js";
import { requestMiniMaxPlan, requestMiniMaxEvent, requestMiniMaxBroadcast, buildPromptMemoryNarrative } from "./services/minimaxClient.js";
import { generateBroadcastSpeech } from "./services/minimaxTts.js";
import { generateMimoSpeech } from "./services/mimoClient.js";
import { resolveTtsProviderForScene, buildAudioKey, hashText } from "./services/ttsService.js";
import { loadState, saveState, clearState } from "./services/persistence.js";
import { renderApp } from "./ui/render.js";
import { phases } from "./data/seed.js";
import { buildResidentDialogueContext, buildFallbackResidentSceneBeats, requestMiniMaxResidentDialogues, buildBeatsSummary } from "./services/residentDialogue.js";
import { buildResidentDialogueTurns, buildResidentConversationSession } from "./services/dialogueGenerator.js";

const root = document.querySelector("#app");
let state = loadState();
if (state) {
  state = upgradeState(state);
} else {
  state = createInitialState();
}
// ── Animation Timing Constants ───────────────────────────────────────────────────────

const TRAVEL_ANIMATION_MS = 1150;
const TASK_ACTION_MS = 2100;
const TASK_ANIMATION_DURATION_MS = TRAVEL_ANIMATION_MS + TASK_ACTION_MS; // 3250ms
const AUTO_PLAY_DELAY_MS = TASK_ANIMATION_DURATION_MS + 700; // ~4000ms
const COMPLETION_FEEDBACK_MS = 2200;

// ── Day Cycle UI State ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} DayCycle
 * @property {"idle"|"running"|"waiting_choice"|"completed"|"error"} status
 * @property {string} step          - current step description
 * @property {string} scenarioId    - active scenario id
 * @property {string} error        - error message if status === "error"
 * @property {number} startedAt    - timestamp when cycle started
 * @property {number} completedAt  - timestamp when cycle completed
 */

/** @type {DayCycle} */
const DAY_CYCLE_DEFAULT = {
  status: "idle",
  step: "",
  scenarioId: "",
  error: "",
  startedAt: 0,
  completedAt: 0,
};

// ── UI State ──────────────────────────────────────────────────────────────────────

let uiState = {
  selectedResidentId: state.residents[0]?.id ?? null,
  autoPlay: false,
  llmStatus: "idle",
  llmMessage: "",
  eventDirectorStatus: "idle",
  eventDirectorMessage: "",
  broadcastStatus: "idle",
  broadcastMessage: "",
  latestBroadcast: null,
  broadcastAudio: makeAudioState(),
  activeTaskAnimations: [],
  isAnimating: false,
  animationMessage: "",
  completionFeedback: null,
  activeScenario: selectTownLifeScenario(state),
  residentSceneBeats: [],
  dayCycle: { ...DAY_CYCLE_DEFAULT },
  ttsAudios: {},   // { [audioKey]: { status, audioUrl, textHash, error, generatedAt } }
  currentVoicePlayback: makeVoicePlaybackState(), // unified global voice playback state
  choiceAftermath: null, // { id, eventId, choiceId, choiceLabel, summary, residentReactions, stageEffect, memoryLabels, createdAt }
  dayOpeningReflection: null, // { id, sourceType, sourceId, title, summary, memoryLabels, scenarioHint, createdAt }
  residentVoiceInteraction: {
    enabled: false,
    recommendedClipKey: "",
    lastTriggeredAt: 0,
    hint: "",
  },
  residentVoiceClips: [],
  residentConversation: {
    enabled: false,
    status: "idle", // idle | playing | paused | completed | error
    queue: [],      // array of conversation lines
    currentIndex: 0,
    currentLineId: "",
    visibleText: "",
    typingTimerId: null,
    autoPlayVoice: true,
    error: "",
    runId: "",      // unique id to invalidate old timers after stop/restart
    startedCount: 0, // increments each time conversation starts (for template rotation)
    sessionState: null, // buildResidentConversationSession result
  },
};
let autoPlayTimer = null;
let animationTimer = null;
let completionTimer = null;

// ── Broadcast Audio Player ─────────────────────────────────────────────────────────

/** Persistent audio instance for the broadcast player */
let activeAudio = null;

/** Map of audioKey → Audio instance for MiMo TTS */
const activeMimoAudios = new Map();

/**
 * Simple string hash for detecting script changes.
 * Uses the same algorithm as the memory hash for consistency.
 */
function hashBroadcastScript(script) {
  return String(script || "")
    .trim()
    .split("")
    .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
    .toString(16);
}

/**
 * Make a clean broadcastAudio object.
 */
function makeAudioState(overrides = {}) {
  return {
    status: "idle",
    text: "",
    audioUrl: null,
    error: null,
    debugCode: null,
    traceId: null,
    generatedAt: null,
    scriptHash: "",
    ...overrides,
  };
}

/**
 * Make a clean currentVoicePlayback object.
 * @param {object} overrides
 */
function makeVoicePlaybackState(overrides = {}) {
  return {
    key: "",
    provider: "",
    scene: "",
    sourceType: "",
    sourceId: "",
    title: "",
    subtitle: "",
    textPreview: "",
    status: "idle", // idle | loading | playing | paused | error
    error: "",
    startedAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

// ── Resident Conversation ─────────────────────────────────────────────────────

/**
 * Build a resident conversation queue using scene-aware session (no M3 call).
 * Returns a session with a fixed pair of participants and validated lines.
 * @param {object} state - game state
 * @param {object} conversationState - residentConversation uiState slice
 * @returns {object} { session, queue } — session from buildResidentConversationSession, queue for backward compat
 */
function buildResidentConversationQueue(state, conversationState) {
  const residents = state.residents ?? [];
  if (residents.length < 2) return { session: null, queue: [] };

  const startedCount = conversationState?.startedCount ?? 0;
  const seed = (state.day * 17 + state.phaseIndex * 7 + startedCount);

  // Build session with fixed pair of participants
  const session = buildResidentConversationSession(state, {
    activeScenario: state.activeScenario ?? null,
    completionFeedback: null,
    rotationSeed: seed,
  });

  // Convert session lines to queue format (backward compat)
  const queue = (session.lines ?? []).map((line, i) => {
    const lineId = line.id ?? `conv-line-${i + 1}`;
    const audioKey = `conversation:${line.speakerId}:${lineId}`;
    return {
      id: lineId,
      speakerId: line.speakerId,
      targetId: line.targetId,
      speakerName: line.speakerName ?? "居民",
      targetName: line.targetName ?? "邻居",
      text: (line.text ?? "").slice(0, 50),
      scene: "conversation",
      audioKey,
      status: "idle",
    };
  });

  return { session, queue };
}

/**
 * Clear any active typewriter timer and reset typingTimerId in state.
 */
function clearConversationTimer() {
  const existing = uiState.residentConversation;
  if (existing?.typingTimerId != null) {
    clearTimeout(existing.typingTimerId);
    uiState = {
      ...uiState,
      residentConversation: {
        ...existing,
        typingTimerId: null,
      },
    };
  }
}

/**
 * Update conversation visible text in the DOM without a full render.
 * Used during typewriter effect to avoid flickering the entire UI.
 * @param {string} lineId - the conversation line id
 * @param {string} visibleText - the text to display
 */
function updateConversationVisibleText(lineId, visibleText) {
  const nodes = document.querySelectorAll(`[data-conversation-visible-text="${CSS.escape(lineId)}"]`);
  nodes.forEach((node) => {
    node.textContent = visibleText;
  });
}

/**
 * Advance to the next conversation line (or finish if at end).
 */
function advanceConversationLine() {
  clearConversationTimer();
  const conv = uiState.residentConversation;
  if (!conv || conv.status !== "playing") return;

  const nextIndex = conv.currentIndex + 1;
  if (nextIndex >= conv.queue.length) {
    // Conversation finished
    uiState = {
      ...uiState,
      residentConversation: {
        ...conv,
        status: "completed",
        typingTimerId: null,
        currentLineId: "",
        visibleText: "",
      },
      currentVoicePlayback: makeVoicePlaybackState(),
    };
    stopAllMimoAudio({ reason: "conversation-done" });
    render();
    return;
  }

  const nextLine = conv.queue[nextIndex];
  uiState = {
    ...uiState,
    residentConversation: {
      ...conv,
      currentIndex: nextIndex,
      currentLineId: nextLine.id,
      visibleText: "",
      typingTimerId: null,
    },
  };
  render();
  playConversationLine(nextLine);
}

/**
 * Play a single conversation line: start typewriter and MiMo audio.
 * @param {object} line - conversation line from queue
 */
function playConversationLine(line) {
  const conv = uiState.residentConversation;
  if (!conv || (conv.status !== "playing" && conv.status !== "paused")) return;

  // Stop any other audio first
  stopBroadcastAudio({ reason: "conversation" });
  stopAllMimoAudio({ exceptKey: line.audioKey, reason: "conversation" });

  // Set ttsAudios entry to loading first
  const currentHash = hashText(line.text);
  uiState = {
    ...uiState,
    ttsAudios: {
      ...uiState.ttsAudios,
      [line.audioKey]: { status: "loading", audioUrl: null, textHash: currentHash, textPreview: line.text.slice(0, 40), error: null, sourceType: "conversation", speakerName: line.speakerName, targetName: line.targetName },
    },
    currentVoicePlayback: makeVoicePlaybackState({
      key: line.audioKey,
      provider: "mimo",
      scene: "conversation",
      sourceType: "conversation",
      sourceId: line.speakerId,
      title: line.speakerName,
      subtitle: line.targetName ? `对 ${line.targetName} 说` : "对话",
      textPreview: line.text.slice(0, 40),
      status: "loading",
      startedAt: Date.now(),
      updatedAt: Date.now(),
    }),
  };
  render();

  // Use existing cached audio if available and same hash, otherwise generate
  const existing = uiState.ttsAudios[line.audioKey];
  if (existing?.audioUrl && existing?.textHash === currentHash) {
    // Cached — use it
    uiState = {
      ...uiState,
      ttsAudios: { ...uiState.ttsAudios, [line.audioKey]: { ...existing, status: "ready" } },
    };
    render();
    startConversationTypewriter(line, existing.audioUrl);
  } else {
    // Generate via MiMo
    generateMimoSpeech({ text: line.text, voice: "mimo_default", format: "wav" })
      .then((result) => {
        // Guard: don't proceed if conversation was stopped/paused
        const cur = uiState.residentConversation;
        if (!cur || (cur.status !== "playing" && cur.status !== "paused") || cur.currentLineId !== line.id) return;
        if (result?.audioUrl) {
          const entry = uiState.ttsAudios[line.audioKey];
          uiState = {
            ...uiState,
            ttsAudios: {
              ...uiState.ttsAudios,
              [line.audioKey]: { status: "ready", audioUrl: result.audioUrl, textHash: currentHash, textPreview: line.text.slice(0, 40), error: null, sourceType: "conversation", speakerName: line.speakerName, targetName: line.targetName },
            },
          };
          render();
          startConversationTypewriter(line, result.audioUrl);
        }
      })
      .catch(() => {
        // Guard: don't proceed if conversation was stopped/paused
        const cur = uiState.residentConversation;
        if (!cur || (cur.status !== "playing" && cur.status !== "paused") || cur.currentLineId !== line.id) return;
        // MiMo failed — still show text, mark as error for voice
        const entry = uiState.ttsAudios[line.audioKey];
        if (entry) {
          uiState = {
            ...uiState,
            ttsAudios: { ...uiState.ttsAudios, [line.audioKey]: { ...entry, status: "error", error: "语音生成失败，但文字正常显示" } },
          };
          render();
        }
        // Continue typewriter even without audio
        startConversationTypewriter(line, null);
      });
  }
}

/**
 * Start typewriter effect for a conversation line.
 * @param {object} line
 * @param {string|null} audioUrl
 */
function startConversationTypewriter(line, audioUrl) {
  const conv = uiState.residentConversation;
  if (!conv || conv.status === "idle" || conv.status === "completed") return;

  let charIndex = 0;
  const text = line.text;
  const total = text.length;

  // Estimate duration: ~120ms per character, extra for punctuation
  const getDelay = (ch) => {
    if ("，。！？、；：".includes(ch)) return 250;
    if (",.!?;:'\"".includes(ch)) return 200;
    return 100;
  };

  const tick = () => {
    // If conversation was paused/stopped since we started, don't continue
    const cur = uiState.residentConversation;
    if (!cur || cur.status !== "playing" || cur.currentLineId !== line.id) return;
    // Stale timer guard — runId mismatch means this timer is obsolete
    if (cur.runId !== conv.runId) return;

    if (charIndex >= total) {
      // Text complete — wait for audio to finish if we have one
      if (audioUrl) {
        // Set status to "playing" and wait for audio onended to advance
        const audio = activeMimoAudios.get(line.audioKey);
        if (audio) {
          // Audio already playing or ready — just advance after natural duration
          // Use estimated audio duration
          const estimatedMs = Math.max(1500, total * 120);
          const timerId = setTimeout(() => advanceConversationLine(), estimatedMs);
          uiState = { ...uiState, residentConversation: { ...cur, typingTimerId: timerId } };
          render();
        } else {
          advanceConversationLine();
        }
      } else {
        // No audio — short pause then advance
        const timerId = setTimeout(() => advanceConversationLine(), 1200);
        uiState = { ...uiState, residentConversation: { ...cur, typingTimerId: timerId } };
        render();
      }
      return;
    }

    charIndex++;
    const visibleText = text.slice(0, charIndex);
    uiState = { ...uiState, residentConversation: { ...cur, visibleText, typingTimerId: null } };
    // Local DOM update — no full render for each character
    updateConversationVisibleText(line.id, visibleText);

    const delay = getDelay(text[charIndex - 1]);
    const timerId = setTimeout(tick, delay);
    uiState = { ...uiState, residentConversation: { ...uiState.residentConversation, typingTimerId: timerId } };
  };

  // Start audio playback if we have a URL
  if (audioUrl) {
    // Stop any previous conversation audio with a different key
    stopAllMimoAudio({ exceptKey: line.audioKey, reason: "conversation-line" });
    playMimoAudio(line.audioKey, audioUrl);
  }

  // Begin typewriter
  tick();
}

/**
 * Start the conversation: generate session+queue and begin first line.
 */
function startResidentConversation() {
  const { session, queue } = buildResidentConversationQueue(state, uiState);
  if (!queue || queue.length === 0 || !session) return;

  // Stop any existing audio
  stopBroadcastAudio({ reason: "conversation-start" });
  stopAllMimoAudio({ reason: "conversation-start" });

  const firstLine = queue[0];
  const runId = `conv-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const prevStartedCount = uiState.residentConversation?.startedCount ?? 0;
  uiState = {
    ...uiState,
    residentConversation: {
      ...uiState.residentConversation,
      enabled: true,
      status: "playing",
      queue,
      currentIndex: 0,
      currentLineId: firstLine.id,
      visibleText: "",
      typingTimerId: null,
      autoPlayVoice: true,
      error: "",
      runId,
      startedCount: prevStartedCount + 1,
      sessionState: session,
    },
  };
  render();
  playConversationLine(firstLine);
}

/**
 * Pause the conversation (and the current audio).
 */
function pauseResidentConversation() {
  const conv = uiState.residentConversation;
  if (!conv || conv.status !== "playing") return;

  clearConversationTimer();

  // Pause audio
  if (conv.currentLineId) {
    const audio = activeMimoAudios.get(`conversation:${conv.queue[conv.currentIndex]?.speakerId}:${conv.currentLineId}`);
    if (audio) audio.pause();
    const lineAudioKey = conv.queue[conv.currentIndex]?.audioKey;
    if (lineAudioKey) {
      const entry = uiState.ttsAudios[lineAudioKey];
      if (entry) {
        uiState = {
          ...uiState,
          ttsAudios: { ...uiState.ttsAudios, [lineAudioKey]: { ...entry, status: "paused" } },
        };
      }
    }
  }

  uiState = {
    ...uiState,
    residentConversation: { ...conv, status: "paused", typingTimerId: null },
    currentVoicePlayback: uiState.currentVoicePlayback?.status === "playing"
      ? { ...uiState.currentVoicePlayback, status: "paused" }
      : uiState.currentVoicePlayback,
  };
  render();
}

/**
 * Resume the conversation.
 */
function resumeResidentConversation() {
  const conv = uiState.residentConversation;
  if (!conv || conv.status !== "paused") return;

  const currentLine = conv.queue[conv.currentIndex];
  if (!currentLine) return;

  // Resume audio
  const audioKey = currentLine.audioKey;
  const audio = activeMimoAudios.get(audioKey);
  if (audio) {
    audio.play().catch(() => {});
    const entry = uiState.ttsAudios[audioKey];
    if (entry) {
      uiState = {
        ...uiState,
        ttsAudios: { ...uiState.ttsAudios, [audioKey]: { ...entry, status: "playing" } },
      };
    }
  }

  uiState = {
    ...uiState,
    residentConversation: { ...conv, status: "playing" },
    currentVoicePlayback: uiState.currentVoicePlayback?.key
      ? { ...uiState.currentVoicePlayback, status: "playing" }
      : uiState.currentVoicePlayback,
  };
  render();

  // Restart typewriter from current position
  const remainingText = currentLine.text.slice(conv.visibleText.length);
  if (remainingText.length > 0) {
    let charIndex = 0;
    const total = remainingText.length;
    const getDelay = (ch) => {
      if ("，。！？、；：".includes(ch)) return 250;
      if (",.!?;:'\"".includes(ch)) return 200;
      return 100;
    };
    const tick = () => {
      const cur = uiState.residentConversation;
      if (!cur || cur.status !== "playing" || cur.currentLineId !== currentLine.id) return;
      // Stale timer guard — runId mismatch means this timer is obsolete
      if (cur.runId !== conv.runId) return;
      if (charIndex >= total) {
        // Text complete — use estimated audio duration
        const estimatedMs = Math.max(1500, total * 120);
        const timerId = setTimeout(() => advanceConversationLine(), estimatedMs);
        uiState = { ...uiState, residentConversation: { ...cur, typingTimerId: timerId } };
        render();
        return;
      }
      charIndex++;
      const visibleText = conv.visibleText + remainingText.slice(0, charIndex);
      uiState = { ...uiState, residentConversation: { ...cur, visibleText, typingTimerId: null } };
      // Local DOM update — no full render for each character
      updateConversationVisibleText(currentLine.id, visibleText);
      const delay = getDelay(remainingText[charIndex - 1]);
      const timerId = setTimeout(tick, delay);
      uiState = { ...uiState, residentConversation: { ...uiState.residentConversation, typingTimerId: timerId } };
    };
    tick();
  }
}

/**
 * Stop the conversation and clean up.
 */
function stopResidentConversation() {
  const conv = uiState.residentConversation;
  if (!conv) return;

  clearConversationTimer();
  stopAllMimoAudio({ reason: "conversation-stop" });

  uiState = {
    ...uiState,
    residentConversation: {
      ...conv,
      status: "idle",
      queue: [],
      currentIndex: 0,
      currentLineId: "",
      visibleText: "",
      typingTimerId: null,
      runId: "",
      sessionState: null,
    },
    currentVoicePlayback: makeVoicePlaybackState(),
  };
  render();
}

// ── Voice Diagnostics Logger ───────────────────────────────────────────────────

/**
 * Sanitize a payload for safe logging (strips sensitive fields).
 * @param {object} payload
 * @returns {object}
 */
function sanitizeVoicePayload(payload = {}) {
  // Deep-clone to avoid mutating the original
  const sanitized = JSON.parse(JSON.stringify(payload));
  const sensitiveKeys = ["apiKey", "api_key", "Authorization", "Bearer", "audioUrl", "audio_url", "token", "secret"];
  for (const key of sensitiveKeys) {
    if (sanitized[key] != null) {
      const val = String(sanitized[key]);
      sanitized[key] = val.length > 8 ? val.slice(0, 4) + "***" + val.slice(-4) : "***";
    }
  }
  // Strip base64 data:audio strings
  for (const key of Object.keys(sanitized)) {
    const val = sanitized[key];
    if (typeof val === "string" && val.startsWith("data:")) {
      sanitized[key] = "[base64 audio]";
    }
    // Strip sk-..., tp-..., and long base64-like tokens found in string values
    if (typeof val === "string") {
      sanitized[key] = val
        .replace(/\b(sk|tp|api[_-]?key)[\w.-]{5,}/gi, "[key]")
        .replace(/Bearer\s+[A-Za-z0-9._-]{10,}/g, "Bearer [key]")
        .replace(/data:audio\/[^;]+;base64,[A-Za-z0-9+/=]{80,}/g, "[base64 audio]");
    }
  }
  return sanitized;
}

/**
 * Unified voice diagnostics logger.
 * Logs to console.info and stores in window.__VOICE_DEBUG__ for browser debug panel.
 * @param {string} event  - event name e.g. "minimax:generate:start"
 * @param {object} payload - safe (sanitized) payload
 */
function voiceLog(event, payload = {}) {
  const safe = sanitizeVoicePayload(payload);
  console.info(`[voice:${event}]`, safe);
  window.__VOICE_DEBUG__ = window.__VOICE_DEBUG__ || [];
  window.__VOICE_DEBUG__.push({ event, payload: safe, at: Date.now() });
  // Keep last 50 events to prevent memory bloat
  if (window.__VOICE_DEBUG__.length > 50) {
    window.__VOICE_DEBUG__.shift();
  }
}

/**
 * Build a minimal requestId for correlating frontend and server logs.
 * @returns {string}
 */
function makeRequestId() {
  return `v-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

/**
 * Build title/subtitle metadata for the voice playback bar from scene info.
 * @param {string} audioKey
 * @param {string} scene
 * @param {string} [residentId]
 * @param {string} [beatId]
 * @returns {{ title: string, subtitle: string }}
 */
function buildVoicePlaybackMeta(audioKey, scene, residentId, beatId) {
  switch (scene) {
    case "resident_dialogue": {
      const resident = state?.residents?.find((r) => r.id === residentId);
      return { title: "居民对白", subtitle: resident ? `${resident.name}的对白` : "" };
    }
    case "event_prompt":
      return { title: "事件提示", subtitle: "" };
    case "completion_feedback":
      return { title: "任务完成", subtitle: "本阶段行动完成" };
    case "day_opening":
      return { title: "今日场景", subtitle: "" };
    default:
      return { title: scene, subtitle: "" };
  }
}

/**
 * Build a voice playback state from MiniMax broadcast audio.
 */
function makeBroadcastVoicePlayback(ba) {
  return makeVoicePlaybackState({
    key: "minimax-broadcast",
    provider: "minimax",
    scene: "town_broadcast",
    sourceType: "town_broadcast",
    sourceId: "",
    title: "小镇广播",
    subtitle: "",
    textPreview: (ba.text || "").slice(0, 40),
    status: ba.status,
    error: ba.error || "",
    startedAt: ba.startedAt || Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Build a voice playback state from a MiMo ttsAudio entry.
 */
function makeMimoVoicePlayback(audioKey, ttsAudio, scene, sourceType, sourceId, title, subtitle) {
  return makeVoicePlaybackState({
    key: audioKey,
    provider: "mimo",
    scene,
    sourceType,
    sourceId,
    title: title || scene,
    subtitle: subtitle || "",
    textPreview: (ttsAudio.textPreview || "").slice(0, 40),
    status: ttsAudio.status,
    error: ttsAudio.error || "",
    startedAt: ttsAudio.startedAt || Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Build a choice aftermath object from the player's choice.
 * This is a lightweight rule-based summary — no extra M3 call needed.
 * @param {object} sourceEvent
 * @param {object} choice
 * @param {object} currentState
 * @returns {object} choiceAftermath
 */
export function buildChoiceAftermath(sourceEvent, choice, currentState) {
  const residents = currentState?.residents ?? [];
  const phase = ["早上", "下午", "晚上"];
  const phaseLabel = phase[currentState?.phaseIndex ?? 0];

  // Build summary text from choice result
  const resultText = choice?.resultText ?? "";
  const choiceLabel = choice?.label ?? "做出了选择";

  // Build summary: human-readable consequence
  let summary = resultText;
  if (!summary || summary.length < 4) {
    summary = `小镇居民们开始根据你的选择行动。`;
  }

  // Pick reacting residents
  const eventResidentIds = sourceEvent?.residentIds ?? [];
  const mentionedNames = [];
  // Try to detect resident names mentioned in choice label or result
  const allText = `${choiceLabel} ${resultText}`;
  for (const r of residents) {
    if (allText.includes(r.name)) mentionedNames.push(r);
  }
  const reactingResidents = mentionedNames.length > 0
    ? mentionedNames.slice(0, 3)
    : residents.slice(0, 2);

  // Generate short resident reactions
  const REACTION_TEMPLATES = [
    "好，我去准备一下。",
    "明白了，我这就去。",
    "明白了，我留下。",
    "那我去通知大家。",
    "好的，我来分工。",
    "没问题，交给我吧。",
    "那我去花园看看。",
    "我去工坊拿工具。",
    "好的，我在广场等大家。",
    "好，我先去森林看看情况。",
    "明白了，我去安排。",
    "好的，我去整理一下。",
  ];

  const residentReactions = reactingResidents.slice(0, 3).map((r, i) => ({
    residentId: r.id,
    residentName: r.name,
    reaction: REACTION_TEMPLATES[(r.name.length + i * 3) % REACTION_TEMPLATES.length],
    emotion: "认真",
  }));

  // Stage effect: choose a relevant place
  const placeId = sourceEvent?.placeId ?? residents[0]?.locationId ?? "plaza";
  const PLACE_ICONS = {
    garden: "🌸", cafe: "🍲", workshop: "🔨", plaza: "⛲", forest: "🌲",
  };
  const stageEffect = {
    type: "choice-ripple",
    placeId,
    icon: PLACE_ICONS[placeId] ?? "✨",
    label: "你的选择产生了影响",
  };

  return {
    id: `aftermath-${Date.now()}`,
    eventId: sourceEvent?.id ?? "",
    choiceId: choice?.id ?? "",
    choiceLabel,
    scenarioId: currentState?.activeScenario?.id ?? "",
    summary,
    residentReactions,
    stageEffect,
    memoryLabels: [],
    createdAt: Date.now(),
  };
}

/**
 * Sync currentVoicePlayback from an existing audio entry.
 */
function syncCurrentVoicePlayback(audioKey, provider) {
  if (provider === "minimax") {
    const ba = uiState.broadcastAudio;
    if (ba && ba.status !== "idle") {
      uiState = { ...uiState, currentVoicePlayback: makeBroadcastVoicePlayback(ba) };
    }
  } else if (provider === "mimo") {
    const ttsAudio = uiState.ttsAudios[audioKey];
    if (ttsAudio) {
      // We need scene info — look up from audioKey pattern
      const [scene] = audioKey.split(":");
      const sourceType = scene;
      uiState = { ...uiState, currentVoicePlayback: makeMimoVoicePlayback(audioKey, ttsAudio, scene, sourceType, "", scene, "") };
    }
  }
}

/**
 * Stop the MiniMax broadcast audio and sync broadcastAudio state.
 * @param {object} options
 * @param {string} [options.nextStatus] - Status to set (default "ready")
 * @param {boolean} [options.clearCurrentPlayback] - Clear currentVoicePlayback if minimax (default true)
 * @param {string} [options.reason] - Log reason for the stop
 */
function stopBroadcastAudio(options = {}) {
  const {
    nextStatus = "ready",
    clearCurrentPlayback = true,
    reason = "stop-broadcast",
  } = options;

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio = null;
  }

  const ba = uiState.broadcastAudio;
  if (ba && (ba.status === "playing" || ba.status === "paused")) {
    uiState = {
      ...uiState,
      broadcastAudio: {
        ...ba,
        status: ba.audioUrl ? nextStatus : "idle",
      },
      currentVoicePlayback:
        clearCurrentPlayback && uiState.currentVoicePlayback?.provider === "minimax"
          ? makeVoicePlaybackState()
          : uiState.currentVoicePlayback,
    };

    voiceLog("minimax:audio:stop", {
      reason,
      nextStatus,
      hasAudioUrl: Boolean(ba.audioUrl),
    });

    render();
  }
}

/**
 * Stop a specific MiMo audio by key and clean up its state.
 * @param {string} audioKey
 */
function stopMimoAudio(audioKey) {
  const audio = activeMimoAudios.get(audioKey);
  if (audio) {
    audio.pause();
    audio.src = "";
    audio.onended = null;
    audio.onerror = null;
    activeMimoAudios.delete(audioKey);
  }
}

/**
 * Stop all active MiMo audio instances and sync their uiState.ttsAudios status.
 * @param {object} options
 * @param {string} [options.exceptKey] - Do not stop this key's audio
 * @param {string} [options.nextStatus] - Status to set for stopped entries (default "ready")
 * @param {boolean} [options.clearCurrentPlayback] - Clear currentVoicePlayback if it was mimo (default true)
 * @param {string} [options.reason] - Log reason for the stop
 */
function stopAllMimoAudio(options = {}) {
  const {
    exceptKey = "",
    nextStatus = "ready",
    clearCurrentPlayback = true,
    reason = "stop-all-mimo",
  } = options;

  const stoppedKeys = [];

  for (const [key, audio] of activeMimoAudios) {
    if (exceptKey && key === exceptKey) continue;

    audio.pause();
    audio.src = "";
    audio.onended = null;
    audio.onerror = null;
    activeMimoAudios.delete(key);
    stoppedKeys.push(key);
  }

  if (stoppedKeys.length > 0) {
    const nextTtsAudios = { ...uiState.ttsAudios };

    for (const key of stoppedKeys) {
      const entry = nextTtsAudios[key];
      if (!entry) continue;

      nextTtsAudios[key] = {
        ...entry,
        status: entry.audioUrl ? nextStatus : "idle",
        error: null,
      };
    }

    uiState = {
      ...uiState,
      ttsAudios: nextTtsAudios,
      currentVoicePlayback:
        clearCurrentPlayback && uiState.currentVoicePlayback?.provider === "mimo"
          ? makeVoicePlaybackState()
          : uiState.currentVoicePlayback,
    };

    voiceLog("mimo:audio:stop-all", {
      reason,
      stoppedKeys,
      nextStatus,
      exceptKey,
    });

    render();
  }
}

/**
 * Play (or resume) the MiniMax broadcast audio.
 * Handles play/pause toggle: if already playing → pause.
 * If paused → resume. If ended → replay from start.
 */
function playBroadcastAudio() {
  const ba = uiState.broadcastAudio;

  if (!ba?.audioUrl) {
    voiceLog("minimax:play:skip", { reason: "no-audioUrl", status: ba?.status });
    return;
  }

  // If already playing, pause it
  if (ba.status === "playing") {
    pauseBroadcastAudio();
    return;
  }

  voiceLog("minimax:play:start", {
    status: ba.status,
    hasAudioUrl: Boolean(ba.audioUrl),
    textLength: (ba.text || "").length,
  });

  // Stop any other audio before playing
  stopBroadcastAudio({ reason: "play-minimax" });
  stopAllMimoAudio({ reason: "play-minimax" });

  uiState = {
    ...uiState,
    currentVoicePlayback: makeVoicePlaybackState({
      key: "minimax-broadcast",
      provider: "minimax",
      scene: "town_broadcast",
      sourceType: "town_broadcast",
      sourceId: "",
      title: "小镇广播",
      subtitle: "",
      textPreview: (ba.text || "").slice(0, 40),
      status: "playing",
      startedAt: Date.now(),
      updatedAt: Date.now(),
    }),
  };

  activeAudio = new Audio(ba.audioUrl);

  activeAudio.onplay = () => {
    voiceLog("minimax:play:playing", { hasAudioUrl: Boolean(ba.audioUrl) });
    uiState = {
      ...uiState,
      broadcastAudio: { ...uiState.broadcastAudio, status: "playing" },
      currentVoicePlayback: { ...uiState.currentVoicePlayback, status: "playing", updatedAt: Date.now() },
    };
    render();
  };

  activeAudio.onpause = () => {
    // Only mark paused if it wasn't ended naturally (ended → ready, paused → paused)
    if (uiState.broadcastAudio.status === "playing") {
      voiceLog("minimax:play:paused", {});
      uiState = {
        ...uiState,
        broadcastAudio: { ...uiState.broadcastAudio, status: "paused" },
        currentVoicePlayback: { ...uiState.currentVoicePlayback, status: "paused", updatedAt: Date.now() },
      };
      render();
    }
  };

  activeAudio.onended = () => {
    voiceLog("minimax:play:ended", {});
    uiState = {
      ...uiState,
      broadcastAudio: { ...uiState.broadcastAudio, status: "ready" },
      currentVoicePlayback: makeVoicePlaybackState(), // clear
    };
    activeAudio = null;
    render();
  };

  activeAudio.onerror = () => {
    voiceLog("minimax:play:error", { errorName: "AudioError", status: ba.status });
    uiState = {
      ...uiState,
      broadcastAudio: {
        ...uiState.broadcastAudio,
        status: "error",
        error: "音频播放失败，请稍后重试。",
        debugCode: "MINIMAX_TTS_AUDIO_PLAY_FAILED",
      },
      currentVoicePlayback: {
        ...uiState.currentVoicePlayback,
        status: "error",
        error: "音频播放失败，请稍后重试。",
        debugCode: "MINIMAX_TTS_AUDIO_PLAY_FAILED",
        updatedAt: Date.now(),
      },
    };
    activeAudio = null;
    render();
  };

  activeAudio.play().catch((error) => {
    // Autoplay blocked by browser — treat as paused, not error
    voiceLog("minimax:play:blocked", {
      hasAudioUrl: Boolean(ba.audioUrl),
      debugCode: "MINIMAX_TTS_AUTOPLAY_FAILED",
      errorName: error?.name,
      errorMessage: (error?.message ?? "").slice(0, 80),
    });
    uiState = {
      ...uiState,
      broadcastAudio: {
        ...uiState.broadcastAudio,
        status: "paused",
        debugCode: "MINIMAX_TTS_AUTOPLAY_FAILED",
      },
      currentVoicePlayback: { ...uiState.currentVoicePlayback, status: "paused", debugCode: "MINIMAX_TTS_AUTOPLAY_FAILED", updatedAt: Date.now() },
    };
    activeAudio = null;
    render();
  });
}

/**
 * Pause the MiniMax broadcast audio.
 */
function pauseBroadcastAudio() {
  if (activeAudio && !activeAudio.paused) {
    activeAudio.pause();
    // status will transition to "paused" via onpause handler
  }
  // Always update UI to paused (in case audio was already paused or ended)
  if (uiState.broadcastAudio.status === "playing") {
    voiceLog("minimax:pause", { status: uiState.broadcastAudio.status });
    uiState = {
      ...uiState,
      broadcastAudio: { ...uiState.broadcastAudio, status: "paused" },
      currentVoicePlayback: { ...uiState.currentVoicePlayback, status: "paused", updatedAt: Date.now() },
    };
    render();
  }
}

/**
 * Start playing a MiMo audio URL for a given audioKey.
 * @param {string} audioKey
 * @param {string} audioUrl
 */
function playMimoAudio(audioKey, audioUrl) {
  voiceLog("mimo:audio:start", { audioKey, hasAudioUrl: Boolean(audioUrl) });
  const existingAudio = activeMimoAudios.get(audioKey);
  if (existingAudio) {
    existingAudio.pause();
    existingAudio.src = "";
    activeMimoAudios.delete(audioKey);
  }

  // Clear any stale global playback state from a different source
  if (uiState.currentVoicePlayback && uiState.currentVoicePlayback.key !== audioKey) {
    // Stop any other audio from the opposite provider
    if (uiState.currentVoicePlayback.provider === "minimax") {
      stopBroadcastAudio({ reason: "play-mimo", clearCurrentPlayback: false });
    } else if (uiState.currentVoicePlayback.provider === "mimo") {
      stopAllMimoAudio({ exceptKey: audioKey, reason: "play-mimo-audio" });
    }
    uiState = { ...uiState, currentVoicePlayback: makeVoicePlaybackState() };
  }

  const audio = new Audio(audioUrl);
  activeMimoAudios.set(audioKey, audio);

  audio.onplay = () => {
    voiceLog("mimo:audio:playing", { audioKey });
    const entry = uiState.ttsAudios[audioKey];
    if (entry) {
      uiState = {
        ...uiState,
        ttsAudios: { ...uiState.ttsAudios, [audioKey]: { ...entry, status: "playing", startedAt: Date.now() } },
        currentVoicePlayback: {
          ...uiState.currentVoicePlayback,
          status: "playing",
          error: "",
          updatedAt: Date.now(),
        },
      };
      render();
    }
  };

  audio.onpause = () => {
    const entry = uiState.ttsAudios[audioKey];
    if (entry && entry.status === "playing") {
      voiceLog("mimo:audio:paused", { audioKey });
      uiState = {
        ...uiState,
        ttsAudios: { ...uiState.ttsAudios, [audioKey]: { ...entry, status: "paused" } },
        currentVoicePlayback: {
          ...uiState.currentVoicePlayback,
          status: "paused",
          updatedAt: Date.now(),
        },
      };
      render();
    }
  };

  audio.onended = () => {
    voiceLog("mimo:audio:ended", { audioKey });
    uiState = {
      ...uiState,
      ttsAudios: {
        ...uiState.ttsAudios,
        [audioKey]: { ...(uiState.ttsAudios[audioKey] ?? {}), status: "ready" },
      },
      currentVoicePlayback: makeVoicePlaybackState(), // clear
    };
    activeMimoAudios.delete(audioKey);
    render();
  };

  audio.onerror = () => {
    voiceLog("mimo:audio:error", { audioKey, errorName: "AudioError" });
    uiState = {
      ...uiState,
      ttsAudios: {
        ...uiState.ttsAudios,
        [audioKey]: {
          ...(uiState.ttsAudios[audioKey] ?? {}),
          status: "error",
          error: "音频播放失败，请稍后重试。",
        },
      },
      currentVoicePlayback: {
        ...uiState.currentVoicePlayback,
        status: "error",
        error: "音频播放失败，请稍后重试。",
        updatedAt: Date.now(),
      },
    };
    activeMimoAudios.delete(audioKey);
    render();
  };

  audio.play().catch(() => {
    // Autoplay blocked — treat as paused
    voiceLog("mimo:audio:blocked", { audioKey });
    const currentEntry = uiState.ttsAudios[audioKey];
    if (currentEntry) {
      uiState = {
        ...uiState,
        ttsAudios: { ...uiState.ttsAudios, [audioKey]: { ...currentEntry, status: "paused" } },
        currentVoicePlayback: {
          ...uiState.currentVoicePlayback,
          status: "paused",
          updatedAt: Date.now(),
        },
      };
      render();
    }
    activeMimoAudios.delete(audioKey);
  });
}

/**
 * Pause a MiMo audio by key.
 * If no real Audio instance exists but status is "playing", still updates state to "paused".
 * @param {string} audioKey
 */
function pauseMimoAudio(audioKey) {
  const audio = activeMimoAudios.get(audioKey);
  if (audio) audio.pause();
  // Even if audio instance is gone, sync state if it was playing
  const existing = uiState.ttsAudios[audioKey];
  if (existing && (existing.status === "playing" || existing.status === "paused")) {
    uiState = {
      ...uiState,
      ttsAudios: {
        ...uiState.ttsAudios,
        [audioKey]: { ...existing, status: "paused" },
      },
      currentVoicePlayback: {
        ...uiState.currentVoicePlayback,
        status: "paused",
        updatedAt: Date.now(),
      },
    };
    render();
  }
}

/**
 * Resume a MiMo audio by key.
 * If no Audio instance exists but entry has audioUrl, recreates it.
 * @param {string} audioKey
 */
function resumeMimoAudio(audioKey) {
  const existing = uiState.ttsAudios[audioKey];
  if (!existing || !existing.audioUrl) {
    voiceLog("mimo:resume:skip", { audioKey, reason: "missing-audio-url", status: existing?.status ?? "missing" });
    return;
  }
  if (existing.status !== "paused" && existing.status !== "ready") {
    voiceLog("mimo:resume:skip", { audioKey, reason: "invalid-status", status: existing.status });
    return;
  }

  stopBroadcastAudio({ reason: "resume-mimo" });
  stopAllMimoAudio({ exceptKey: audioKey, reason: "resume-mimo" });

  // Update playback state to playing first
  uiState = {
    ...uiState,
    currentVoicePlayback: {
      ...(uiState.currentVoicePlayback?.key ? uiState.currentVoicePlayback : makeVoicePlaybackState()),
      key: audioKey,
      provider: "mimo",
      status: "playing",
      error: "",
      updatedAt: Date.now(),
    },
    ttsAudios: {
      ...uiState.ttsAudios,
      [audioKey]: { ...existing, status: "playing", startedAt: Date.now() },
    },
  };
  render();

  // If Audio instance exists, play it; otherwise recreate it
  if (activeMimoAudios.has(audioKey)) {
    const audio = activeMimoAudios.get(audioKey);
    audio.play().catch((error) => {
      voiceLog("mimo:resume:error", { audioKey, errorName: error?.name, errorMessageSafe: String(error?.message ?? "").slice(0, 80) });
      const currentEntry = uiState.ttsAudios[audioKey];
      if (currentEntry) {
        uiState = {
          ...uiState,
          ttsAudios: { ...uiState.ttsAudios, [audioKey]: { ...currentEntry, status: "paused", debugCode: "MIMO_TTS_AUDIO_PLAY_FAILED" } },
          currentVoicePlayback: { ...uiState.currentVoicePlayback, status: "paused", debugCode: "MIMO_TTS_AUDIO_PLAY_FAILED", updatedAt: Date.now() },
        };
        render();
      }
    });
  } else {
    playMimoAudio(audioKey, existing.audioUrl);
  }
}

/**
 * Build a ttsAudio state object.
 * @param {object} overrides
 * @returns {object}
 */
function makeTtsAudio(overrides = {}) {
  return {
    status: "idle",   // idle | loading | ready | playing | paused | error
    audioUrl: null,
    textHash: "",
    error: null,
    debugCode: null,   // non-sensitive error category for dev debugging
    generatedAt: null,
    startedAt: null,  // when playback started
    textPreview: "",   // truncated text for voice playback bar
    ...overrides,
  };
}

// ── Task Animation Layer ────────────────────────────────────────────────────────────

const TASK_STAGE_EFFECTS = {
  plant:   { action: "work", effect: "bloom", bubble: "花园变得更有精神了。", gait: "walk" },
  cook:    { action: "work", effect: "steam",  bubble: "餐厅飘出了热气。", gait: "walk" },
  repair:  { action: "work", effect: "spark",  bubble: "工坊传来轻轻的敲打声。", gait: "walk" },
  chat:    { action: "chat", effect: "chat",   bubble: "广场上的聊天声多了起来。", gait: "walk" },
  forage:  { action: "work", effect: "leaf",   bubble: "森林里传来树叶沙沙声。", gait: "run" },
  rest:    { action: "rest", effect: "rest",   bubble: "有人在安静地休息。", gait: "slow" },
};

// ── Stage Presentation Layer ─────────────────────────────────────────────────────
// Defines how each task looks on the stage — prop emoji, action class, place effect.
// These are pure UI concerns; they do NOT affect simulation or task planning.

/**
 * @typedef {Object} StagePresentation
 * @property {string} actionClass  - CSS class suffix added to .stage-character (e.g. "is-farming")
 * @property {string} prop         - emoji shown as the character's prop/hand item
 * @property {string} propClass    - CSS class for prop animation (e.g. "prop--tool")
 * @property {string} placeEffect  - CSS class suffix for place label effect (e.g. "soil-bloom")
 * @property {string} motion       - animation type: "work-loop" | "calm-loop" | "talk-loop" | "breath-loop" | "travel-loop"
 */

/** @type {Record<string, StagePresentation>} */
const TASK_STAGE_PRESENTATIONS = {
  plant:   { actionClass: "is-farming",   prop: "⛏️", propClass: "prop--tool",   placeEffect: "soil-bloom",  motion: "work-loop"  },
  cook:    { actionClass: "is-cooking",   prop: "🍳", propClass: "prop--tool",   placeEffect: "steam-rise",  motion: "work-loop"  },
  repair:  { actionClass: "is-building",  prop: "🔧", propClass: "prop--tool",   placeEffect: "spark-float", motion: "work-loop"  },
  chat:    { actionClass: "is-chatting",  prop: "💬", propClass: "prop--chat",   placeEffect: "chat-pulse",  motion: "talk-loop"  },
  forage:  { actionClass: "is-foraging",  prop: "🧺", propClass: "prop--tool",   placeEffect: "leaf-float",  motion: "work-loop"  },
  rest:    { actionClass: "is-resting",   prop: "☁️", propClass: "prop--rest",   placeEffect: "soft-glow",   motion: "breath-loop" },
};

const TASK_COMPLETION_ICONS = {
  plant:   "🌸",
  cook:    "🍲",
  repair:  "🔧",
  chat:    "💬",
  forage:  "🌿",
  rest:    "💤",
};

const TASK_COMPLETION_LABELS = {
  plant:   "完成照看花园",
  cook:    "完成准备餐点",
  repair:  "完成工坊维护",
  chat:    "完成邻里交流",
  forage:  "完成森林采集",
  rest:    "完成休息恢复",
};

function buildCompletionFeedback(nextState) {
  return {
    id: `completion-${Date.now()}`,
    message: "本阶段行动完成",
    startedAt: Date.now(),
    residentResults: nextState.residents.map((resident) => ({
      residentId: resident.id,
      icon: TASK_COMPLETION_ICONS[resident.assignmentId] ?? "✓",
      label: TASK_COMPLETION_LABELS[resident.assignmentId] ?? "已完成",
    })),
  };
}

function getGait(taskId, resident) {
  if (taskId === "forage") return "run";
  if (taskId === "rest") return "slow";
  if ((resident?.energy ?? 100) < 30) return "slow";
  return "walk";
}

function buildTaskAnimations(prevState, nextState) {
  const prevById = new Map((prevState?.residents ?? []).map((r) => [r.id, r]));

  return nextState.residents.map((resident) => {
    const taskId = resident.assignmentId;
    const effect = TASK_STAGE_EFFECTS[taskId] ?? TASK_STAGE_EFFECTS.rest;
    const presentation = TASK_STAGE_PRESENTATIONS[taskId] ?? TASK_STAGE_PRESENTATIONS.rest;
    const gait = getGait(taskId, resident);

    const fromResident = prevById.get(resident.id);
    const fromPlaceId = fromResident?.locationId ?? null;
    const toPlaceId = resident.locationId ?? effect.placeId ?? null;
    const traveling = fromPlaceId != null && toPlaceId !== fromPlaceId;

    return {
      id: `anim-${Date.now()}-${resident.id}`,
      residentId: resident.id,
      taskId,
      fromPlaceId: fromPlaceId ?? toPlaceId,
      toPlaceId,
      placeId: toPlaceId,
      action: effect.action,
      effect: effect.effect,
      bubble: effect.bubble,
      gait,
      traveling,
      // Presentation
      presentationClass: presentation.actionClass,
      prop: presentation.prop,
      propClass: presentation.propClass,
      placeEffect: presentation.placeEffect,
      motion: presentation.motion,
      startedAt: Date.now(),
    };
  });
}

function showTaskAnimations(prevState, nextState, options = {}) {
  if (animationTimer) clearTimeout(animationTimer);
  if (completionTimer) { clearTimeout(completionTimer); completionTimer = null; }
  uiState = {
    ...uiState,
    activeTaskAnimations: buildTaskAnimations(prevState, nextState),
    isAnimating: true,
    animationMessage: "居民正在行动中……",
    completionFeedback: null,
  };
  render();
  animationTimer = setTimeout(() => {
    // Animation done — show completion feedback
    uiState = {
      ...uiState,
      activeTaskAnimations: [],
      isAnimating: false,
      animationMessage: "",
      completionFeedback: buildCompletionFeedback(nextState),
    };
    animationTimer = null;
    render();
    // Clear completion feedback after a short display
    completionTimer = setTimeout(() => {
      uiState = { ...uiState, completionFeedback: null };
      completionTimer = null;
      render();
      if (typeof options.afterComplete === "function") {
        options.afterComplete();
      }
    }, COMPLETION_FEEDBACK_MS);
  }, TASK_ANIMATION_DURATION_MS);
}

// ── Day Opening Reflection ─────────────────────────────────────────────────────

/**
 * Build a day-opening reflection from the most recent player choice or memory.
 * This is a UI-only state — does not persist to state.townMemory.
 * Priority: choiceAftermath > townMemory player-choice > residentMemory > fallback
 *
 * @param {object} state  - current game state
 * @param {object} uiState - current UI state (contains choiceAftermath)
 * @returns {object|null} dayOpeningReflection object or null
 */
function buildDayOpeningReflection(state, uiState) {
  const tm = state.townMemory ?? [];
  const residents = state.residents ?? [];

  // Use buildTownMemoryReferences to get structured memory references
  const memoryRefs = buildTownMemoryReferences(state, { maxReferences: 2 });

  // 1. Check choiceAftermath first (most recent session memory)
  const ca = uiState.choiceAftermath;
  if (ca && ca.id) {
    const labels = ca.memoryLabels ?? [];
    if (labels.length === 0 && ca.choiceLabel) {
      labels.push(`你选择了：${ca.choiceLabel}`);
    }
    // Show more detail if we have memory references
    const moreDetail = memoryRefs.hasMemory && memoryRefs.references.length > 0
      ? ` · ${memoryRefs.references[0].text.slice(0, 20)}`
      : "";
    return {
      id: `opening-${Date.now()}`,
      sourceType: "choiceAftermath",
      sourceId: ca.id,
      title: "昨日回响",
      summary: ca.summary || `你选择了「${ca.choiceLabel}」，小镇正在延续这个选择的影响。`,
      memoryLabels: labels,
      memoryDetail: memoryRefs.hasMemory ? memoryRefs.references[0].text : "",
      scenarioHint: "",
      createdAt: Date.now(),
    };
  }

  // 2. Check townMemory for most recent player-choice
  const choiceMemories = tm.filter((m) => m.type === "player-choice" || m.type === "choice-memory");
  if (choiceMemories.length > 0) {
    const last = choiceMemories[choiceMemories.length - 1];
    return {
      id: `opening-${Date.now()}`,
      sourceType: "townMemory",
      sourceId: last.id || "",
      title: "昨日回响",
      summary: last.text
        ? `昨天：${last.text}`
        : "昨天你做了一个选择，小镇今天还记得这件事。",
      memoryLabels: [last.text?.slice(0, 30) ?? "昨日选择"].filter(Boolean),
      memoryDetail: last.text ?? "",
      scenarioHint: "",
      createdAt: Date.now(),
    };
  }

  // 3. Check resident memories for choice-related content
  const residentMemories = residents
    .flatMap((r) => (r.memory ?? []).map((m) => ({ resident: r.name, text: m })))
    .filter((m) => /选择了?|选择|玩家|事件/.test(m.text));
  if (residentMemories.length > 0) {
    const last = residentMemories[residentMemories.length - 1];
    return {
      id: `opening-${Date.now()}`,
      sourceType: "residentMemory",
      sourceId: "",
      title: "昨日回响",
      summary: `昨天${last.resident}记得：${last.text.slice(0, 40)}`,
      memoryLabels: [last.resident],
      memoryDetail: last.text ?? "",
      scenarioHint: "",
      createdAt: Date.now(),
    };
  }

  // 4. Fallback: no memory, gentle default
  return {
    id: `opening-${Date.now()}`,
    sourceType: "fallback",
    sourceId: "",
    title: "新的一天",
    summary: "今天的小镇又开始了新的故事。",
    memoryLabels: [],
    scenarioHint: "",
    createdAt: Date.now(),
  };
}

// ── Resident Voice Clips ────────────────────────────────────────────────────────────

/**
 * Build a list of playable resident voice clips from current state and UI state.
 * Each clip has an audioKey, resident info, text, and priority for recommendation.
 * This is a UI-only derivation — does not modify simulation state.
 *
 * @param {object} state
 * @param {object} uiState
 * @returns {Array} residentVoiceClips
 */
function buildResidentVoiceClips(state, uiState) {
  const clips = [];
  const residents = state.residents ?? [];
  const beats = uiState.residentSceneBeats ?? [];
  const aftermath = uiState.choiceAftermath;
  const activeScenario = uiState.activeScenario;

  // 1. Add clips from residentSceneBeats
  for (const beat of beats) {
    if (!beat?.dialogue || !beat?.residentId) continue;
    const resident = residents.find((r) => r.id === beat.residentId);
    const audioKey = `resident_dialogue:${beat.residentId}:${beat.id}`;
    const priority = (activeScenario?.id === beat.scenarioId) ? 80 : 50;
    clips.push({
      key: audioKey,
      residentId: beat.residentId,
      residentName: beat.residentName ?? resident?.name ?? "",
      scene: "resident_dialogue",
      sourceType: "resident_dialogue",
      title: `${beat.residentName ?? resident?.name ?? ""}的对白`,
      text: beat.dialogue,
      reason: beat.actionHint ? `正在${beat.actionHint}` : "",
      priority,
    });
  }

  // 2. Add clips from choiceAftermath resident reactions
  if (aftermath?.residentReactions?.length > 0) {
    for (const reaction of aftermath.residentReactions) {
      if (!reaction?.reaction) continue;
      const audioKey = `choice_reaction:${reaction.residentId}:${aftermath.id}`;
      clips.push({
        key: audioKey,
        residentId: reaction.residentId,
        residentName: reaction.residentName ?? "",
        scene: "choice_reaction",
        sourceType: "choice_reaction",
        title: `${reaction.residentName ?? ""}的反应`,
        text: reaction.reaction,
        reason: "刚刚的选择反应",
        priority: 95,
      });
    }
  }

  // 3. Add clips from low-mood residents (no beat yet)
  for (const resident of residents) {
    if (resident.mood < 45) {
      // Find if already in clips
      const already = clips.find((c) => c.residentId === resident.id);
      if (!already) {
        clips.push({
          key: `low_mood:${resident.id}`,
          residentId: resident.id,
          residentName: resident.name,
          scene: "resident_mood",
          sourceType: "resident_mood",
          title: `${resident.name}的心情`,
          text: `${resident.name}今天心情有点低落，可能需要关心一下。`,
          reason: "心情较低",
          priority: 40,
        });
      }
    }
  }

  // 4. Fallback: generate voice clips from resident current tasks (always produces at least one clip per resident)
  const TASK_FALLBACK_LINES = {
    repair: ["我去工坊看看有什么要修的。", "工具都准备好了吗？", "这地方得好好检修一下。"],
    plant: ["花园里的植物该浇水了。", "我去看看花园的情况。", "今天想在花园多待一会儿。"],
    cook: ["我去厨房看看有什么能准备的。", "该想想今天做什么菜了。", "食材还够吗？"],
    chat: ["和大家聊聊天也不错。", "广场上好像挺热闹的。", "好久没和人好好说话了。"],
    forage: ["森林里应该能找到些好东西。", "我去森林那边转转。", "采集一些材料回来。"],
    rest: ["今天有点累了，休息一下吧。", "找个安静的地方待一会儿。", "先歇一歇再说。"],
  };
  for (const resident of residents) {
    const already = clips.find((c) => c.residentId === resident.id);
    if (!already) {
      const taskId = resident.assignmentId ?? "rest";
      const lines = TASK_FALLBACK_LINES[taskId] ?? TASK_FALLBACK_LINES.rest;
      const text = lines[resident.name.length % lines.length];
      clips.push({
        key: `task_fallback:${resident.id}`,
        residentId: resident.id,
        residentName: resident.name,
        scene: "resident_dialogue",
        sourceType: "task_fallback",
        title: `${resident.name}的日常`,
        text,
        reason: `当前任务：${taskId}`,
        priority: 20,
      });
    }
  }

  return clips;
}

/**
 * Select the recommended resident voice clip based on current state.
 * Priority: choiceAftermath reactions > matching scenario beats > low-mood > fallback
 *
 * @param {Array} clips
 * @param {object} state
 * @param {object} uiState
 * @returns {object|null} recommendedClip or null
 */
function selectRecommendedResidentVoiceClip(clips, state, uiState) {
  if (!clips || clips.length === 0) return null;

  // Highest priority: choice aftermath reactions
  const reactionClips = clips.filter((c) => c.sourceType === "choice_reaction");
  if (reactionClips.length > 0) return reactionClips[0];

  // Second: active scenario matching beats
  const scenario = uiState.activeScenario?.id;
  if (scenario) {
    const scenarioClips = clips.filter(
      (c) => c.scene === "resident_dialogue" && c.sourceType === "resident_dialogue"
    );
    if (scenarioClips.length > 0) return scenarioClips[0];
  }

  // Third: any resident dialogue clip
  const dialogueClips = clips.filter((c) => c.scene === "resident_dialogue");
  if (dialogueClips.length > 0) return dialogueClips[0];

  // Fourth: low-mood resident
  const moodClips = clips.filter((c) => c.sourceType === "resident_mood");
  if (moodClips.length > 0) return moodClips[0];

  return clips[0] ?? null;
}

// ── Day Cycle Orchestration ─────────────────────────────────────────────────────

/**
 * Advance through all remaining phases, then orchestrate AI Director,
 * resident dialogues, broadcast, and events — all in one player-initiated flow.
 *
 * Fallback at each step ensures the day cycle is never fully broken.
 *
 * @returns {Promise<void>}
 */
async function runTownDayCycle() {
  // Guard: don't run while animating or already cycling
  if (uiState.isAnimating) return;
  if (uiState.dayCycle.status === "running") return;

  stopAutoPlay();

  // Reset cycle state
  uiState = {
    ...uiState,
    dayCycle: {
      status: "running",
      step: "正在启动小镇一天……",
      scenarioId: "",
      error: "",
      startedAt: Date.now(),
      completedAt: 0,
    },
  };
  render();

  try {
    // ── Step 1: Advance all remaining phases ──────────────────────────────────
    uiState = { ...uiState, dayCycle: { ...uiState.dayCycle, step: "居民正在行动……" } };
    render();

    let prev = state;
    let next = state;
    const steps = 3 - state.phaseIndex;
    for (let i = 0; i < steps; i += 1) {
      next = advancePhase(next);
    }

    // Select scenario and generate fallback beats (synchronous, no M3 call)
    const scenario = selectTownLifeScenario(next);
    const beats = buildFallbackResidentSceneBeats(next, null);

    // Apply the advanced state
    commit(next);
    uiState = {
      ...uiState,
      activeScenario: scenario,
      residentSceneBeats: beats,
      dayCycle: { ...uiState.dayCycle, scenarioId: scenario.id, step: "行动完成，正在生成对白……" },
    };
    render();

    // ── Step 2: AI Director context ───────────────────────────────────────────
    // Build day opening reflection before director context so it can be included
    const openingReflection = buildDayOpeningReflection(state, uiState);
    uiState = { ...uiState, dayOpeningReflection: openingReflection };

    let directorCtx;
    try {
      directorCtx = buildAiDirectorContext(next, uiState.choiceAftermath, openingReflection);
    } catch (dirErr) {
      console.warn("[dayCycle] AI Director context fallback:", dirErr);
      directorCtx = { activeScenario: scenario };
    }

    // ── Step 3: Resident dialogues (async, fallback on failure) ───────────────
    uiState = { ...uiState, dayCycle: { ...uiState.dayCycle, step: "生成居民对白……" } };
    render();

    let dialogueBeats = beats; // use fallback beats as base
    try {
      const m3Dialogue = await requestMiniMaxResidentDialogues(next, directorCtx, uiState.choiceAftermath, openingReflection);
      if (Array.isArray(m3Dialogue) && m3Dialogue.length > 0) {
        dialogueBeats = m3Dialogue;
      }
    } catch (diagErr) {
      console.warn("[dayCycle] Resident dialogue fallback:", diagErr);
    }
    uiState = { ...uiState, residentSceneBeats: dialogueBeats };

    // ── Step 4: Broadcast (async, fallback on failure) ───────────────────────
    uiState = { ...uiState, dayCycle: { ...uiState.dayCycle, step: "生成小镇广播……" } };
    render();

    try {
      const bcResult = await requestMiniMaxBroadcast(next, directorCtx);
      const bc = bcResult.broadcast;
      if (bc && bc.id) {
        const currentPhase = phases[state.phaseIndex];
        const newBcEvent = {
          id: bc.id ?? `broadcast-${Date.now()}`,
          type: "town-broadcast",
          day: state.day,
          phase: currentPhase.label,
          title: bc.title,
          text: bc.script,
          mood: bc.mood,
          musicMood: bc.musicMood,
          musicPrompt: bc.musicPrompt,
          residentIds: bc.relatedResidentIds ?? [],
          placeId: bc.placeId ?? "plaza",
          durationHint: bc.durationHint ?? "15-30s",
          memoryReferences: buildPromptMemoryNarrative(state).uiLabels,
        };
        state = { ...state, events: [...(state.events ?? []), newBcEvent] };
        uiState = {
          ...uiState,
          latestBroadcast: { ...bc, memoryReferences: newBcEvent.memoryReferences },
          broadcastAudio: makeAudioState({
            text: bc.script ?? "",
            scriptHash: hashBroadcastScript(bc.script ?? ""),
          }),
          dayCycle: { ...uiState.dayCycle, step: "广播已生成。" },
        };
        saveState(state);
      }
    } catch (bcErr) {
      console.warn("[dayCycle] Broadcast fallback:", bcErr);
      uiState = {
        ...uiState,
        broadcastStatus: "error",
        broadcastMessage: "广播生成失败，使用本地广播。",
        dayCycle: { ...uiState.dayCycle, step: "广播已生成（本地）。" },
      };
    }
    render();

    // ── Step 5: Event (async, fallback on failure) ────────────────────────────
    uiState = { ...uiState, dayCycle: { ...uiState.dayCycle, step: "生成小镇事件……" } };
    render();

    try {
      const evtResult = await requestMiniMaxEvent(next, directorCtx);
      const evt = evtResult.event;
      if (evt && evt.id) {
        const currentPhase = phases[state.phaseIndex];
        const newEvent = {
          id: evt.id ?? `m3-event-${Date.now()}`,
          type: "m3-event",
          day: state.day,
          phase: currentPhase.label,
          title: evt.title,
          text: evt.text,
          tone: evt.tone ?? "cozy",
          residentIds: evt.residentIds ?? [],
          placeId: evt.placeId ?? "plaza",
          suggestedFollowUp: evt.suggestedFollowUp ?? "",
          choices: evt.choices ?? [],
          chosenChoiceId: null,
          choiceResultText: null,
          memoryReferences: buildPromptMemoryNarrative(state).uiLabels,
        };
        state = { ...state, events: [...(state.events ?? []), newEvent] };
        saveState(state);
        uiState = {
          ...uiState,
          eventDirectorStatus: "ready",
          eventDirectorMessage: "小镇事件已加入动态。",
        };
      }
    } catch (evtErr) {
      console.warn("[dayCycle] Event fallback:", evtErr);
      uiState = {
        ...uiState,
        eventDirectorStatus: "error",
        eventDirectorMessage: "事件生成失败，请稍后重试。",
      };
    }

    // ── Step 6: Waiting for player choice ────────────────────────────────────
    uiState = {
      ...uiState,
      dayCycle: {
        status: "waiting_choice",
        step: "等待你的选择……",
        scenarioId: uiState.dayCycle.scenarioId,
        error: "",
        startedAt: uiState.dayCycle.startedAt,
        completedAt: 0,
      },
    };
    render();

  } catch (err) {
    console.error("[dayCycle] Unexpected error:", err);
    uiState = {
      ...uiState,
      dayCycle: {
        status: "error",
        step: "流程出错",
        scenarioId: uiState.dayCycle.scenarioId,
        error: "小镇一天遇到了一点问题，请重试。",
        startedAt: uiState.dayCycle.startedAt,
        completedAt: 0,
      },
    };
    render();
  }
}

/**
 * Complete the day cycle after a player choice has been made.
 * Called automatically when onChooseEvent is invoked.
 *
 * @param {object} nextState - the state after choice has been applied
 */
/**
 * Transition the dayCycle UI to "completed" status and schedule reset to idle.
 * Does NOT commit state — caller must have already done that.
 * Only runs when dayCycle is in "waiting_choice" status.
 */
function transitionDayCycleToCompleted() {
  if (uiState.dayCycle.status !== "waiting_choice") return;
  uiState = {
    ...uiState,
    dayCycle: {
      status: "completed",
      step: "已完成",
      scenarioId: uiState.dayCycle.scenarioId,
      error: "",
      startedAt: uiState.dayCycle.startedAt,
      completedAt: Date.now(),
    },
  };
  render();
  // Reset dayCycle to idle after a short display
  setTimeout(() => {
    uiState = { ...uiState, dayCycle: { ...DAY_CYCLE_DEFAULT } };
    render();
  }, 2500);
}

/**
 * @deprecated Use transitionDayCycleToCompleted() instead. State must be committed by caller.
 */
function completeDayCycle() {
  // State commit is now done by the caller (onChooseEvent).
  // This only handles the dayCycle UI transition.
  transitionDayCycleToCompleted();
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearTimeout(autoPlayTimer);
    autoPlayTimer = null;
  }
  uiState = { ...uiState, autoPlay: false };
}

/**
 * Generate resident scene beats for the current state.
 * Uses fallback generation (synchronous, no M3 call) to keep phase advance fast.
 * M3 beat refresh happens asynchronously in the event/broadcast handlers.
 *
 * @param {object} currentState
 * @param {object|null} openingReflection
 * @returns {Array}
 */
function generateResidentBeats(currentState, openingReflection = null) {
  try {
    const directorCtx = buildAiDirectorContext(currentState, uiState.choiceAftermath, openingReflection);
    return buildFallbackResidentSceneBeats(currentState, directorCtx);
  } catch {
    return [];
  }
}

function scheduleAutoPlay() {
  if (!uiState.autoPlay) return;
  if (autoPlayTimer) clearTimeout(autoPlayTimer);
  autoPlayTimer = setTimeout(() => {
    if (!uiState.autoPlay) return;
    if (uiState.isAnimating) {
      // wait for animation to finish then retry
      scheduleAutoPlay();
      return;
    }
    const prev = state;
    const next = advancePhase(state);
    commit(next);
    showTaskAnimations(prev, next, { afterComplete: scheduleAutoPlay });
  }, AUTO_PLAY_DELAY_MS);
}

function startAutoPlay() {
  if (autoPlayTimer) return;
  uiState = { ...uiState, autoPlay: true };
  scheduleAutoPlay();
}

function commit(nextState) {
  try {
    state = nextState;
    saveState(state);
    render();
  } catch (error) {
    renderError(error);
  }
}

function render() {
  try {
    renderApp(root, state, {
      onAdvance: () => {
        if (uiState.isAnimating) return;
        const prev = state;
        const next = advancePhase(state);
        const scenario = selectTownLifeScenario(next);
        const beats = generateResidentBeats(next);
        uiState = { ...uiState, activeScenario: scenario, residentSceneBeats: beats };
        commit(next);
        showTaskAnimations(prev, next);
      },
      onRunDay: () => {
        if (uiState.isAnimating) return;
        let prev = state;
        let next = state;
        const steps = 3 - state.phaseIndex;
        for (let index = 0; index < steps; index += 1) {
          next = advancePhase(next);
        }
        const scenario = selectTownLifeScenario(next);
        const beats = generateResidentBeats(next);
        uiState = { ...uiState, activeScenario: scenario, residentSceneBeats: beats };
        commit(next);
        showTaskAnimations(prev, next);
      },
      onToggleAutoPlay: () => {
        if (autoPlayTimer) {
          stopAutoPlay();
        } else {
          startAutoPlay();
        }
        render();
      },
      onMiniMaxPlan: async () => {
        stopAutoPlay();
        uiState = { ...uiState, llmStatus: "loading", llmMessage: "正在观察居民状态和小镇资源……" };
        render();
        try {
          const plan = await requestMiniMaxPlan(state);
          const townNote = plan.townNote ? `✨ ${plan.townNote}` : "✨ AI 管家已完成本轮安排~";
          uiState = { ...uiState, llmStatus: "ready", llmMessage: townNote };
          commit(applyAgentPlan(state, plan));
        } catch (error) {
          uiState = { ...uiState, llmStatus: "error", llmMessage: error.message };
          render();
        }
      },
      onMiniMaxEvent: async () => {
        stopAutoPlay();
        uiState = { ...uiState, eventDirectorStatus: "loading", eventDirectorMessage: "M3 正在观察居民和小镇动态……" };
        render();
        try {
          const directorCtx = {
            ...buildAiDirectorContext(state, uiState.choiceAftermath),
            residentBeatsSummary: buildBeatsSummary(uiState.residentSceneBeats),
          };
          const result = await requestMiniMaxEvent(state, directorCtx);
          const evt = result.event;
          const currentPhase = phases[state.phaseIndex];
          const newEvent = {
            id: evt.id ?? `m3-event-${Date.now()}`,
            type: "m3-event",
            day: state.day,
            phase: currentPhase.label,
            title: evt.title,
            text: evt.text,
            tone: evt.tone ?? "cozy",
            residentIds: evt.residentIds ?? [],
            placeId: evt.placeId ?? "plaza",
            suggestedFollowUp: evt.suggestedFollowUp ?? "",
            choices: evt.choices ?? [],
            chosenChoiceId: null,
            choiceResultText: null,
            // Tag event with memory references for UI display
            memoryReferences: buildPromptMemoryNarrative(state).uiLabels,
          };
          const nextState = {
            ...state,
            events: [...(state.events ?? []), newEvent],
          };
          const followUp = evt.suggestedFollowUp
            ? `✨ 建议：${evt.suggestedFollowUp}`
            : "✨ 小镇事件已加入动态。";
          uiState = { ...uiState, eventDirectorStatus: "ready", eventDirectorMessage: followUp };
          commit(nextState);
        } catch (error) {
          uiState = { ...uiState, eventDirectorStatus: "error", eventDirectorMessage: error.message };
          render();
        }
      },
      onChooseEvent: (eventId, choiceId) => {
        const events = state.events ?? [];
        const sourceEvent = events.find((e) => e.id === eventId);
        if (!sourceEvent) return;
        if (sourceEvent.type !== "m3-event") return;
        if (sourceEvent.chosenChoiceId) return;
        const choice = (sourceEvent.choices ?? []).find((c) => c.id === choiceId);
        if (!choice) return;

        const currentPhase = phases[state.phaseIndex];
        const nextState = applyChoiceMemory(state, sourceEvent, choice, currentPhase);
        const aftermath = buildChoiceAftermath(sourceEvent, choice, state);
        const phaseLabel = currentPhase.label;

        // Always commit the choice — both day-cycle path and manual-event path
        state = nextState;
        saveState(state);

        uiState = {
          ...uiState,
          completionFeedback: {
            residentResults: [],
            phase: phaseLabel,
            generatedAt: Date.now(),
          },
          choiceAftermath: aftermath,
        };

        // Render immediately so the chosen state is visible
        render();

        // Only complete the dayCycle UI when it was in waiting_choice status
        transitionDayCycleToCompleted();
      },
      onMiniMaxBroadcast: async () => {
        stopAutoPlay();
        uiState = { ...uiState, broadcastStatus: "loading", broadcastMessage: "M3 正在整理今天的小镇广播……" };
        render();
        try {
          const directorCtx = {
            ...buildAiDirectorContext(state, uiState.choiceAftermath),
            residentBeatsSummary: buildBeatsSummary(uiState.residentSceneBeats),
          };
          const result = await requestMiniMaxBroadcast(state, directorCtx);
          const bc = result.broadcast;
          const currentPhase = phases[state.phaseIndex];
          const newEvent = {
            id: bc.id ?? `broadcast-${Date.now()}`,
            type: "town-broadcast",
            day: state.day,
            phase: currentPhase.label,
            title: bc.title,
            text: bc.script,
            mood: bc.mood,
            musicMood: bc.musicMood,
            musicPrompt: bc.musicPrompt,
            residentIds: bc.relatedResidentIds ?? [],
            placeId: bc.placeId ?? "plaza",
            durationHint: bc.durationHint ?? "15-30s",
          };
          const nextState = {
            ...state,
            events: [...(state.events ?? []), newEvent],
          };
          uiState = {
            ...uiState,
            broadcastStatus: "ready",
            broadcastMessage: "小镇广播已加入动态。",
            latestBroadcast: {
              ...bc,
              // Tag UI labels for "引用记忆" display
              memoryReferences: buildPromptMemoryNarrative(state).uiLabels,
            },
            // Reset TTS state when new broadcast is generated
            broadcastAudio: makeAudioState({ text: bc.script ?? "", scriptHash: hashBroadcastScript(bc.script ?? "") }),
          };
          commit(nextState);
        } catch (error) {
          uiState = { ...uiState, broadcastStatus: "error", broadcastMessage: error.message };
          render();
        }
      },
      onGenerateTts: async () => {
        // Stop any running conversation when user starts a broadcast
        if (uiState.residentConversation?.status === "playing" || uiState.residentConversation?.status === "paused") {
          stopResidentConversation();
        }
        const latestBc = uiState.latestBroadcast;
        if (!latestBc) { voiceLog("minimax:generate:skip", { reason: "no-broadcast" }); return; }
        const scriptText = latestBc.script ?? latestBc.text ?? "";
        if (!scriptText.trim()) { voiceLog("minimax:generate:skip", { reason: "empty-script" }); return; }

        const currentHash = hashBroadcastScript(scriptText);
        const ba = uiState.broadcastAudio;

        // If loading, ignore (prevent double generation)
        if (ba.status === "loading") { voiceLog("minimax:generate:skip", { reason: "already-loading" }); return; }

        voiceLog("minimax:generate:start", {
          hasScript: Boolean(scriptText),
          scriptLength: scriptText.length,
          status: ba.status,
          hasAudioUrl: Boolean(ba.audioUrl),
        });

        // Stop any active audio before generating
        stopBroadcastAudio({ reason: "generate-minimax" });

        uiState = {
          ...uiState,
          broadcastAudio: makeAudioState({
            status: "loading",
            text: scriptText,
            scriptHash: currentHash,
          }),
        };
        render();

        try {
          const result = await generateBroadcastSpeech(scriptText);
          voiceLog("minimax:generate:success", {
            hasAudioUrl: Boolean(result.audioUrl),
            traceId: result.traceId,
            requestId: result.requestId,
            debugCode: result.debugCode,
            scriptLength: scriptText.length,
          });
          uiState = {
            ...uiState,
            broadcastAudio: {
              status: "ready",
              text: scriptText,
              audioUrl: result.audioUrl,
              error: null,
              debugCode: result.debugCode,
              traceId: result.traceId,
              requestId: result.requestId,
              generatedAt: Date.now(),
              scriptHash: currentHash,
            },
          };
          render();
          // Auto-play after successful generation
          playBroadcastAudio();
        } catch (error) {
          // Categorize MiniMax TTS errors for dev debugging
          // NOTE: generateBroadcastSpeech only throws on actual failure (network error,
          // HTTP non-ok, or server-side ok=false). It NEVER throws on success.
          // So if we are here, the TTS request genuinely failed.
          const msg = error.message ?? "";
          // Extract server-side debugCode and requestId if embedded in message
          const debugCodeMatch = msg.match(/\[([A-Z_]+)\]/);
          const requestIdMatch = msg.match(/\(req:\s*([^)]+)\)/);
          const serverDebugCode = debugCodeMatch ? debugCodeMatch[1] : null;
          const requestId = requestIdMatch ? requestIdMatch[1] : null;

          // Determine the appropriate debug code:
          // - Use the actual server code if present (e.g. MINIMAX_TTS_UPSTREAM_ERROR,
          //   MINIMAX_TTS_NO_AUDIO, MINIMAX_TTS_NO_DATA)
          // - Otherwise categorize by error type
          let devTag;
          if (serverDebugCode) {
            devTag = serverDebugCode;
          } else if (msg.includes("fetch") || msg.includes("network") || msg.includes("Network") || msg.includes("Failed to fetch")) {
            devTag = "MINIMAX_TTS_REQUEST_FAILED";
          } else if (msg.includes("400") || msg.includes("401") || msg.includes("403")) {
            devTag = "MINIMAX_TTS_AUTH_ERROR";
          } else if (msg.includes("500") || msg.includes("502") || msg.includes("503")) {
            devTag = "MINIMAX_TTS_SERVER_ERROR";
          } else {
            devTag = "MINIMAX_TTS_REQUEST_FAILED";
          }

          voiceLog("minimax:generate:error", {
            debugCode: devTag,
            serverDebugCode,
            requestId,
            errorName: error.name,
            errorMessageSafe: msg.slice(0, 120),
            status: ba.status,
            scriptLength: scriptText.length,
          });
          uiState = {
            ...uiState,
            broadcastAudio: {
              status: "error",
              text: scriptText,
              audioUrl: null,
              error: "MiniMax 广播语音生成失败，请稍后重试。",
              debugCode: devTag,
              requestId,
              traceId: null,
              generatedAt: null,
              scriptHash: currentHash,
            },
          };
          render();
        }
      },
      onPlayTts: () => {
        playBroadcastAudio();
      },
      onPauseTts: () => {
        pauseBroadcastAudio();
      },
      // ── MiMo TTS for lightweight scenes ────────────────────────────────────
      /**
       * Generate and/or play a MiMo TTS audio for a given scene.
       * Stops any currently playing MiMo audio before starting a new one.
       *
       * @param {string} audioKey  - unique key e.g. "resident_dialogue:hua:beat-123"
       * @param {string} text      - text to synthesize
       * @param {string} scene     - scene type
       * @param {string} [residentId]
       * @param {string} [beatId]
       */
      onPlayMimoTts: (audioKey, text, scene, residentId, beatId) => {
        // Stop conversation if user manually plays a MiMo clip
        if (uiState.residentConversation?.status === "playing" || uiState.residentConversation?.status === "paused") {
          stopResidentConversation();
        }
        if (!text || !text.trim()) {
          voiceLog("mimo:play:skip", { audioKey, scene, residentId, beatId, reason: "empty-text" });
          return;
        }

        voiceLog("mimo:play:start", {
          audioKey, scene, residentId, beatId,
          textLength: text.length,
          hasText: Boolean(text && text.trim()),
        });

        const currentHash = hashText(text);
        const existing = uiState.ttsAudios[audioKey];

        // Build title/subtitle for the playback bar
        const sourceType = scene;
        const sourceId = residentId || beatId || "";
        const meta = buildVoicePlaybackMeta(audioKey, scene, residentId, beatId, state);

        // 1. Same key is loading — ignore
        if (existing?.status === "loading") {
          voiceLog("mimo:play:skip", { audioKey, reason: "already-loading", status: existing?.status });
          return;
        }

        // 2. Same key is playing — pause it, don't stop
        if (existing?.status === "playing") {
          voiceLog("mimo:play:pause-same", { audioKey, reason: "pause-same-key" });
          pauseMimoAudio(audioKey);
          return;
        }

        // 3. Same key is paused with valid audio — resume
        if (existing?.status === "paused" && existing.audioUrl && existing.textHash === currentHash) {
          voiceLog("mimo:play:resume-cached", { audioKey, scene, status: existing.status });
          stopBroadcastAudio({ reason: "resume-mimo", clearCurrentPlayback: false });
          stopAllMimoAudio({ exceptKey: audioKey, nextStatus: "ready", reason: "resume-mimo" });
          resumeMimoAudio(audioKey);
          return;
        }

        // 4. Same key is ready with same hash — replay cached
        if (existing?.status === "ready" && existing.audioUrl && existing.textHash === currentHash) {
          voiceLog("mimo:play:replay-cached", { audioKey, scene, status: existing.status });
          stopBroadcastAudio({ reason: "play-cached-mimo", clearCurrentPlayback: false });
          stopAllMimoAudio({ exceptKey: audioKey, nextStatus: "ready", reason: "play-cached-mimo" });
          // Set playing state before calling playMimoAudio
          uiState = {
            ...uiState,
            ttsAudios: {
              ...uiState.ttsAudios,
              [audioKey]: { ...existing, startedAt: Date.now(), textPreview: text.slice(0, 40) },
            },
            currentVoicePlayback: makeVoicePlaybackState({
              key: audioKey,
              provider: "mimo",
              scene,
              sourceType,
              sourceId,
              title: meta.title,
              subtitle: meta.subtitle,
              textPreview: text.slice(0, 40),
              status: "playing",
              startedAt: Date.now(),
              updatedAt: Date.now(),
            }),
          };
          render();
          playMimoAudio(audioKey, existing.audioUrl);
          return;
        }

        // 5. Stop other audio before generating new
        stopBroadcastAudio({ reason: "generate-mimo" });
        stopAllMimoAudio(); // no-arg form — stops all, updates ttsAudios

        // Set loading state
        voiceLog("mimo:play:request", { audioKey, scene, textLength: text.length });
        uiState = {
          ...uiState,
          ttsAudios: {
            ...uiState.ttsAudios,
            [audioKey]: makeTtsAudio({ status: "loading", textHash: currentHash, textPreview: text.slice(0, 40) }),
          },
          currentVoicePlayback: makeVoicePlaybackState({
            key: audioKey,
            provider: "mimo",
            scene,
            sourceType,
            sourceId,
            title: meta.title,
            subtitle: meta.subtitle,
            textPreview: text.slice(0, 40),
            status: "loading",
            startedAt: Date.now(),
            updatedAt: Date.now(),
          }),
        };
        render();

        // Resolve provider and call appropriate generator
        resolveTtsProviderForScene(scene); // no-op, provider is always mimo
        generateMimoSpeech({ scene, text, emotion: "neutral", speed: 1.0 })
          .then((result) => {
            voiceLog("mimo:play:success", {
              audioKey, scene,
              hasAudioUrl: Boolean(result.audioUrl),
              requestId: result.requestId,
              debugCode: result.debugCode,
            });
            uiState = {
              ...uiState,
              ttsAudios: {
                ...uiState.ttsAudios,
                [audioKey]: makeTtsAudio({
                  status: "ready",
                  audioUrl: result.audioUrl,
                  textHash: currentHash,
                  generatedAt: Date.now(),
                  textPreview: text.slice(0, 40),
                  requestId: result.requestId,
                  debugCode: result.debugCode,
                }),
              },
            };
            render();
            // playMimoAudio will set currentVoicePlayback via onplay callback
            playMimoAudio(audioKey, result.audioUrl);
          })
          .catch((err) => {
            // Categorize error for dev debugging; UI only shows a friendly message
            const msg = err.message ?? "";
            // Extract server-side debugCode and requestId if embedded in message
            const debugCodeMatch = msg.match(/\[([A-Z_]+)\]/);
            const requestIdMatch = msg.match(/\(req:\s*([^)]+)\)/);
            let devTag = debugCodeMatch ? debugCodeMatch[1] : "MIMO_TTS_REQUEST_FAILED";
            const requestId = requestIdMatch ? requestIdMatch[1] : null;
            if (!text || !text.trim()) devTag = "MIMO_TTS_EMPTY_TEXT";
            else if (msg.includes("文本为空") || msg.includes("超过")) devTag = "MIMO_TTS_TEXT_INVALID";
            else if (msg.includes("audioUrl") || msg.includes("未返回音频")) devTag = "MIMO_TTS_AUDIO_MISSING";
            else if (msg.includes("fetch") || msg.includes("network") || msg.includes("Network")) devTag = "MIMO_TTS_NETWORK_ERROR";
            voiceLog("mimo:play:error", {
              audioKey, scene,
              debugCode: devTag,
              requestId,
              errorName: err.name,
              errorMessageSafe: msg.slice(0, 120),
            });
            uiState = {
              ...uiState,
              ttsAudios: {
                ...uiState.ttsAudios,
                [audioKey]: makeTtsAudio({
                  status: "error",
                  textHash: currentHash,
                  textPreview: text.slice(0, 40),
                  error: "MiMo 语音生成失败，请稍后重试。",
                  debugCode: devTag,
                  requestId,
                }),
              },
              currentVoicePlayback: {
                ...uiState.currentVoicePlayback,
                status: "error",
                error: "MiMo 语音生成失败，请稍后重试。",
                updatedAt: Date.now(),
              },
            };
            render();
          });
      },
      onPauseMimoTts: (audioKey) => {
        const audio = activeMimoAudios.get(audioKey);
        if (audio) audio.pause();
        const existing = uiState.ttsAudios[audioKey];
        if (existing && existing.status === "playing") {
          uiState = {
            ...uiState,
            ttsAudios: {
              ...uiState.ttsAudios,
              [audioKey]: { ...existing, status: "paused" },
            },
            currentVoicePlayback: {
              ...uiState.currentVoicePlayback,
              status: "paused",
              updatedAt: Date.now(),
            },
          };
          render();
        }
      },
      onResumeMimoTts: (audioKey) => {
        const existing = uiState.ttsAudios[audioKey];
        if (existing && (existing.status === "paused" || existing.status === "ready") && existing.audioUrl) {
          stopBroadcastAudio({ reason: "resume-mimo-tts" });
          stopAllMimoAudio({ exceptKey: audioKey, reason: "resume-mimo-tts" });
          uiState = {
            ...uiState,
            currentVoicePlayback: {
              ...(uiState.currentVoicePlayback?.key ? uiState.currentVoicePlayback : makeVoicePlaybackState()),
              key: audioKey,
              provider: "mimo",
              status: "playing",
              error: "",
              updatedAt: Date.now(),
            },
          };
          render();
          playMimoAudio(audioKey, existing.audioUrl);
        }
      },
      // ── Unified voice playback controls ──────────────────────────────────────
      /** Pause whatever is currently playing (MiniMax or MiMo) */
      onVoicePause: () => {
        const cvp = uiState.currentVoicePlayback;
        if (!cvp || cvp.status !== "playing") return;
        if (cvp.provider === "minimax") {
          pauseBroadcastAudio();
        } else if (cvp.provider === "mimo" && cvp.key) {
          pauseMimoAudio(cvp.key);
        }
      },
      /** Resume whatever is currently paused */
      onVoiceResume: () => {
        const cvp = uiState.currentVoicePlayback;
        if (!cvp || cvp.status !== "paused") return;
        if (cvp.provider === "minimax") {
          playBroadcastAudio();
        } else if (cvp.provider === "mimo" && cvp.key) {
          resumeMimoAudio(cvp.key);
        }
      },
      /** Stop all audio and clear the global playback state */
      onVoiceStop: () => {
        const cvp = uiState.currentVoicePlayback;
        if (cvp?.provider === "minimax") {
          stopBroadcastAudio({ reason: "voice-stop" });
        } else if (cvp?.provider === "mimo" && cvp.key) {
          if (cvp.key.startsWith("conversation:")) {
            // Conversation audio — stop the whole conversation
            stopResidentConversation();
          } else {
            stopAllMimoAudio({ reason: "voice-stop" });
          }
        } else {
          // Nothing playing, just clear
          uiState = { ...uiState, currentVoicePlayback: makeVoicePlaybackState() };
          render();
        }
        render();
      },
      onAssignTask: (residentId, taskId) => commit(assignTask(state, residentId, taskId)),
      onSelectResident: (residentId) => {
        uiState = { ...uiState, selectedResidentId: residentId };
        render();
      },
      onResetAssignments: () => commit(resetAssignments(state)),
      onToggleResidentVoice: () => {
        const current = uiState.residentVoiceInteraction?.enabled ?? false;
        const clips = buildResidentVoiceClips(state, uiState);
        const recommended = selectRecommendedResidentVoiceClip(clips, state, uiState);
        uiState = {
          ...uiState,
          residentVoiceClips: clips,
          residentVoiceInteraction: {
            enabled: !current,
            recommendedClipKey: recommended?.key ?? "",
            lastTriggeredAt: Date.now(),
            hint: !current && !recommended ? "暂无可播放居民语音" : "",
          },
        };
        render();
      },
      onToggleConversation: () => {
        const conv = uiState.residentConversation;
        if (!conv || conv.status === "idle" || conv.status === "completed" || conv.status === "error") {
          // Start conversation
          startResidentConversation();
        } else if (conv.status === "playing") {
          pauseResidentConversation();
        } else if (conv.status === "paused") {
          resumeResidentConversation();
        }
      },
      onStopConversation: () => {
        stopResidentConversation();
      },
      onRunTownDayCycle: () => {
        runTownDayCycle();
      },
      onNewTown: () => {
        stopAutoPlay();
        if (animationTimer) { clearTimeout(animationTimer); animationTimer = null; }
        if (completionTimer) { clearTimeout(completionTimer); completionTimer = null; }
        clearState();
        uiState = {
          selectedResidentId: null,
          autoPlay: false,
          llmStatus: "idle",
          llmMessage: "",
          eventDirectorStatus: "idle",
          eventDirectorMessage: "",
          broadcastStatus: "idle",
          broadcastMessage: "",
          latestBroadcast: null,
          broadcastAudio: makeAudioState(),
          activeTaskAnimations: [],
          isAnimating: false,
          animationMessage: "",
          completionFeedback: null,
          activeScenario: null,
          residentSceneBeats: [],
          dayCycle: { ...DAY_CYCLE_DEFAULT },
          ttsAudios: {},
          currentVoicePlayback: makeVoicePlaybackState(),
          choiceAftermath: null,
          dayOpeningReflection: null,
          residentVoiceInteraction: { enabled: false, recommendedClipKey: "", lastTriggeredAt: 0, hint: "" },
          residentConversation: { enabled: false, status: "idle", queue: [], currentIndex: 0, currentLineId: "", visibleText: "", typingTimerId: null, autoPlayVoice: true, error: "", runId: "", startedCount: 0, sessionState: null },
        };
        commit(createInitialState());
      },
    }, uiState);
  } catch (error) {
    renderError(error);
  }
}

function renderError(error) {
  console.error(error);
  root.innerHTML = `
    <main class="shell">
      <section class="panel app-error">
        <p class="eyebrow">Runtime Error</p>
        <h1>AI Town Life could not render.</h1>
        <p>The saved local state may be incompatible. Start a fresh town to recover.</p>
        <button class="button button--primary" type="button" data-action="recover">Start Fresh</button>
      </section>
    </main>
  `;
  root.querySelector("[data-action='recover']").addEventListener("click", () => {
    clearState();
    state = createInitialState();
    saveState(state);
    render();
  });
}

render();
