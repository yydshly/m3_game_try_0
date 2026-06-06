// dialogueGenerator.js — Scene-aware resident dialogue turn generator
// Pure functions, no state mutation, no API calls

/**
 * @typedef {Object} DialogueTurn
 * @property {string} from  - "speaker" or "target" (relative to the pair template)
 * @property {string} to    - "speaker" or "target"
 * @property {string} text  - the dialogue line
 * @property {string} reason - why this line was generated (for debugging/traceability)
 */

/**
 * @typedef {Object} DialoguePair
 * @property {object} speaker - resident object
 * @property {object} target - resident object
 */

/**
 * Build scene-aware resident dialogue turns.
 * Each turn knows who said it (from/to relative to the pair template).
 *
 * Priority for context:
 * 1. Current task of each resident
 * 2. Current location
 * 3. Current phase (morning/afternoon/evening)
 * 4. Active scenario
 * 5. Recent completion feedback
 * 6. Mood / energy
 * 7. Generic fallback
 *
 * @param {object} state - game state
 * @param {object} options
 * @param {object} [options.activeScenario] - active scenario object
 * @param {object} [options.completionFeedback] - completion feedback from current phase
 * @param {number} [options.rotationSeed] - seed for template rotation (default based on day)
 * @returns {DialogueTurn[]} structured dialogue turns
 */
export function buildResidentDialogueTurns(state, options = {}) {
  const {
    activeScenario = null,
    completionFeedback = null,
    rotationSeed = state.day ?? 1,
  } = options;

  const residents = state.residents ?? [];
  if (residents.length < 2) return [];

  const phaseIndex = state.phaseIndex ?? 0;
  const phaseLabels = ["早上", "下午", "晚上"];
  const phase = phaseLabels[phaseIndex] ?? "早上";

  // Build pairs — prefer same-location pairs
  const pairs = buildDialoguePairs(residents);

  // Select phrase library based on context
  const libraryKey = selectPhraseLibrary(activeScenario, completionFeedback, phaseIndex);
  const snippets = DIALOGUE_SNIPPETS[libraryKey] ?? DIALOGUE_SNIPPETS.fallback;

  // Rotate template based on seed so we don't repeat the same conversation
  const rotated = rotateArray(snippets, rotationSeed % snippets.length);

  // Map template turns to actual residents
  const turns = [];
  const maxLines = Math.min(rotated.length, 6);

  for (let i = 0; i < maxLines; i++) {
    const pairIdx = i % pairs.length;
    const pair = pairs[pairIdx];
    const turn = rotated[i];

    const fromResident = turn.from === "target" ? pair.target : pair.speaker;
    const toResident = turn.to === "target" ? pair.target : pair.speaker;

    // Substitute placeholders in the text
    const text = substituteText(turn.text, {
      speakerName: fromResident.name,
      targetName: toResident.name,
      speakerTask: getTaskLabel(fromResident.assignmentId),
      targetTask: getTaskLabel(toResident.assignmentId),
      speakerLocation: getLocationLabel(fromResident.locationId),
      targetLocation: getLocationLabel(toResident.locationId),
      phase,
    });

    turns.push({
      from: turn.from,
      to: turn.to,
      text,
      reason: turn.reason ?? libraryKey,
      speakerId: fromResident.id,
      targetId: toResident.id,
      speakerName: fromResident.name,
      targetName: toResident.name,
    });
  }

  return turns;
}

/**
 * Build resident pairs for dialogue.
 * Prioritizes same-location pairs, then falls back to sequential pairs.
 * @param {object[]} residents
 * @returns {DialoguePair[]}
 */
function buildDialoguePairs(residents) {
  const byLocation = {};
  for (const r of residents) {
    const loc = r.locationId ?? "";
    if (!byLocation[loc]) byLocation[loc] = [];
    byLocation[loc].push(r);
  }

  // Collect same-location pairs
  /** @type {DialoguePair[]} */
  const pairs = [];
  for (const locResidents of Object.values(byLocation)) {
    for (let i = 0; i < locResidents.length; i++) {
      for (let j = i + 1; j < locResidents.length; j++) {
        pairs.push({ speaker: locResidents[i], target: locResidents[j] });
      }
    }
  }

  // If fewer than 2 pairs, supplement with sequential cross-location pairs
  if (pairs.length < 2) {
    for (let i = 0; i < residents.length - 1; i++) {
      const speaker = residents[i];
      const target = residents[i + 1];
      const already = pairs.some(
        (p) =>
          (p.speaker.id === speaker.id && p.target.id === target.id) ||
          (p.speaker.id === target.id && p.target.id === speaker.id)
      );
      if (!already) {
        pairs.push({ speaker, target });
        if (pairs.length >= 3) break;
      }
    }
  }

  return pairs.slice(0, 4);
}

/**
 * Select the best phrase library based on context.
 * @param {object|null} activeScenario
 * @param {object|null} completionFeedback
 * @param {number} phaseIndex
 * @returns {string} library key
 */
