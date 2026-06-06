// AI Director — Life Scenario Layer
// Provides a town-wide narrative theme that anchors broadcasts, events, and task display.
// Pure UI/presentation layer — does not modify simulation or game values.

import { buildPromptMemoryNarrative } from "../services/minimaxClient.js";

// ── Life Scenario Directory ────────────────────────────────────────────────────

/**
 * @typedef {Object} LifeScenario
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string[]} relatedTasks
 * @property {string} tone
 */

/** @type {Record<string, LifeScenario>} */
export const TOWN_LIFE_SCENARIOS = {
  neighbor_help: {
    id: "neighbor_help",
    label: "邻里互助",
    description: "居民之间互相帮忙，玩家可以选择帮谁或如何帮。",
    relatedTasks: ["repair", "cook", "chat"],
    tone: "温暖、有人情味",
  },
  garden_day: {
    id: "garden_day",
    label: "花园日",
    description: "居民围绕花园、种植、收获、照看植物展开行动。",
    relatedTasks: ["plant", "forage", "chat"],
    tone: "治愈、清新、有生活感",
  },
  market_errand: {
    id: "market_errand",
    label: "集市采购",
    description: "居民准备食材、工具或生活用品，可能产生委托。",
    relatedTasks: ["forage", "cook", "repair"],
    tone: "热闹、日常、轻松",
  },
  repair_moment: {
    id: "repair_moment",
    label: "设施修理",
    description: "小镇某个设施出现小问题，居民一起处理。",
    relatedTasks: ["repair", "chat"],
    tone: "协作、解决问题",
  },
  quiet_reading: {
    id: "quiet_reading",
    label: "安静阅读",
    description: "居民在图书角或家中阅读、学习、整理想法。",
    relatedTasks: ["rest", "chat"],
    tone: "安静、内省",
  },
  festival_prepare: {
    id: "festival_prepare",
    label: "节日准备",
    description: "居民为小镇活动、节日或小型聚会做准备。",
    relatedTasks: ["cook", "plant", "repair", "chat"],
    tone: "期待、热闹",
  },
  weather_shift: {
    id: "weather_shift",
    label: "天气变化",
    description: "天气影响小镇行动，居民需要调整安排。",
    relatedTasks: ["forage", "repair", "rest"],
    tone: "自然、变化、应对",
  },
  resident_mood: {
    id: "resident_mood",
    label: "居民心情",
    description: "某位居民状态变化，引发关心、陪伴或小事件。",
    relatedTasks: ["chat", "rest", "cook"],
    tone: "细腻、关怀",
  },
};

// ── Rule-based Scenario Selection ──────────────────────────────────────────────

/**
 * Select the current town life scenario based on state.
 * Pure function — does not modify state.
 * Uses task distribution, resident mood, and memory as signals.
 *
 * @param {object} state
 * @returns {LifeScenario}
 */
export function selectTownLifeScenario(state) {
  const residents = state.residents ?? [];
  const tm = state.townMemory ?? [];

  // Count task occurrences
  const taskCounts = {};
  for (const r of residents) {
    const t = r.assignmentId;
    taskCounts[t] = (taskCounts[t] ?? 0) + 1;
  }

  // Mood signals
  const lowMoodCount = residents.filter((r) => r.mood < 45).length;
  const lowEnergyCount = residents.filter((r) => r.energy < 40).length;

  // Memory signals — look at last 5 town memories for keywords
  const recentMemory = tm.slice(-5).map((m) => m.text ?? "").join("");
  const memoryKeywords = {
    festival: /节日|聚会|活动|庆祝/i.test(recentMemory),
    weather: /天气|下雨|炎热|寒冷|外出/i.test(recentMemory),
    repair: /修理|修缮|坏了|松动|工坊/i.test(recentMemory),
  };

  // Rule-based selection priority
  // Memory keywords have highest priority — explicit town events override task distribution
  if (memoryKeywords.festival) return TOWN_LIFE_SCENARIOS.festival_prepare;
  if (memoryKeywords.weather) return TOWN_LIFE_SCENARIOS.weather_shift;
  if (memoryKeywords.repair) return TOWN_LIFE_SCENARIOS.repair_moment;

  // Mood signals — resident well-being takes priority over task distribution
  if (lowMoodCount >= 2) return TOWN_LIFE_SCENARIOS.resident_mood;
  if (lowMoodCount >= 1) return TOWN_LIFE_SCENARIOS.resident_mood;

  // Task distribution rules
  if (taskCounts.repair >= 2) return TOWN_LIFE_SCENARIOS.repair_moment;
  if ((taskCounts.plant >= 1 || taskCounts.forage >= 1) && taskCounts.cook >= 1) return TOWN_LIFE_SCENARIOS.market_errand;
  if (taskCounts.plant >= 1 || taskCounts.forage >= 2) return TOWN_LIFE_SCENARIOS.garden_day;
  if (taskCounts.forest >= 1) return TOWN_LIFE_SCENARIOS.market_errand;
  if (taskCounts.cook >= 2) return TOWN_LIFE_SCENARIOS.market_errand;
  if (taskCounts.chat >= 2) return TOWN_LIFE_SCENARIOS.neighbor_help;
  if (taskCounts.chat >= 1 && (taskCounts.repair >= 1 || taskCounts.cook >= 1)) return TOWN_LIFE_SCENARIOS.neighbor_help;

  // Energy signals
  if (lowEnergyCount >= 3) return TOWN_LIFE_SCENARIOS.quiet_reading;

  // Default fallback
  return TOWN_LIFE_SCENARIOS.garden_day;
}

