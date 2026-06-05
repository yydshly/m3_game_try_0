import { locations, phases, residents } from "../data/seed.js";

function createRelationshipMap() {
  const map = {};
  for (const resident of residents) {
    map[resident.id] = {};
    for (const other of residents) {
      if (resident.id !== other.id) {
        map[resident.id][other.id] = 45 + Math.floor(Math.random() * 16);
      }
    }
  }
  return map;
}

export function createInitialState() {
  return {
    day: 1,
    phaseIndex: 0,
    town: {
      comfort: 42,
      supplies: 8,
      spirit: 64,
    },
    residents: residents.map((resident) => ({
      ...resident,
      locationId: resident.favoriteLocation,
      previousLocationId: resident.favoriteLocation,
      assignmentId: resident.preferredTask,
      memory: [`第 1 天搬进小镇，最想先熟悉${locations.find((l) => l.id === resident.favoriteLocation).name}。`],
    })),
    relationships: createRelationshipMap(),
    events: [
      {
        id: crypto.randomUUID(),
        day: 1,
        phase: phases[0].label,
        type: "system",
        text: "新的一天开始了，居民们正在等待安排。",
      },
    ],
    reports: [],
  };
}
