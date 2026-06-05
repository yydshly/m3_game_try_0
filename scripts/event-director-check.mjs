// Event Director check — tests normalize logic and render integration
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
  onAssignTask() {},
  onSelectResident() {},
  onResetAssignments() {},
  onNewTown() {},
};

function normalizeMiniMaxEvent(rawEvent, state) {
  const validResidents = Array.isArray(state?.residents) ? state.residents : [];
  const allowedResidentIds = new Set(validResidents.map((r) => r.id));
  const allowedPlaceIds = new Set(["garden", "cafe", "workshop", "plaza", "forest"]);
  const allowedTones = new Set(["cozy", "surprise", "social", "resource", "memory"]);

  const event = rawEvent?.event ?? rawEvent ?? {};

  const residentIds = Array.isArray(event.residentIds)
    ? event.residentIds.filter((id) => allowedResidentIds.has(id))
    : [];

  const placeId = allowedPlaceIds.has(event.placeId) ? event.placeId : "plaza";
  const tone = allowedTones.has(event.tone) ? event.tone : "cozy";
  const title = String(event.title ?? "").trim() || "小镇发生了一件小事";
  const text = String(event.text ?? "").trim() ||
    "今天的小镇很安静，居民们各自继续着自己的生活。";
  const suggestedFollowUp = String(event.suggestedFollowUp ?? "").slice(0, 60);

  return {
    type: "m3-event",
    title: title.slice(0, 36),
    text: text.slice(0, 240),
    tone,
    residentIds,
    placeId,
    suggestedFollowUp,
  };
}

// ── Normalize tests ────────────────────────────────────────────────────────────

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

// Test 1: valid full payload
{
  const result = normalizeMiniMaxEvent({
    event: {
      type: "m3-event",
      title: "森林里传来歌声",
      text: "小七在森林里哼着歌，其他人远远听着。",
      tone: "cozy",
      residentIds: ["seven", "hua"],
      placeId: "forest",
      suggestedFollowUp: "明天可以邀请小七再唱一次。",
    },
  }, mockState);

  assert(result.title === "森林里传来歌声", "valid title preserved");
  assert(result.tone === "cozy", "valid tone preserved");
  assert(result.placeId === "forest", "valid placeId preserved");
  assert(result.residentIds.length === 2, "valid residentIds preserved");
  assert(result.suggestedFollowUp.includes("明天"), "suggestedFollowUp preserved");
}

// Test 2: invalid residentIds filtered
{
  const result = normalizeMiniMaxEvent({
    event: {
      title: "测试事件",
      text: "测试内容",
      residentIds: ["hua", "fake-id", "mimi"],
    },
  }, mockState);

  assert(!result.residentIds.includes("fake-id"), "fake resident id filtered");
  assert(result.residentIds.includes("hua"), "hua kept");
  assert(result.residentIds.includes("mimi"), "mimi kept");
}

// Test 3: invalid placeId fallback to plaza
{
  const result = normalizeMiniMaxEvent({
    event: {
      title: "测试",
      text: "内容",
      placeId: "invalid-place",
    },
  }, mockState);

  assert(result.placeId === "plaza", "invalid placeId falls back to plaza");
}

// Test 4: empty title fallback
{
  const result = normalizeMiniMaxEvent({
    event: {
      title: "",
      text: "有内容",
    },
  }, mockState);

  assert(result.title === "小镇发生了一件小事", "empty title falls back");
}

// Test 5: empty text fallback
{
  const result = normalizeMiniMaxEvent({
    event: {
      title: "有标题",
      text: "",
    },
  }, mockState);

  assert(result.text === "今天的小镇很安静，居民们各自继续着自己的生活。", "empty text falls back");
}

// Test 6: invalid tone fallback to cozy
{
  const result = normalizeMiniMaxEvent({
    event: {
      title: "测试",
      text: "内容",
      tone: "invalid-tone",
    },
  }, mockState);

  assert(result.tone === "cozy", "invalid tone falls back to cozy");
}

// Test 7: no event wrapper — direct object
{
  const result = normalizeMiniMaxEvent({
    title: "直接返回的对象",
    text: "直接对象内容",
    tone: "surprise",
    residentIds: ["zhou"],
    placeId: "cafe",
  }, mockState);

  assert(result.title === "直接返回的对象", "direct object without wrapper works");
  assert(result.tone === "surprise", "direct object tone works");
}

// Test 8: renderApp includes event button
console.log("\n── renderApp integration ──");
const state = advancePhase(advancePhase(advancePhase(createInitialState())));
renderApp(root, state, noopHandlers);

assert(root.innerHTML.includes('data-action="minimax-event"'), "event button rendered");
assert(root.innerHTML.includes("生成小镇事件"), "event button label correct");
assert(root.innerHTML.includes("🎭 生成小镇事件"), "event button with emoji rendered");

// Test 9: m3-event can be rendered in feed
console.log("\n── m3-event rendering ──");
const stateWithM3Event = {
  ...state,
  events: [
    ...state.events,
    {
      id: "m3-event-test-1",
      type: "m3-event",
      day: 2,
      phase: "下午",
      title: "花园里传来笑声",
      text: "小花和阿远在花园里聊天，聊得很开心。",
      tone: "social",
      residentIds: ["hua", "yuan"],
      placeId: "garden",
      suggestedFollowUp: "明天可以安排他们一起种花。",
    },
  ],
};

root.innerHTML = "";
renderApp(root, stateWithM3Event, noopHandlers);

assert(root.innerHTML.includes("花园里传来笑声"), "m3-event title rendered from event object");
assert(root.innerHTML.includes("feed-item--m3-event"), "m3-event CSS class applied");
assert(root.innerHTML.includes("花园里传来笑声"), "m3-event title rendered");
assert(root.innerHTML.includes("social"), "m3-event tone class rendered");
assert(root.innerHTML.includes("花园"), "m3-event place rendered");
assert(root.innerHTML.includes("小花"), "m3-event resident names rendered");
assert(root.innerHTML.includes("明天可以安排他们一起种花"), "m3-event followup rendered");

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\nAll event-director checks passed!");
