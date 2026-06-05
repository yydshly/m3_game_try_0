// Broadcast check — tests normalize logic and render integration
import { createInitialState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";
import { renderApp } from "../src/ui/render.js";

const root = {
  innerHTML: "",
  querySelector: () => ({ addEventListener() {} }),
  querySelectorAll: () => [],
};

const noopHandlers = {
  onAdvance() {},
  onRunDay() {},
  onToggleAutoPlay() {},
  onMiniMaxPlan() {},
  onMiniMaxEvent() {},
  onMiniMaxBroadcast() {},
  onAssignTask() {},
  onSelectResident() {},
  onResetAssignments() {},
  onNewTown() {},
};

// Mirror the normalize logic from server.mjs
function normalizeMiniMaxBroadcast(rawBroadcast, state) {
  const validResidents = Array.isArray(state?.residents) ? state.residents : [];
  const allowedResidentIds = new Set(validResidents.map((r) => r.id));
  const allowedPlaceIds = new Set(["garden", "cafe", "workshop", "plaza", "forest"]);
  const allowedMoods = new Set(["warm", "calm", "lively", "tired", "hopeful", "tense"]);

  const raw = rawBroadcast?.broadcast ?? rawBroadcast ?? {};

  const relatedResidentIds = Array.isArray(raw.relatedResidentIds)
    ? raw.relatedResidentIds.filter((id) => allowedResidentIds.has(id))
    : [];

  const placeId = allowedPlaceIds.has(raw.placeId) ? raw.placeId : "plaza";
  const mood = allowedMoods.has(raw.mood) ? raw.mood : "warm";
  const title = String(raw.title ?? "").trim() || "今日小镇广播";
  const script = String(raw.script ?? "").trim() ||
    "今天的小镇安静地运转着，居民们继续着自己的生活。";

  const phaseMap = { morning: "温暖清晨", afternoon: "轻快午后", evening: "安静夜晚" };
  const phaseKey = state?.phaseIndex === 0 ? "morning" : state?.phaseIndex === 1 ? "afternoon" : "evening";
  const musicMood = String(raw.musicMood ?? "").trim() || phaseMap[phaseKey] || "温暖清晨";
  const musicPrompt = String(raw.musicPrompt ?? "").trim() ||
    "温暖、治愈、轻松的小镇生活背景音乐，适合休闲模拟游戏。";
  const durationHint = String(raw.durationHint ?? "").trim() || "15-30s";

  return {
    type: "town-broadcast",
    title: title.slice(0, 32),
    script: script.slice(0, 360),
    mood,
    musicMood: musicMood.slice(0, 40),
    musicPrompt: musicPrompt.slice(0, 120),
    relatedResidentIds,
    placeId,
    durationHint: durationHint.slice(0, 20),
  };
}

const mockState = {
  residents: [
    { id: "hua", name: "小花" },
    { id: "yuan", name: "阿远" },
    { id: "mimi", name: "米米" },
    { id: "zhou", name: "老周" },
    { id: "seven", name: "小七" },
  ],
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// Normalize tests
console.log("\n── normalize tests ──");

{
  const result = normalizeMiniMaxBroadcast({
    broadcast: {
      type: "town-broadcast",
      title: "早安小镇",
      script: "亲爱的居民们，早上好。今天阳光温暖，大家加油。",
      mood: "warm",
      musicMood: "温暖清晨",
      musicPrompt: "轻柔的吉他，适合小镇清晨",
      relatedResidentIds: ["hua", "mimi"],
      placeId: "plaza",
      durationHint: "20s",
    },
  }, mockState);

  assert(result.title === "早安小镇", "valid title preserved");
  assert(result.mood === "warm", "valid mood preserved");
  assert(result.placeId === "plaza", "valid placeId preserved");
  assert(result.relatedResidentIds.length === 2, "valid residentIds preserved");
  assert(result.musicMood === "温暖清晨", "musicMood preserved");
  assert(result.musicPrompt.includes("吉他"), "musicPrompt preserved");
}

{
  const result = normalizeMiniMaxBroadcast({
    broadcast: { title: "", script: "", mood: "invalid-mood" },
  }, mockState);
  assert(result.title === "今日小镇广播", "empty title falls back");
  assert(result.mood === "warm", "invalid mood falls back to warm");
}

{
  const result = normalizeMiniMaxBroadcast({
    broadcast: { title: "有标题", script: "", musicMood: "晴朗午后" },
  }, { ...mockState, phaseIndex: 1 });
  assert(result.script === "今天的小镇安静地运转着，居民们继续着自己的生活。", "empty script falls back");
  assert(result.musicMood === "晴朗午后", "musicMood preserved even when non-empty");
}

{
  const result = normalizeMiniMaxBroadcast({
    broadcast: { placeId: "fake-place" },
  }, mockState);
  assert(result.placeId === "plaza", "invalid placeId falls back to plaza");
}

{
  const result = normalizeMiniMaxBroadcast({
    broadcast: { relatedResidentIds: ["hua", "fake", "mimi"] },
  }, mockState);
  assert(!result.relatedResidentIds.includes("fake"), "fake resident id filtered");
  assert(result.relatedResidentIds.includes("hua"), "hua kept");
}

{
  const result = normalizeMiniMaxBroadcast({
    broadcast: { musicMood: "", musicPrompt: "" },
  }, { ...mockState, phaseIndex: 2 });
  assert(result.musicMood === "安静夜晚", "empty musicMood falls back based on phase");
  assert(result.musicPrompt === "温暖、治愈、轻松的小镇生活背景音乐，适合休闲模拟游戏。", "empty musicPrompt falls back");
}

// Direct object (no broadcast wrapper)
{
  const result = normalizeMiniMaxBroadcast({
    title: "直接返回",
    script: "直接脚本内容",
    mood: "lively",
    relatedResidentIds: ["zhou"],
    placeId: "garden",
  }, mockState);
  assert(result.title === "直接返回", "direct object title works");
  assert(result.mood === "lively", "direct object mood works");
  assert(result.placeId === "garden", "direct object placeId works");
}

// Render tests
console.log("\n── renderApp integration ──");
const state = advancePhase(advancePhase(createInitialState()));
renderApp(root, state, noopHandlers);

assert(root.innerHTML.includes('data-action="minimax-broadcast"'), "broadcast button rendered");
assert(root.innerHTML.includes("生成小镇广播"), "broadcast button label correct");
assert(root.innerHTML.includes("🎧 小镇氛围"), "atmosphere panel rendered");
assert(root.innerHTML.includes("尚未生成"), "atmosphere default state shown");

// town-broadcast in event feed
console.log("\n── town-broadcast rendering ──");
const stateWithBroadcast = {
  ...state,
  events: [
    ...state.events,
    {
      id: "broadcast-test-1",
      type: "town-broadcast",
      day: 2,
      phase: "下午",
      title: "下午小镇广播",
      text: "亲爱的居民们，下午好。今天的小镇一切安好。",
      mood: "warm",
      musicMood: "轻快午后",
      musicPrompt: "轻快的钢琴曲，适合小镇午后",
      residentIds: ["hua"],
      placeId: "plaza",
      durationHint: "20s",
    },
  ],
};

root.innerHTML = "";
renderApp(root, stateWithBroadcast, noopHandlers);

assert(root.innerHTML.includes("feed-item--town-broadcast"), "town-broadcast CSS class applied");
assert(root.innerHTML.includes("下午小镇广播"), "broadcast title rendered");
assert(root.innerHTML.includes("warm") || root.innerHTML.includes("温暖"), "broadcast mood shown");
assert(root.innerHTML.includes("plaza") || root.innerHTML.includes("广场"), "broadcast place shown");
assert(root.innerHTML.includes("轻快午后"), "broadcast musicMood shown");

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\nAll broadcast checks passed!");
