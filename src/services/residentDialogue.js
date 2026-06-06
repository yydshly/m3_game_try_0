// Resident Dialogue Service — AI-generated short scene beats for each resident
// Pure functions, no state mutation

import { buildPromptMemoryNarrative } from "./minimaxClient.js";
import { selectTownLifeScenario } from "../domain/aiDirector.js";

// ── Dialogue Context Builder ────────────────────────────────────────────────────

/**
 * Build the resident dialogue context from state and director context.
 * Pure function — does not modify state.
 *
 * @param {object} state
 * @param {object} directorContext - output of buildAiDirectorContext(state)
 * @returns {object}
 */
export function buildResidentDialogueContext(state, directorContext = null, choiceAftermath = null) {
  const residents = state.residents ?? [];
  const tm = state.townMemory ?? [];
  const phase = ["早上", "下午", "晚上"];
  const phaseLabel = phase[state.phaseIndex] ?? "早上";

  // Use provided directorContext or build one
  const activeScenario = directorContext?.activeScenario ?? selectTownLifeScenario(state);

  // Resident inputs — all data needed for M3 to generate dialogue
  const residentInputs = residents.map((r) => {
    const needs = r.agent?.needs ?? { rest: 0, social: 0, achievement: 0 };
    return {
      residentId: r.id,
      residentName: r.name,
      mood: r.mood,
      energy: r.energy,
      locationId: r.locationId,
      assignmentId: r.assignmentId,
      taskLabel: getTaskLabel(r.assignmentId),
      recentMemory: r.memory?.[0] ?? "",
      needs: {
        rest: Math.round(needs.rest ?? 0),
        social: Math.round(needs.social ?? 0),
        achievement: Math.round(needs.achievement ?? 0),
      },
    };
  });

  // Town memory summary (last 5)
  const townMemorySummary = tm.length > 0
    ? tm.slice(-5).map((m) => m.text ?? "").filter(Boolean).join("；")
    : "";

  // Resident memory highlights (one per resident, truncated)
  const residentMemorySummary = residents
    .filter((r) => r.memory && r.memory.length > 0)
    .map((r) => `${r.name}：${r.memory[0].slice(0, 20)}`)
    .slice(0, 4)
    .join("；");

  // Recent player choices
  const recentChoices = tm
    .filter((m) => m.type === "player-choice" || m.type === "choice-memory")
    .slice(-3)
    .map((m) => m.text ?? "")
    .filter(Boolean)
    .join("；");

  // Recent choice aftermath (from current session, not yet in townMemory)
  const recentAftermath = choiceAftermath
    ? `你的选择「${choiceAftermath.choiceLabel}」：${choiceAftermath.summary}`
    : "";

  // Current broadcast summary (if any)
  const latestBc = state.events?.slice(-1).find((e) => e.type === "town-broadcast");
  const currentBroadcastSummary = latestBc ? `${latestBc.title}：${(latestBc.text ?? "").slice(0, 60)}` : "";

  // Current event summary (if any)
  const latestEvent = state.events?.slice(-1).find((e) => e.type === "m3-event");
  const currentEventSummary = latestEvent ? `${latestEvent.title}：${(latestEvent.text ?? "").slice(0, 60)}` : "";

  // Build prompt text
  const promptText = buildResidentDialoguePromptText({
    activeScenario,
    residentInputs,
    townMemorySummary,
    residentMemorySummary,
    recentChoices,
    recentAftermath,
    currentBroadcastSummary,
    currentEventSummary,
    phase: phaseLabel,
    day: state.day,
  });

  return {
    activeScenario,
    residentInputs,
    townMemorySummary,
    residentMemorySummary,
    recentChoices,
    recentAftermath,
    currentBroadcastSummary,
    currentEventSummary,
    promptText,
  };
}

