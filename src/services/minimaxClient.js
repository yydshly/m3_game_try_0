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