function selectPhraseLibrary(activeScenario, completionFeedback, phaseIndex) {
  const scenarioId = activeScenario?.id ?? "";

  // Scenario-specific first
  if (scenarioId && SCENARIO_LIBRARY_MAP[scenarioId]) {
    return SCENARIO_LIBRARY_MAP[scenarioId];
  }

  // Phase-based
  if (phaseIndex === 0) return "morning";
  if (phaseIndex === 1) return "afternoon";
  if (phaseIndex === 2) return "evening";

  // Completion feedback indicates recent activity
  if (completionFeedback?.residentResults?.length > 0) {
    return "after_completion";
  }

  return "fallback";
}

/**
 * Substitute placeholders in a template text.
 * Placeholders: {speakerName}, {targetName}, {speakerTask}, {targetTask}, {phase}
 * @param {string} template
 * @param {object} vars
 * @returns {string}
 */
function substituteText(template, vars) {
  return template
    .replace(/\{speakerName\}/g, vars.speakerName ?? "居民")
    .replace(/\{targetName\}/g, vars.targetName ?? "邻居")
    .replace(/\{speakerTask\}/g, vars.speakerTask ?? "活动")
    .replace(/\{targetTask\}/g, vars.targetTask ?? "活动")
    .replace(/\{speakerLocation\}/g, vars.speakerLocation ?? "广场")
    .replace(/\{targetLocation\}/g, vars.targetLocation ?? "广场")
    .replace(/\{phase\}/g, vars.phase ?? "白天");
}

// ── Phrase Library ───────────────────────────────────────────────────────────

/**
 * Scene-based dialogue snippet library.
 * Each entry is an array of structured turns (from/to/text/reason).
 * Templates use {placeholder} syntax for runtime substitution.
 *
 * Categories:
 * - morning / afternoon / evening: time-of-day context
 * - farming / cooking / repairing / chatting / foraging / resting: task context
 * - after_completion: after task completion feedback
 * - fallback: generic
 *
 * @type {Record<string, Array<{from: string, to: string, text: string, reason?: string}>>}
 */
const DIALOGUE_SNIPPETS = {
  // ── Morning ────────────────────────────────────────────────────────────────
  morning: [
    { from: "speaker", to: "target", text: "早上的光刚好，我先去做{phase}的事情。", reason: "morning-task" },
    { from: "target", to: "speaker", text: "{speakerName}，今天有什么计划吗？", reason: "morning-checkin" },
    { from: "speaker", to: "target", text: "想去{speakerLocation}那边看看。", reason: "morning-location" },
    { from: "target", to: "speaker", text: "好，等会儿广场上见。", reason: "morning-meetup" },
  ],

  // ── Afternoon ───────────────────────────────────────────────────────────────
  afternoon: [
    { from: "speaker", to: "target", text: "下午的阳光真舒服，适合在外边待着。", reason: "afternoon-mood" },
    { from: "target", to: "speaker", text: "我在{targetLocation}这边做{targetTask}，你也来吧。", reason: "afternoon-invite" },
    { from: "speaker", to: "target", text: "那我去看看，不会的。", reason: "afternoon-accept" },
    { from: "target", to: "speaker", text: "好，一会儿聊。", reason: "afternoon-wrapup" },
  ],

  // ── Evening ────────────────────────────────────────────────────────────────
  evening: [
    { from: "speaker", to: "target", text: "傍晚了，今天做完的事情还挺有成就感的。", reason: "evening-reflection" },
    { from: "target", to: "speaker", text: "是啊，感觉小镇一天比一天热闹。", reason: "evening-town" },
    { from: "speaker", to: "target", text: "明天还想去{targetLocation}看看。", reason: "evening-plan" },
    { from: "target", to: "speaker", text: "好的，明天见。", reason: "evening-goodbye" },
  ],

  // ── Task-based ─────────────────────────────────────────────────────────────
  farming: [
    { from: "speaker", to: "target", text: "花园的土有点干，我先浇浇水。", reason: "farming-task" },
    { from: "target", to: "speaker", text: "这些苗长得真精神，你的功劳。", reason: "farming-praise" },
    { from: "speaker", to: "target", text: "等会儿想去{targetLocation}那边看看你。", reason: "farming-visit" },
    { from: "target", to: "speaker", text: "好，我在这边等你。", reason: "farming-meetup" },
  ],

  cooking: [
    { from: "speaker", to: "target", text: "我在准备今天的餐点，食材都齐了。", reason: "cooking-task" },
    { from: "target", to: "speaker", text: "闻起来真香，辛苦了。", reason: "cooking-praise" },
    { from: "speaker", to: "target", text: "多做了一份，等会儿一起吃。", reason: "cooking-share" },
    { from: "target", to: "speaker", text: "太好了，正好饿了。", reason: "cooking-accept" },
  ],

  repairing: [
    { from: "speaker", to: "target", text: "工坊里有几个地方有点松，我来看看。", reason: "repairing-task" },
    { from: "target", to: "speaker", text: "需要帮忙吗？", reason: "repairing-help" },
    { from: "speaker", to: "target", text: "不用，马上好，你先忙你的。", reason: "repairing-solo" },
    { from: "target", to: "speaker", text: "好，有需要叫我。", reason: "repairing-offer" },
  ],

  chatting: [
    { from: "speaker", to: "target", text: "广场上人挺多的，聊聊吧。", reason: "chatting-task" },
    { from: "target", to: "speaker", text: "最近有什么新鲜事吗？", reason: "chatting-ask" },
    { from: "speaker", to: "target", text: "我刚在{speakerLocation}那边做了{speakerTask}，还挺好的。", reason: "chatting-share" },
    { from: "target", to: "speaker", text: "听起来不错，改天我也去试试。", reason: "chatting-interest" },
  ],

  foraging: [
    { from: "speaker", to: "target", text: "森林里应该能找到些好东西。", reason: "foraging-task" },
    { from: "target", to: "speaker", text: "小心点，别走太远。", reason: "foraging-warning" },
    { from: "speaker", to: "target", text: "放心，很快就回来。", reason: "foraging-assure" },
    { from: "target", to: "speaker", text: "等你回来分享一下。", reason: "foraging-share" },
  ],

  resting: [
    { from: "speaker", to: "target", text: "今天有点累，休息一下吧。", reason: "resting-task" },
    { from: "target", to: "speaker", text: "找个安静的地方待会儿会更好。", reason: "resting-advice" },
    { from: "speaker", to: "target", text: "广场那边挺安静的，我去坐坐。", reason: "resting-location" },
    { from: "target", to: "speaker", text: "好的，休息好了叫我。", reason: "resting-wrapup" },
  ],

  // ── After completion ─────────────────────────────────────────────────────────
  after_completion: [
    { from: "speaker", to: "target", text: "我刚把{speakerTask}的事情忙完了。", reason: "completion-share" },
    { from: "target", to: "speaker", text: "辛苦，快歇一下吧。", reason: "completion-concern" },
    { from: "speaker", to: "target", text: "等会儿想去广场走走，你要一起吗？", reason: "completion-invite" },
    { from: "target", to: "speaker", text: "好主意，走吧。", reason: "completion-accept" },
  ],

  // ── Fallback ────────────────────────────────────────────────────────────────
  fallback: [
    { from: "speaker", to: "target", text: "今天的小镇还挺热闹的。", reason: "fallback-mood" },
    { from: "target", to: "speaker", text: "是啊，大家都忙着自己的事情。", reason: "fallback-observe" },
    { from: "speaker", to: "target", text: "我在{speakerLocation}做{speakerTask}，感觉还挺充实的。", reason: "fallback-task" },
    { from: "target", to: "speaker", text: "那挺好的，加油。", reason: "fallback-encourage" },
  ],
};