function buildResidentDialoguePromptText({
  activeScenario,
  residentInputs,
  townMemorySummary,
  residentMemorySummary,
  recentChoices,
  recentAftermath,
  currentBroadcastSummary,
  currentEventSummary,
  phase,
  day,
}) {
  const scenarioDesc = activeScenario
    ? `小镇当前主题「${activeScenario.label}」——${activeScenario.description}，氛围${activeScenario.tone}。`
    : "小镇平静的一天。";

  let ctx = `今天是第${day}天${phase}。${scenarioDesc}`;

  if (townMemorySummary) {
    ctx += ` 小镇近期：${townMemorySummary}。`;
  }
  if (residentMemorySummary) {
    ctx += ` 居民近况：${residentMemorySummary}。`;
  }
  if (recentChoices) {
    ctx += ` 玩家行动：${recentChoices}。`;
  }
  if (recentAftermath) {
    ctx += ` 刚刚的选择影响：${recentAftermath}。`;
  }
  if (currentBroadcastSummary) {
    ctx += ` 当前广播：${currentBroadcastSummary}。`;
  }
  if (currentEventSummary) {
    ctx += ` 当前事件：${currentEventSummary}。`;
  }

  ctx += " 居民状态如下：";
  for (const r of residentInputs) {
    const needsDesc = `休息${r.needs.rest} 社交${r.needs.social} 成就${r.needs.achievement}`;
    ctx += ` ${r.residentName}(${r.taskLabel} 心情${r.mood} 体力${r.energy} ${needsDesc})`;
  }

  ctx += " 请为每个居民生成一句短对白（12-28字）和一个动作提示。";
  ctx += " 对白要自然、生活化，符合居民当前任务和状态。不要像任务说明。";

  return ctx;
}

const TASK_LABELS = {
  plant: "照看花园",
  cook: "准备餐点",
  repair: "工坊维护",
  chat: "邻里交流",
  forage: "森林采集",
  rest: "休息恢复",
};

function getTaskLabel(taskId) {
  return TASK_LABELS[taskId] ?? "自由活动";
}

// ── M3 Dialogue Generation ───────────────────────────────────────────────────────

/**
 * Request M3 to generate resident scene dialogue beats.
 * Falls back gracefully if the endpoint is unavailable.
 *
 * @param {object} state
 * @param {object} directorContext
 * @returns {Promise<Array>} residentSceneBeats array
 */
export async function requestMiniMaxResidentDialogues(state, directorContext = null, choiceAftermath = null) {
  const ctx = buildResidentDialogueContext(state, directorContext, choiceAftermath);

  let raw;
  try {
    const response = await fetch("./api/minimax/resident-dialogue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: compactStateForDialogue(state), directorContext: ctx }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error ?? `Resident dialogue request failed with ${response.status}`);
    }
    raw = payload;
  } catch {
    // Network/server error — use fallback
    return buildFallbackResidentSceneBeats(state, directorContext);
  }

  // Parse response
  let beats = [];
  try {
    if (raw && typeof raw === "object" && Array.isArray(raw.beats)) {
      beats = raw.beats;
    } else if (raw && typeof raw === "object" && Array.isArray(Object.values(raw)[0])) {
      // Fallback: raw is the beats array directly
      beats = Object.values(raw)[0];
    } else {
      beats = [];
    }
  } catch {
    beats = [];
  }

  // Validate and clamp each beat
  const validBeats = beats
    .map((beat) => validateBeat(beat, state))
    .filter(Boolean);

  // If no valid beats, use fallback
  if (validBeats.length === 0) {
    return buildFallbackResidentSceneBeats(state, directorContext);
  }

  return validBeats;
}

function compactStateForDialogue(state) {
  return {
    day: state.day,
    phaseIndex: state.phaseIndex,
    town: state.town,
    residents: state.residents.map((r) => ({
      id: r.id,
      name: r.name,
      mood: r.mood,
      energy: r.energy,
      locationId: r.locationId,
      assignmentId: r.assignmentId,
      memory: r.memory?.slice(0, 2) ?? [],
    })),
    townMemory: (state.townMemory ?? []).slice(-5).map((m) => ({
      day: m.day,
      phase: m.phase,
      type: m.type,
      text: m.text,
    })),
  };
}

/**
 * Validate and normalize a single beat.
 * Returns null if invalid.
 *
 * @param {object} beat
 * @param {object} state
 * @returns {object|null}
 */
export function validateBeat(beat, state) {
  if (!beat || typeof beat !== "object") return null;

  const residentId = String(beat.residentId ?? "");
  const resident = state.residents?.find((r) => r.id === residentId);
  if (!resident) return null;

  let dialogue = String(beat.dialogue ?? "").trim();
  // Truncate overly long dialogue
  if (dialogue.length > 40) dialogue = dialogue.slice(0, 40);
  if (!dialogue) return null;

  const actionHint = String(beat.actionHint ?? "").trim().slice(0, 30);
  const emotion = String(beat.emotion ?? "平静").slice(0, 10);
  const memoryReference = String(beat.memoryReference ?? "").trim().slice(0, 30);

  return {
    id: `beat-${Date.now()}-${residentId}`,
    residentId,
    residentName: resident.name,
    scenarioId: beat.scenarioId ?? "",
    taskId: resident.assignmentId ?? "",
    mood: beat.mood ?? "",
    actionHint,
    dialogue,
    memoryReference,
    emotion,
    createdAt: Date.now(),
  };
}

