// ── Memory narrative for prompts ────────────────────────────────────────────────────────

/**
 * @typedef {Object} MemoryNarrative
 * @property {boolean} hasMemory
 * @property {string} narrative  - flowing prose for LLM prompts
 * @property {string[]} uiLabels  - short labels for UI display
 */

/**
 * Build a natural-language memory narrative from state.
 * Used to give M3 a prose context of past events.
 * @param {object} state
 * @returns {MemoryNarrative}
 */
export function buildPromptMemoryNarrative(state) {
  const tm = state.townMemory ?? [];
  const residents = state.residents ?? [];
  // Last 3 memories
  const recent = tm.slice(-3);
  const labels = [];
  const lines = [];

  recent.forEach((entry) => {
    if (entry && entry.text && typeof entry.text === "string") {
      const line = `第${entry.day}天${entry.phase ?? ""}：${entry.text.trim()}`;
      lines.push(line);
      if (entry.type === "player-choice" || entry.type === "choice-memory") {
        labels.push(entry.text.trim().slice(0, 28));
      }
    }
  });

  // Resident memory highlights
  residents.forEach((r) => {
    if (r.memory && r.memory.length > 0) {
      const first = r.memory[0];
      if (first) {
        labels.push(`${r.name}：${first.slice(0, 24)}`);
      }
    }
  });

  if (lines.length === 0) {
    return { hasMemory: false, narrative: "", uiLabels: [] };
  }

  const narrative = "小镇近期记忆：" + lines.join("；") + "。";
  const uiLabelsDeduped = [...new Set(labels)].slice(0, 4);
  return { hasMemory: true, narrative, uiLabels: uiLabelsDeduped };
}

export async function requestMiniMaxPlan(state) {
  const response = await fetch("./api/minimax/plan", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      state: compactState(state),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? `MiniMax request failed with ${response.status}`);
  }
  return payload;
}

export async function requestMiniMaxEvent(state) {
  const response = await fetch("./api/minimax/event", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      state: compactEventState(state),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload.error ??
        payload.technicalError ??
        `Event director request failed with ${response.status}`,
    );
  }
  return payload;
}

export async function requestMiniMaxBroadcast(state) {
  const response = await fetch("./api/minimax/broadcast", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      state: compactBroadcastState(state),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload.error ??
        payload.technicalError ??
        `Broadcast request failed with ${response.status}`,
    );
  }
  return payload;
}

function compactEventForState(event) {
  const base = {
    day: event.day,
    phase: event.phase,
    type: event.type,
    text: event.text,
  };
  if (event.type === "player-choice") {
    return {
      ...base,
      title: event.title,
      text: event.text,
      choiceLabel: event.choiceLabel,
      residentIds: event.residentIds,
      placeId: event.placeId,
    };
  }
  if (event.type === "m3-event") {
    return {
      ...base,
      title: event.title,
      text: event.text,
      residentIds: event.residentIds,
      placeId: event.placeId,
    };
  }
  return base;
}

function compactState(state) {
  return {
    day: state.day,
    phaseIndex: state.phaseIndex,
    town: state.town,
    residents: state.residents.map((resident) => ({
      id: resident.id,
      name: resident.name,
      role: resident.role,
      personality: resident.personality,
      mood: resident.mood,
      energy: resident.energy,
      locationId: resident.locationId,
      assignmentId: resident.assignmentId,
      preferredTask: resident.preferredTask,
      memory: resident.memory.slice(0, 3),
      agent: {
        needs: resident.agent?.needs ?? {
          rest: 0,
          social: 0,
          achievement: 0,
        },
        goals: resident.agent?.goals ?? {
          shortTerm: "",
          longTerm: "",
        },
        decisionReason: resident.agent?.decisionReason ?? "",
      },
    })),
    recentEvents: state.events.slice(-8).map(compactEventForState),
    townMemory: (state.townMemory ?? []).slice(-8).map((m) => ({
      day: m.day,
      phase: m.phase,
      type: m.type,
      title: m.title,
      text: m.text,
      residentIds: m.residentIds,
      placeId: m.placeId,
    })),
  };
}

function compactEventState(state) {
  const phase = ["早上", "下午", "晚上"];
  return {
    day: state.day,
    phase: phase[state.phaseIndex] ?? "早上",
    town: {
      comfort: state.town.comfort,
      supplies: state.town.supplies,
      spirit: state.town.spirit,
    },
    residents: state.residents.map((resident) => ({
      id: resident.id,
      name: resident.name,
      mood: resident.mood,
      energy: resident.energy,
      locationId: resident.locationId,
      task: resident.assignmentId,
    })),
    recentEvents: state.events.slice(-8).map(compactEventForState),
    recentReports: state.reports.slice(-3).map((report) => ({
      title: report.title,
      summary: report.summary,
    })),
    townMemory: (state.townMemory ?? []).slice(-8).map((m) => ({
      day: m.day,
      phase: m.phase,
      type: m.type,
      title: m.title,
      text: m.text,
      residentIds: m.residentIds,
      placeId: m.placeId,
    })),
    memoryNarrative: buildPromptMemoryNarrative(state),
  };
}

function compactBroadcastState(state) {
  const phase = ["早上", "下午", "晚上"];
  return {
    day: state.day,
    phaseIndex: state.phaseIndex,
    phase: phase[state.phaseIndex] ?? "早上",
    town: {
      comfort: state.town.comfort,
      supplies: state.town.supplies,
      spirit: state.town.spirit,
    },
    residents: state.residents.map((resident) => ({
      id: resident.id,
      name: resident.name,
      role: resident.role,
      mood: resident.mood,
      energy: resident.energy,
      locationId: resident.locationId,
      assignmentId: resident.assignmentId,
      memory: resident.memory.slice(0, 2),
      agent: {
        needs: resident.agent?.needs ?? { rest: 0, social: 0, achievement: 0 },
      },
    })),
    recentEvents: state.events.slice(-8).map(compactEventForState),
    recentReports: state.reports.slice(-2).map((report) => ({
      title: report.title,
      summary: report.summary,
    })),
    townMemory: (state.townMemory ?? []).slice(-8).map((m) => ({
      day: m.day,
      phase: m.phase,
      type: m.type,
      title: m.title,
      text: m.text,
      residentIds: m.residentIds,
      placeId: m.placeId,
    })),
    memoryNarrative: buildPromptMemoryNarrative(state),
  };
}
