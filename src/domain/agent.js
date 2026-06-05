import { tasks } from "../data/seed.js";

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function createDefaultNeeds() {
  return {
    rest: 40,
    social: 38,
    achievement: 48,
  };
}

function createDefaultGoals(resident) {
  return {
    shortTerm: resident.preferredTask ? `完成${resident.preferredTask}任务` : "保持小镇稳定",
    longTerm: "让小镇变得更温暖",
  };
}

export function createResidentAgent(resident) {
  return {
    needs: createDefaultNeeds(),
    goals: createDefaultGoals(resident),
    decisionReason: "Waiting for assignment",
  };
}

export function ensureResidentAgent(resident) {
  const defaults = createResidentAgent(resident);
  const agent = {
    ...defaults,
    ...(resident.agent ?? {}),
    needs: {
      ...defaults.needs,
      ...(resident.agent?.needs ?? {}),
    },
    goals: {
      ...defaults.goals,
      ...(resident.agent?.goals ?? {}),
    },
    decisionReason: String(resident.agent?.decisionReason ?? defaults.decisionReason),
  };

  agent.needs.rest = clamp(agent.needs.rest);
  agent.needs.social = clamp(agent.needs.social);
  agent.needs.achievement = clamp(agent.needs.achievement);

  return {
    ...resident,
    agent,
  };
}

export function updateAgentNeeds(resident, task) {
  const currentNeeds = resident.agent?.needs ?? createDefaultNeeds();
  const restChange = task.id === "rest" ? -24 : Math.max(8, Math.round(task.energyCost * 1.1));
  const socialChange = task.id === "chat" ? -22 : task.locationId === "plaza" ? -10 : 6;
  const achievementChange = resident.preferredTask === task.id ? -18 : 8;

  return {
    rest: clamp(currentNeeds.rest + restChange),
    social: clamp(currentNeeds.social + socialChange),
    achievement: clamp(currentNeeds.achievement + achievementChange),
  };
}

export function applySocialInteraction(resident, amount = 6) {
  const updated = ensureResidentAgent(resident);
  updated.agent.needs.social = clamp(updated.agent.needs.social - amount);
  return updated;
}

export function getCompactAgent(resident) {
  return {
    needs: resident.agent?.needs ?? createDefaultNeeds(),
    goals: resident.agent?.goals ?? createDefaultGoals(resident),
    decisionReason: resident.agent?.decisionReason ?? "",
  };
}

export function getDefaultTaskReason(resident, task, state) {
  if (resident.energy < 26) return "energy low, needs rest";
  if (state.town.supplies <= 3 && task.id !== "rest") return "supplies low, help town forage";
  if (resident.assignmentId && resident.assignmentId !== resident.preferredTask) return "follows current assignment";
  return "follows preferred task";
}
