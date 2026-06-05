import { locations, phases, tasks } from "../data/seed.js";

export function getCurrentPhase(state) {
  return phases[state.phaseIndex];
}

export function getTask(taskId) {
  return tasks.find((task) => task.id === taskId);
}

export function getLocation(locationId) {
  return locations.find((location) => location.id === locationId);
}

export function getResidentsAtLocation(state, locationId) {
  return state.residents.filter((resident) => resident.locationId === locationId);
}

export function getTopRelationships(state) {
  const pairs = [];
  for (const resident of state.residents) {
    for (const [otherId, value] of Object.entries(state.relationships[resident.id])) {
      if (resident.id < otherId) {
        const other = state.residents.find((item) => item.id === otherId);
        const reverse = state.relationships[otherId][resident.id];
        pairs.push({
          id: `${resident.id}-${otherId}`,
          a: resident,
          b: other,
          value: Math.round((value + reverse) / 2),
        });
      }
    }
  }
  return pairs.sort((a, b) => b.value - a.value).slice(0, 5);
}

export function getTownTips(state) {
  const tips = [];
  const tired = state.residents.filter((resident) => resident.energy < 35);
  const lowMood = state.residents.filter((resident) => resident.mood < 45);

  if (state.town.supplies <= 3) {
    tips.push({
      title: "Supplies are low",
      text: "Send one resident to the forest before the evening phase.",
    });
  }

  if (tired.length > 0) {
    tips.push({
      title: "Someone needs rest",
      text: `${tired.map((resident) => resident.name).join("、")} should recover at the cafe soon.`,
    });
  }

  if (lowMood.length > 0) {
    tips.push({
      title: "Mood is dropping",
      text: "A plaza chat or cafe meal can repair the town atmosphere.",
    });
  }

  if (tips.length === 0) {
    tips.push({
      title: "Town is stable",
      text: "Try pairing residents at the same place to grow relationships faster.",
    });
  }

  return tips.slice(0, 3);
}

export function getTownGoals(state) {
  const topRelationship = getTopRelationships(state)[0]?.value ?? 0;
  const restedResidents = state.residents.filter((resident) => resident.energy >= 45).length;
  const happyResidents = state.residents.filter((resident) => resident.mood >= 70).length;

  return [
    {
      id: "comfort",
      label: "Comfort 60",
      value: state.town.comfort,
      target: 60,
      detail: "Improve the town with garden care or repairs.",
    },
    {
      id: "supplies",
      label: "Supplies 10",
      value: state.town.supplies,
      target: 10,
      detail: "Send residents to forage when supplies run low.",
    },
    {
      id: "friendship",
      label: "Friendship 70",
      value: topRelationship,
      target: 70,
      detail: "Put residents in the same place to grow relationships.",
    },
    {
      id: "wellbeing",
      label: "Wellbeing 4/5",
      value: Math.min(restedResidents, happyResidents),
      target: 4,
      detail: "Keep mood and energy stable across the town.",
    },
  ];
}
