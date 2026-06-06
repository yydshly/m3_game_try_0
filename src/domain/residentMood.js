// Resident mood view — pure UI helper, no DOM, no API calls
// Produces display-only mood view objects from resident state

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
