import { phases } from "../data/seed.js";
import { getLocation, getTask } from "../domain/selectors.js";

const openings = [
  "慢慢悠悠地",
  "精神不错地",
  "带着一点期待",
  "一边盘算着今日安排",
  "轻快地",
];

const socialLines = [
  "顺手和身边的人聊了几句，气氛更松弛了。",
  "把今天的小发现分享了出来，大家的关系更近了一点。",
  "注意到朋友有些疲惫，主动放慢了节奏。",
  "用自己的方式帮小镇添了一点热闹。",
];

export function narrateAction(resident, task, location, phaseLabel) {
  const opening = openings[Math.floor(Math.random() * openings.length)];
  const social = socialLines[Math.floor(Math.random() * socialLines.length)];
  return `${phaseLabel}，${resident.name}${opening}去了${location.name}，完成了「${task.label}」。${social}`;
}

export function narratePair(a, b, location, relationDelta) {
  const direction = relationDelta >= 0 ? "更熟了一点" : "有些意见不合";
  return `${a.name}和${b.name}在${location.name}碰面，交流之后两个人${direction}。`;
}

export function createDailyReport(state) {
  const phase = phases[state.phaseIndex]?.label ?? "夜晚";
  const happiest = [...state.residents].sort((a, b) => b.mood - a.mood)[0];
  const tired = [...state.residents].sort((a, b) => a.energy - b.energy)[0];
  const bestResource =
    state.town.comfort >= state.town.supplies ? `舒适度提升到 ${state.town.comfort}` : `物资储备达到 ${state.town.supplies}`;
  const recent = state.events.slice(-4).map((event) => event.text);

  return {
    id: crypto.randomUUID(),
    day: state.day,
    title: `第 ${state.day} 天小镇日报`,
    phase,
    summary: `今天的小镇节奏平稳，${happiest.name}心情最好，${tired.name}需要多休息。${bestResource}。`,
    highlights: recent,
  };
}

export function describeMemory(taskId, locationId, phaseLabel) {
  const task = getTask(taskId);
  const location = getLocation(locationId);
  return `${phaseLabel}在${location.name}完成了${task.label}。`;
}