// ── AI Director Context Builder ───────────────────────────────────────────────

/**
 * Build the AI Director context from state.
 * Used to give M3 (broadcast/event) a narrative grounding.
 * Pure function — does not modify state.
 *
 * @param {object} state
 * @param {object|null} choiceAftermath
 * @param {object|null} openingReflection
 * @returns {object}
 */
export function buildAiDirectorContext(state, choiceAftermath = null, openingReflection = null) {
  const residents = state.residents ?? [];
  const tm = state.townMemory ?? [];
  const phase = ["早上", "下午", "晚上"];

  // Active scenario (passed in or selected)
  const scenario = selectTownLifeScenario(state);

  // Resident snapshots — only the fields needed for narrative context
  const residentSnapshots = residents.map((r) => ({
    name: r.name,
    mood: r.mood,
    energy: r.energy,
    locationId: r.locationId,
    assignmentId: r.assignmentId,
    taskLabel: getTaskLabel(r.assignmentId),
    recentMemory: r.memory?.[0] ?? "",
  }));

  // Task distribution for the scenario
  const taskDistribution = {};
  for (const r of residents) {
    const t = r.assignmentId ?? "rest";
    taskDistribution[t] = (taskDistribution[t] ?? 0) + 1;
  }

  // Town memory summary (last 5)
  const townMemorySummary = tm.length > 0
    ? tm.slice(-5).map((m) => m.text ?? "").filter(Boolean).join("；")
    : "";

  // Resident memory highlights (one per resident)
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

  // Available places
  const availablePlaces = [...new Set(residents.map((r) => r.locationId).filter(Boolean))];

  // Recent choice aftermath (from current session, not yet in townMemory)
  const recentAftermath = choiceAftermath
    ? `你的选择「${choiceAftermath.choiceLabel}」：${choiceAftermath.summary}`
    : "";

  // Day opening reflection (previous day's player choice impact)
  const openingReflectionText = openingReflection?.summary || "";

  // Build narrative prompt text for LLM
  const promptText = buildDirectorPromptText(scenario, residentSnapshots, {
    townMemorySummary,
    residentMemorySummary,
    recentChoices,
    recentAftermath,
    openingReflectionText,
    availablePlaces,
    taskDistribution,
    phase: phase[state.phaseIndex] ?? "早上",
    day: state.day,
  });

  return {
    activeScenario: scenario,
    residentSnapshots,
    townMemorySummary,
    residentMemorySummary,
    recentChoices,
    recentAftermath,
    openingReflection: openingReflectionText,
    availablePlaces,
    taskDistribution,
    promptText,
  };
}

function buildDirectorPromptText(scenario, residentSnapshots, extras) {
  const {
    townMemorySummary,
    residentMemorySummary,
    recentChoices,
    recentAftermath,
    openingReflectionText,
    availablePlaces,
    taskDistribution,
    phase,
    day,
  } = extras;

  const placeNames = {
    garden: "花园", cafe: "餐厅", workshop: "工坊", plaza: "广场", forest: "森林",
  };
  const placeList = [...new Set(availablePlaces)].map((p) => placeNames[p] ?? p).join("、") || "小镇各处";

  let ctx = `今天是第${day}天${phase}。小镇当前的主题是「${scenario.label}」——${scenario.description} 整体氛围：${scenario.tone}。`;

  if (townMemorySummary) {
    ctx += ` 小镇近期动态：${townMemorySummary}。`;
  }
  if (residentMemorySummary) {
    ctx += ` 居民近况：${residentMemorySummary}。`;
  }
  if (recentChoices) {
    ctx += ` 玩家最近的行动：${recentChoices}。`;
  }
  if (recentAftermath) {
    ctx += ` 刚刚的选择影响：${recentAftermath}。`;
  }
  if (openingReflectionText) {
    ctx += ` 昨日回响：${openingReflectionText}。请自然引用，不要机械复述。`;
  }

  ctx += ` 居民当前分布在${placeList}。`;
  const tasks = Object.entries(taskDistribution)
    .map(([k, v]) => `${getTaskLabel(k)}×${v}`)
    .join("、");
  if (tasks) {
    ctx += ` 当前任务分布：${tasks}。`;
  }

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
