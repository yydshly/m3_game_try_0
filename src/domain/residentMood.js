// Resident mood view — pure UI helper, no DOM, no API calls
// Produces display-only mood view objects from resident state

import { getLocation } from "./selectors.js";
import { tasks } from "../data/seed.js";

export const MOOD_VIEW_MAP = {
  tired: {
    icon: "😴",
    label: "有点累",
    cssClass: "resident-mood-tired",
  },
  "low-mood": {
    icon: "😔",
    label: "心情低落",
    cssClass: "resident-mood-low",
  },
  happy: {
    icon: "😊",
    label: "心情不错",
    cssClass: "resident-mood-happy",
  },
  steady: {
    icon: "🙂",
    label: "状态平稳",
    cssClass: "resident-mood-steady",
  },
  neutral: {
    icon: "😐",
    label: "状态稳定",
    cssClass: "resident-mood-neutral",
  },
};

const TASK_STATUS_MAP = {
  plant:   { icon: "🌱", label: "照看花园",   cssClass: "status-plant"   },
  cook:    { icon: "🍳", label: "准备餐点",   cssClass: "status-cook"    },
  repair:  { icon: "🔧", label: "维修设施",   cssClass: "status-repair"  },
  chat:    { icon: "💬", label: "和居民聊天", cssClass: "status-chat"    },
  forage:  { icon: "🌿", label: "森林采集",   cssClass: "status-forage"  },
  rest:    { icon: "😌", label: "正在休息",   cssClass: "status-rest"    },
};

const ENERGY_LABEL_MAP = [
  { max: 20, label: "体力不足"  },
  { max: 40, label: "体力偏低"  },
  { max: 60, label: "精力一般"  },
  { max: 80, label: "精力充足"  },
  { max: 101, label: "精力充沛" },
];

function getMoodView(mood, energy) {
  if (energy < 30) return MOOD_VIEW_MAP.tired;
  if (mood < 45)   return MOOD_VIEW_MAP["low-mood"];
  if (mood >= 82)  return MOOD_VIEW_MAP.happy;
  return MOOD_VIEW_MAP.steady;
}

function getEnergyLabel(energy) {
  for (const { max, label } of ENERGY_LABEL_MAP) {
    if (energy < max) return label;
  }
  return "精力充沛";
}

/**
 * Build a resident mood view for UI display.
 * Pure function — does not mutate inputs, does not call APIs.
 *
 * @param {object} resident - Resident object
 * @param {object} options
 * @param {object} options.completionById - Map<residentId, completionResult> from completionFeedback
 * @param {object[]} options.activeAnimations - activeTaskAnimations array
 * @returns {object} Mood view: { residentId, moodIcon, moodLabel, moodCssClass, statusText, statusCssClass, energyLabel }
 */
export function buildResidentMoodView(resident, options = {}) {
  const { completionById = new Map(), activeAnimations = [] } = options;

  if (!resident || typeof resident.id !== "string") {
    return {
      residentId: null,
      moodIcon: MOOD_VIEW_MAP.neutral.icon,
      moodLabel: MOOD_VIEW_MAP.neutral.label,
      moodCssClass: MOOD_VIEW_MAP.neutral.cssClass,
      statusText: "在小镇里闲逛",
      statusCssClass: "",
      energyLabel: "精力一般",
    };
  }

  const mood    = typeof resident.mood    === "number" ? resident.mood    : 50;
  const energy  = typeof resident.energy  === "number" ? resident.energy  : 50;
  const moodView = getMoodView(mood, energy);
  const energyLabel = getEnergyLabel(energy);

  // Priority: completion > active animation > assignment > wander
  const residentId = resident.id;
  const completionResult = completionById.get(residentId);

  if (completionResult) {
    return {
      residentId,
      moodIcon: moodView.icon,
      moodLabel: moodView.label,
      moodCssClass: moodView.cssClass,
      statusText: `刚完成：${completionResult.label}`,
      statusCssClass: "status-just-completed",
      energyLabel,
    };
  }

  const activeAnim = activeAnimations.find((a) => a.residentId === residentId);
  if (activeAnim) {
    return {
      residentId,
      moodIcon: moodView.icon,
      moodLabel: moodView.label,
      moodCssClass: moodView.cssClass,
      statusText: "正在行动中",
      statusCssClass: "status-active",
      energyLabel,
    };
  }

  const assignmentId = resident.assignmentId;
  if (assignmentId && TASK_STATUS_MAP[assignmentId]) {
    const taskInfo = TASK_STATUS_MAP[assignmentId];
    return {
      residentId,
      moodIcon: moodView.icon,
      moodLabel: moodView.label,
      moodCssClass: moodView.cssClass,
      statusText: taskInfo.label,
      statusCssClass: taskInfo.cssClass,
      energyLabel,
    };
  }

  return {
    residentId,
    moodIcon: moodView.icon,
    moodLabel: moodView.label,
    moodCssClass: moodView.cssClass,
    statusText: "在小镇里闲逛",
    statusCssClass: "",
    energyLabel,
  };
}

// ── Task Completion Feedback ───────────────────────────────────────────────────

const TASK_RESULT_TEXTS = {
  plant:   "整理好了花圃，花园看起来清爽了一些。",
  cook:    "准备好了一顿餐点，小镇飘着香味。",
  repair:  "修好了工坊的设施，一切都运转正常。",
  chat:    "和邻居聊了聊天，关系更近了一步。",
  forage:  "从森林带回了一些东西，满载而归。",
  rest:    "休息了一会儿，精神恢复了不少。",
};

const MOOD_DELTA_MAP = {
  plant:   +1,
  cook:    +1,
  repair:   0,
  chat:    +2,
  forage:  +1,
  rest:    +2,
};

