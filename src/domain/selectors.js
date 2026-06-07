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
      label: "让小镇保持舒适",
      value: state.town.comfort,
      target: 60,
      detail: "照看花园、修理工坊会提升小镇舒适度。",
    },
    {
      id: "supplies",
      label: "储备足够食材",
      value: state.town.supplies,
      target: 10,
      detail: "去森林采集，或通过餐厅事件补充物资。",
    },
    {
      id: "friendship",
      label: "促成居民互动",
      value: topRelationship,
      target: 70,
      detail: "让居民在同一地点聊天或合作，会提高关系。",
    },
    {
      id: "wellbeing",
      label: "照顾居民状态",
      value: Math.min(restedResidents, happyResidents),
      target: 4,
      detail: "保持心情和体力稳定，居民会更愿意参与小镇生活。",
    },
  ];
}
