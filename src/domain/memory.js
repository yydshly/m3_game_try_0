// Memory domain — handles townMemory and resident memory for player choices
// No DOM dependencies, no game stat modifications

const MAX_TOWN_MEMORY = 30;
const MAX_RESIDENT_MEMORY = 8;

export const MEMORY_LABELS = {
  garden: "花园",
  cafe: "咖啡馆",
  workshop: "工坊",
  plaza: "广场",
  forest: "森林",
};

/**
 * Ensure state.townMemory exists and is an array.
 * Safe to call on both fresh and migrated old state.
 */
export function ensureTownMemory(state) {
  return {
    ...state,
    townMemory: Array.isArray(state.townMemory) ? state.townMemory : [],
  };
}

/**
 * Build a single townMemory entry from a player choice.
 */
export function createChoiceMemoryEntry({ state, sourceEvent, choice, currentPhase }) {
  const placeName = MEMORY_LABELS[sourceEvent.placeId] ?? "广场";
  return {
    id: `town-memory-${sourceEvent.id}-${choice.id}`,
    day: state.day,
    phase: currentPhase.label,
    type: "player-choice",
    title: sourceEvent.title || "你的选择",
    text: `玩家选择了「${choice.label}」。${choice.resultText}`,
    residentIds: sourceEvent.residentIds ?? [],
    placeId: sourceEvent.placeId ?? "plaza",
    sourceEventId: sourceEvent.id,
    choiceId: choice.id,
    createdAt: Date.now(),
  };
}

/**
 * Apply choice memory to state:
 * - Updates source event with chosenChoiceId + choiceResultText
 * - Appends player-choice event
 * - Appends to townMemory (deduped)
 * - Appends memory text to involved residents
 * Returns a new state object.
 */
export function applyChoiceMemory(state, sourceEvent, choice, currentPhase) {
  // Idempotence: check actual state, not the passed-in sourceEvent object
  const currentEvent = (state.events ?? []).find((e) => e.id === sourceEvent.id);
  if (!currentEvent || currentEvent.chosenChoiceId) return state;

  // 1. Update source event
  const updatedEvents = (state.events ?? []).map((e) => {
    if (e.id !== sourceEvent.id) return e;
    return {
      ...e,
      chosenChoiceId: choice.id,
      choiceResultText: choice.resultText,
    };
  });

  // 2. Create player-choice event
  const playerChoiceEvent = {
    id: `choice-${sourceEvent.id}-${choice.id}`,
    type: "player-choice",
    day: state.day,
    phase: currentPhase.label,
    sourceEventId: sourceEvent.id,
    choiceId: choice.id,
    title: "你的选择",
    text: choice.resultText,
    choiceLabel: choice.label,
    residentIds: sourceEvent.residentIds ?? [],
    placeId: sourceEvent.placeId ?? "plaza",
  };

  // 3. Build townMemory entry
  const memoryEntry = createChoiceMemoryEntry({ state, sourceEvent, choice, currentPhase });

  // 4. Add to townMemory (dedup by id)
  const existingTownMemoryIds = new Set((state.townMemory ?? []).map((m) => m.id));
  let townMemory = existingTownMemoryIds.has(memoryEntry.id)
    ? state.townMemory
    : [...(state.townMemory ?? []), memoryEntry];

  // Trim to MAX_TOWN_MEMORY
  if (townMemory.length > MAX_TOWN_MEMORY) {
    townMemory = townMemory.slice(-MAX_TOWN_MEMORY);
  }

  // 5. Build resident memory text
  const placeName = MEMORY_LABELS[sourceEvent.placeId] ?? "广场";
  const eventTitle = sourceEvent.title || "小镇事件";
  const residentMemoryText = `第 ${state.day} 天${currentPhase.label}，玩家在「${eventTitle}」中选择了「${choice.label}」。${choice.resultText}`;

  // 6. Update residents with new memory
  const residentIds = sourceEvent.residentIds ?? [];
  const updatedResidents = (state.residents ?? []).map((resident) => {
    if (!residentIds.includes(resident.id)) return resident;
    const existing = resident.memory ?? [];
    // Deduplicate — don't write same text twice
    if (existing[0] === residentMemoryText) return resident;
    const newMemory = [residentMemoryText, ...existing];
    const trimmed = newMemory.slice(0, MAX_RESIDENT_MEMORY);
    return { ...resident, memory: trimmed };
  });

  return {
    ...state,
    events: [...updatedEvents, playerChoiceEvent],
    townMemory,
    residents: updatedResidents,
  };
}

/**
 * Build a human-readable summary of recent town memories for injection into LLM prompts.
 * Pure function — does not mutate state, does not call any API.
 *
 * @param {Array} townMemory - Array of townMemory entries (from state.townMemory)
 * @param {object} options
 * @param {number} options.maxEntries - Maximum number of entries to include (default 3)
 * @param {number} options.maxLength - Maximum total summary length in chars (default 300)
 * @param {number} options.maxEntryLength - Maximum single entry length (default 80)
 * @returns {string} Natural-language summary, or empty string if no valid memories
 */
export function buildTownMemorySummary(townMemory, options = {}) {
  const { maxEntries = 3, maxLength = 300, maxEntryLength = 80 } = options;

  if (!Array.isArray(townMemory) || townMemory.length === 0) {
    return "";
  }

  // Take the most recent entries (last maxEntries items)
  const recent = townMemory.slice(-maxEntries);

  const lines = recent
    .filter((entry) => entry && typeof entry.text === "string" && entry.text.trim().length > 0)
    .map((entry) => {
      const text = entry.text.trim();
      // Truncate long entries
      const truncated = text.length > maxEntryLength ? text.slice(0, maxEntryLength - 1) + "…" : text;
      return `· ${truncated}`;
    });

  if (lines.length === 0) {
    return "";
  }

  const summary = `小镇近期记忆：\n${lines.join("\n")}`;
  if (summary.length > maxLength) {
    return summary.slice(0, maxLength - 1) + "…";
  }
  return summary;
}

/**
 * Trim memories to max limits (defensive, called after any state merge).
 */
export function trimMemories(state) {
  let townMemory = state.townMemory ?? [];
  if (townMemory.length > MAX_TOWN_MEMORY) {
    townMemory = townMemory.slice(-MAX_TOWN_MEMORY);
  }

  const residents = (state.residents ?? []).map((resident) => {
    const memory = resident.memory ?? [];
    if (memory.length <= MAX_RESIDENT_MEMORY) return resident;
    return { ...resident, memory: memory.slice(0, MAX_RESIDENT_MEMORY) };
  });

  return { ...state, townMemory, residents };
}
