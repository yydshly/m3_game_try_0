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
    recentEvents: state.events.slice(-8).map((event) => ({
      day: event.day,
      phase: event.phase,
      type: event.type,
      text: event.text,
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
    recentEvents: state.events.slice(-8).map((event) => ({
      day: event.day,
      type: event.type,
      text: event.text,
    })),
    recentReports: state.reports.slice(-3).map((report) => ({
      title: report.title,
      summary: report.summary,
    })),
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
    recentEvents: state.events.slice(-8).map((event) => ({
      day: event.day,
      type: event.type,
      text: event.text,
    })),
    recentReports: state.reports.slice(-2).map((report) => ({
      title: report.title,
      summary: report.summary,
    })),
  };
}