// ── Fallback Generation ─────────────────────────────────────────────────────────

const FALLBACK_DIALOGUES = {
  repair: {
    default: "先检查一下哪里有问题。",
    repair_moment: "这地方有点松，得赶紧修一下。",
    neighbor_help: "工具借我用用，马上还。",
  },
  plant: {
    default: "这些苗今天看起来精神不错。",
    garden_day: "新芽冒出来了，得浇水了。",
    festival_prepare: "花长得不错，可以摘一些装饰。",
  },
  cook: {
    default: "等会儿可以试着做点新花样。",
    market_errand: "食材备好了，可以开工了。",
    neighbor_help: "多做一份，大家一起吃。",
  },
  chat: {
    default: "今天想找人说说话。",
    neighbor_help: "正好碰到你，最近怎么样？",
    quiet_reading: "这本书挺有意思的，推荐你看。",
  },
  forage: {
    default: "森林里应该能找到些好东西。",
    garden_day: "去林子边看看有没有野果。",
    weather_shift: "天气有点变化，出门要小心。",
  },
  rest: {
    default: "想安静待一会儿。",
    quiet_reading: "找个舒服的角落看看书。",
    resident_mood: "今天有点累，休息一下吧。",
  },
};

const EMOTION_MAP = {
  开心: "😊",
  认真: "🛠️",
  轻松: "☺️",
  疲惫: "😴",
  温暖: "🤗",
  好奇: "🤔",
  平静: "😐",
};

/**
 * Build fallback resident scene beats when M3 fails.
 * Deterministic based on resident task and active scenario.
 *
 * @param {object} state
 * @param {object} directorContext
 * @returns {Array}
 */
export function buildFallbackResidentSceneBeats(state, directorContext = null) {
  const scenarioId = directorContext?.activeScenario?.id ?? "";
  const residents = state.residents ?? [];

  return residents.map((resident) => {
    const taskId = resident.assignmentId ?? "rest";
    const fallbackMap = FALLBACK_DIALOGUES[taskId] ?? FALLBACK_DIALOGUES.rest;
    const dialogue = fallbackMap[scenarioId] ?? fallbackMap.default;
    const emotion = detectEmotion(dialogue);

    return {
      id: `beat-fallback-${Date.now()}-${resident.id}`,
      residentId: resident.id,
      residentName: resident.name,
      scenarioId,
      taskId,
      mood: residentMoodTag(resident),
      actionHint: getFallbackActionHint(taskId),
      dialogue,
      memoryReference: "",
      emotion,
      createdAt: Date.now(),
    };
  });
}

function detectEmotion(dialogue) {
  for (const [emotion] of Object.entries(EMOTION_MAP)) {
    if (dialogue.includes(emotion)) return emotion;
  }
  return "平静";
}

function residentMoodTag(resident) {
  if (resident.mood >= 80) return "开心";
  if (resident.energy < 40) return "疲惫";
  if (resident.mood < 45) return "低落";
  return "平静";
}

function getFallbackActionHint(taskId) {
  const hints = {
    repair: "检查设施",
    plant: "照料植物",
    cook: "准备食材",
    chat: "和人交流",
    forage: "外出采集",
    rest: "休息一下",
  };
  return hints[taskId] ?? "自由活动";
}

// ── Beat Utilities ──────────────────────────────────────────────────────────────

/**
 * Get the beat for a specific resident from the beats array.
 * @param {Array} beats
 * @param {string} residentId
 * @returns {object|null}
 */
export function getBeatForResident(beats, residentId) {
  if (!Array.isArray(beats)) return null;
  return beats.find((b) => b.residentId === residentId) ?? null;
}

/**
 * Build a brief dialogue summary suitable for broadcast/event prompts.
 * @param {Array} beats
 * @returns {string}
 */
export function buildBeatsSummary(beats) {
  if (!Array.isArray(beats) || beats.length === 0) return "";
  return beats
    .map((b) => `${b.residentName}：${b.dialogue}`)
    .join("；");
}