/**
 * Map scenario ID → phrase library key.
 * Covers all active scenario IDs used by selectTownLifeScenario.
 * @type {Record<string, string>}
 */
const SCENARIO_LIBRARY_MAP = {
  garden_day: "farming",
  repair_moment: "repairing",
  market_errand: "cooking",
  quiet_reading: "resting",
  neighbor_help: "chatting",
  festival_prepare: "farming",
  weather_shift: "foraging",
  resident_mood: "fallback",
};

// ── Utilities ─────────────────────────────────────────────────────────────────

const TASK_LABELS = {
  plant: "照看花园",
  cook: "准备餐点",
  repair: "工坊维护",
  chat: "邻里交流",
  forage: "森林采集",
  rest: "休息恢复",
};

const LOCATION_LABELS = {
  garden: "花园",
  cafe: "咖啡馆",
  workshop: "工坊",
  plaza: "广场",
  forest: "森林",
};

/**
 * @param {string|null} taskId
 * @returns {string}
 */
function getTaskLabel(taskId) {
  return TASK_LABELS[taskId ?? ""] ?? "自由活动";
}

/**
 * @param {string|null} locationId
 * @returns {string}
 */
function getLocationLabel(locationId) {
  return LOCATION_LABELS[locationId ?? ""] ?? "广场";
}

/**
 * Rotate an array by n positions (positive = left shift).
 * @param {T[]} arr
 * @param {number} n
 * @returns {T[]}
 * @template T
 */
function rotateArray(arr, n) {
  if (!arr || arr.length === 0) return [];
  const len = arr.length;
  n = ((n % len) + len) % len;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

/**
 * Build a conversation record from dialogue turns (for right panel display).
 * Returns a flat array of {speakerName, text} suitable for the right panel.
 * @param {DialogueTurn[]} turns
 * @returns {Array<{speakerName: string, text: string, turnIndex: number}>}
 */
export function buildConversationRecord(turns) {
  if (!Array.isArray(turns) || turns.length === 0) return [];
  return turns.map((turn, i) => ({
    speakerName: turn.speakerName ?? "居民",
    text: turn.text,
    turnIndex: i,
  }));
}
