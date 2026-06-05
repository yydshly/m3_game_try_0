import { phases, tasks } from "../data/seed.js";
import { createDailyReport, describeMemory, narrateAction, narratePair } from "../services/narrator.js";
import { getCurrentPhase, getLocation, getTask } from "./selectors.js";
import { ensureResidentAgent, updateAgentNeeds, applySocialInteraction, getDefaultTaskReason } from "./agent.js";

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function clone(state) {
  return structuredClone(state);
}

function chooseAgentTask(resident, state) {
  const assigned = getTask(resident.assignmentId);
  if (resident.energy < 26) {
    return { task: getTask("rest"), reason: "energy low, needs rest" };
  }
  if (state.town.supplies <= 3) {
    return { task: getTask("forage"), reason: "supplies low, help town forage" };
  }
  if (assigned) {
    const reason = getDefaultTaskReason(resident, assigned, state);
    return { task: assigned, reason };
  }
  const preferred = getTask(resident.preferredTask) ?? tasks[0];
  return { task: preferred, reason: "follows preferred task" };
}

function applyTownDelta(town, task) {
  return {
    comfort: clamp(town.comfort + task.resourceDelta.comfort, 0, 100),
    supplies: Math.max(0, town.supplies + task.resourceDelta.supplies),
    spirit: clamp(town.spirit + Math.ceil(task.moodDelta / 2), 0, 100),
  };
}

function applyRelationship(state, aId, bId, delta) {
  state.relationships[aId][bId] = clamp(state.relationships[aId][bId] + delta);
  state.relationships[bId][aId] = clamp(state.relationships[bId][aId] + delta);
}

function processSocialEvents(next, phaseLabel) {
  const events = [];
  const groups = new Map();

  for (const resident of next.residents) {
    const group = groups.get(resident.locationId) ?? [];
    group.push(resident);
    groups.set(resident.locationId, group);
  }

  for (const [locationId, group] of groups.entries()) {
    if (group.length < 2) continue;
    const location = getLocation(locationId);
    for (let index = 0; index < group.length - 1; index += 1) {
      const a = group[index];
      const b = group[index + 1];
      const delta = a.mood > 35 && b.mood > 35 ? 3 : -2;
      applyRelationship(next, a.id, b.id, delta);
      applySocialInteraction(a, 6);
      applySocialInteraction(b, 6);
      events.push({
        id: crypto.randomUUID(),
        day: next.day,
        phase: phaseLabel,
        type: "social",
        text: narratePair(a, b, location, delta),
      });
    }
  }

  return events;
}

export function assignTask(state, residentId, taskId) {
  const next = clone(state);
  next.residents = next.residents.map((resident) =>
    resident.id === residentId ? { ...resident, assignmentId: taskId } : resident,
  );
  return next;
}

export function resetAssignments(state) {
  const next = clone(state);
  next.residents = next.residents.map((resident) => ({
    ...resident,
    assignmentId: resident.preferredTask,
  }));
  return next;
}

export function applyAgentPlan(state, plan) {
  const next = clone(state);
  const allowedTaskIds = new Set(tasks.map((task) => task.id));
  const assignments = Array.isArray(plan?.assignments) ? plan.assignments : [];
  const reasons = new Map();

  next.residents = next.residents.map((resident) => {
    const safeResident = ensureResidentAgent(resident);
    const assignment = assignments.find((item) => item.residentId === resident.id);
    if (!assignment || !allowedTaskIds.has(assignment.taskId)) return safeResident;
    reasons.set(resident.id, assignment.reason);
    return {
      ...safeResident,
      assignmentId: assignment.taskId,
      agent: {
        ...safeResident.agent,
        decisionReason: assignment.reason ? String(assignment.reason) : safeResident.agent.decisionReason,
      },
      memory: assignment.reason ? [`MiniMax plan: ${assignment.reason}`, ...safeResident.memory].slice(0, 5) : safeResident.memory,
    };
  });

  if (plan?.townNote) {
    next.events = [
      ...next.events,
      {
        id: crypto.randomUUID(),
        day: next.day,
        phase: "Plan",
        type: "system",
        text: `MiniMax: ${plan.townNote}`,
      },
    ].slice(-80);
  }

  return next;
}

export function advancePhase(state) {
  const next = clone(state);
  const phase = getCurrentPhase(next);
  const phaseLabel = phase.label;
  const events = [];

  next.residents = next.residents.map((resident) => {
    const safeResident = ensureResidentAgent(resident);
    const { task, reason } = chooseAgentTask(safeResident, next);
    const location = getLocation(task.locationId);
    next.town = applyTownDelta(next.town, task);

    const preferredBonus = safeResident.preferredTask === task.id ? 3 : 0;
    const favoriteBonus = safeResident.favoriteLocation === location.id ? 2 : 0;
    const energyAfter = clamp(safeResident.energy - task.energyCost, 0, 100);
    const moodAfter = clamp(safeResident.mood + task.moodDelta + preferredBonus + favoriteBonus - (energyAfter < 20 ? 6 : 0));
    const agentNeeds = updateAgentNeeds(safeResident, task);

    const memory = [
      describeMemory(task.id, location.id, phaseLabel),
      ...safeResident.memory,
    ].slice(0, 5);

    events.push({
      id: crypto.randomUUID(),
      day: next.day,
      phase: phaseLabel,
      type: "action",
      text: narrateAction(safeResident, task, location, phaseLabel),
    });

    return {
      ...safeResident,
      previousLocationId: safeResident.locationId,
      mood: moodAfter,
      energy: energyAfter,
      locationId: location.id,
      agent: {
        ...safeResident.agent,
        needs: agentNeeds,
        decisionReason: reason,
      },
      memory,
    };
  });

  events.push(...processSocialEvents(next, phaseLabel));
  next.events = [...next.events, ...events].slice(-80);

  if (next.phaseIndex === phases.length - 1) {
    next.reports = [createDailyReport(next), ...next.reports].slice(0, 7);
    next.day += 1;
    next.phaseIndex = 0;
    next.residents = next.residents.map((resident) => ({
      ...resident,
      energy: clamp(resident.energy + 22),
      mood: clamp(resident.mood + 2),
      assignmentId: resident.preferredTask,
    }));
  } else {
    next.phaseIndex += 1;
  }

  return next;
}