const ENERGY_DELTA_MAP = {
  plant:   -1,
  cook:    -1,
  repair:  -1,
  chat:    -1,
  forage:  -2,
  rest:    +5,
};

const TONE_MAP = {
  plant:   "warm",
  cook:    "cozy",
  repair:  "steady",
  chat:    "warm",
  forage:  "fresh",
  rest:    "calm",
};

/**
 * Build a rich task completion feedback view model.
 * Pure function — does not mutate inputs, does not call APIs.
 *
 * @param {object} state - game state (has residents, locations, tasks)
 * @param {object|null} completionFeedback - uiState.completionFeedback
 * @returns {object} Feedback: { visible, completions: [{residentId, residentName, taskLabel, locationLabel, resultText, moodDelta, energyDelta, icon, tone}] }
 */
export function buildTaskCompletionFeedback(state, completionFeedback) {
  if (!completionFeedback || !Array.isArray(completionFeedback.residentResults) || completionFeedback.residentResults.length === 0) {
    return { visible: false, completions: [] };
  }

  const residentById = new Map((state?.residents ?? []).map((r) => [r.id, r]));

  const completions = completionFeedback.residentResults
    .slice(0, 5) // cap at 5
    .map((result) => {
      const resident = residentById.get(result.residentId);
      const residentName = resident?.name ?? "居民";
      const taskId = resident?.assignmentId ?? "";
      const task = tasks.find((t) => t.id === taskId);
      const taskLabel = task?.label ?? result.label ?? "完成了任务";
      const locationId = resident?.locationId ?? "";
      const locationLabel = getLocation(locationId)?.label ?? "小镇";
      const resultText = TASK_RESULT_TEXTS[taskId] ?? `${residentName}完成了任务。`;
      const moodDelta = MOOD_DELTA_MAP[taskId] ?? 0;
      const energyDelta = ENERGY_DELTA_MAP[taskId] ?? 0;
      const tone = TONE_MAP[taskId] ?? "steady";

      return {
        residentId: result.residentId,
        residentName,
        taskLabel,
        locationLabel,
        resultText,
        moodDelta,
        energyDelta,
        icon: result.icon ?? "✓",
        tone,
      };
    });

  return { visible: true, completions };
}

// ── Resident Stage Acting View ─────────────────────────────────────────────────

const ACTION_TYPE_MAP = {
  // Maps taskId/keyword → actionType
  // keyword order matters (specific → general)
};

function classifyActionType(taskId, assignmentLabel) {
  // keyword match on both taskId and label
  const text = `${taskId ?? ""} ${assignmentLabel ?? ""}`.toLowerCase();
  if (/书|阅读|学习|安静|读/.test(text)) return "reading";
  if (/花|种|农|圃|锄|栽培|园艺/.test(text)) return "farming";
  if (/聊|问候|访|对话|会话|talk/.test(text)) return "chatting";
  if (/休息|睡|坐|放松|午休/.test(text)) return "resting";
  if (/修|理|清|扫|整理|维护|工作|工坊/.test(text)) return "working";
  if (/走|跑|行|动|移动|travel/.test(text)) return "walking";
  return "working"; // default
}

const ACTION_BADGE_LABELS = {
  reading:  "阅读中",
  farming:  "耕作中",
  chatting: "交流中",
  resting:  "休息中",
  working:  "工作中",
  walking:  "移动中",
};

/**
 * Build a resident stage acting view for the town stage.
 * Pure function — does not mutate inputs, does not call APIs.
 *
 * @param {object} resident
 * @param {object} options
 * @param {object} options.activeAnim - active animation for this resident (from uiState.activeTaskAnimations)
 * @param {object} options.completionResult - completion result for this resident (from completionFeedback)
 * @param {object} options.conversationActive - boolean, is conversation active
 * @param {object} options.conversationLine - current conversation line (if speaking)
 * @returns {object} Acting view: { actionType, actionLabel, cssClass, badgeText, prop, propClass }
 */
export function buildResidentStageActingView(resident, options = {}) {
  const {
    activeAnim = null,
    completionResult = null,
    conversationActive = false,
    conversationLine = null,
  } = options;

  if (!resident || typeof resident.id !== "string") {
    return { actionType: "idle", actionLabel: "闲逛", cssClass: "stage-resident--idle", badgeText: "闲逛", prop: null, propClass: null };
  }

  const taskId = resident.assignmentId ?? "";
  const assignmentLabel = "";
  const isMoving = activeAnim?.traveling ?? false;
  const isSpeaking = conversationActive && conversationLine?.speakerId === resident.id;

  let actionType;
  let badgeText;

  if (isSpeaking) {
    actionType = "chatting";
    badgeText = "说话中";
  } else if (isMoving) {
    actionType = "walking";
    badgeText = ACTION_BADGE_LABELS.walking;
  } else if (completionResult) {
    actionType = "working";
    badgeText = completionResult.label ?? "已完成";
  } else if (activeAnim?.action) {
    actionType = classifyActionType(taskId, assignmentLabel);
    badgeText = ACTION_BADGE_LABELS[actionType] ?? "工作中";
  } else {
    actionType = "working";
    badgeText = ACTION_BADGE_LABELS.working;
  }

  const cssClass = `stage-resident--${actionType}`;

  // Prop icons per action type
  const propMap = {
    reading: "📖",
    farming: "🌿",
    chatting: "💬",
    resting: "😌",
    working: "🔧",
    walking: "🚶",
    idle: "🏠",
  };
  const prop = propMap[actionType] ?? null;
  const propClass = prop ? `stage-resident__prop--${actionType}` : null;

  return { actionType, actionLabel: badgeText, cssClass, badgeText, prop, propClass };
}
