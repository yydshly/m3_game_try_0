// Completion feedback check — validates task completion feedback rendering
import { createInitialState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";
import { renderApp } from "../src/ui/render.js";

const root = {
  innerHTML: "",
  querySelector: () => ({ addEventListener() {} }),
  querySelectorAll: () => [],
};

const handlers = {
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
  onChooseEvent() {},
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

function makeUiState(overrides = {}) {
  return {
    activeTaskAnimations: [],
    selectedResidentId: null,
    autoPlay: false,
    llmStatus: "idle",
    llmMessage: "",
    eventDirectorStatus: "idle",
    eventDirectorMessage: "",
    broadcastStatus: "idle",
    broadcastMessage: "",
    latestBroadcast: null,
    isAnimating: false,
    animationMessage: "",
    completionFeedback: null,
    ...overrides,
  };
}

// ── Mock completion feedback ─────────────────────────────────────────────────────

function makeCompletionFeedback() {
  return {
    id: "completion-test",
    message: "本阶段行动完成",
    startedAt: Date.now(),
    residentResults: [
      { residentId: "hua", icon: "🌸", label: "完成照看花园" },
      { residentId: "yuan", icon: "🍲", label: "完成准备餐点" },
      { residentId: "mimi", icon: "💬", label: "完成邻里交流" },
      { residentId: "zhou", icon: "🔧", label: "完成工坊维护" },
      { residentId: "seven", icon: "🌿", label: "完成森林采集" },
    ],
  };
}

// ── Test: completionFeedback=null → no banner ─────────────────────────────────

console.log("\n── renderApp: no completion banner when completionFeedback=null ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ completionFeedback: null }));

  assert(!root.innerHTML.includes("本阶段行动完成"), "no completion message when null");
  assert(!root.innerHTML.includes("game-actions__completion-banner"), "no completion banner class when null");
  assert(!root.innerHTML.includes("stage-character__completion-badge"), "no completion badge when null");
}

// ── Test: completionFeedback present → banner shown ───────────────────────────────

console.log("\n── renderApp: completionFeedback shows banner ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ completionFeedback: makeCompletionFeedback() }));

  assert(root.innerHTML.includes("本阶段行动完成"), "completion message shown");
  assert(root.innerHTML.includes("game-actions__completion-banner"), "completion banner class applied");
  assert(root.innerHTML.includes("✅ 本阶段行动完成"), "checkmark + message in banner");
}

// ── Test: completion badges on characters ───────────────────────────────────────

console.log("\n── renderApp: completion badges on characters ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ completionFeedback: makeCompletionFeedback() }));

  assert(root.innerHTML.includes("stage-character__completion-badge"), "completion badge class rendered");
  assert(root.innerHTML.includes("🌸"), "hua completion icon rendered");
  assert(root.innerHTML.includes("🍲"), "yuan completion icon rendered");
  assert(root.innerHTML.includes("完成照看花园"), "hua completion label rendered");
}

// ── Test: isAnimating=false + completion present → buttons still enabled ─────────

console.log("\n── renderApp: buttons enabled when isAnimating=false even with completion ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    isAnimating: false,
    animationMessage: "",
    completionFeedback: makeCompletionFeedback(),
  }));

  const advanceBtn = root.innerHTML.match(/data-action="advance"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
  assert(!advanceBtn.includes("disabled"), "advance button enabled with completion feedback (isAnimating=false)");
}

// ── Test: isAnimating=true + completion → buttons still disabled ─────────────────

console.log("\n── renderApp: buttons disabled when isAnimating=true even with completion ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    isAnimating: true,
    animationMessage: "居民正在行动中……",
    completionFeedback: makeCompletionFeedback(),
  }));

  const advanceBtn = root.innerHTML.match(/data-action="advance"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
  assert(advanceBtn.includes("disabled"), "advance button disabled when isAnimating=true");
  assert(root.innerHTML.includes("game-actions__anim-banner"), "anim banner still shown");
  assert(root.innerHTML.includes("game-actions__completion-banner"), "completion banner shown alongside anim banner");
}

// ── Test: feed-item--latest applied to newest event ──────────────────────────────

console.log("\n── renderApp: feed-item--latest on newest event ──");
{
  const state = advancePhase(createInitialState()); // has events
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ completionFeedback: makeCompletionFeedback() }));

  assert(root.innerHTML.includes("feed-item--latest"), "feed-item--latest class applied");
}

// ── Test: town-memory preserved with completion ───────────────────────────────────

console.log("\n── renderApp: town-memory preserved ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ completionFeedback: makeCompletionFeedback() }));

  assert(root.innerHTML.includes("town-memory"), "town memory section present");
  assert(root.innerHTML.includes("🧠"), "town memory header rendered");
}

// ── Test: event feed preserved with completion ───────────────────────────────────

console.log("\n── renderApp: event feed preserved ──");
{
  const state = advancePhase(createInitialState());
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ completionFeedback: makeCompletionFeedback() }));

  assert(root.innerHTML.includes("📟 小镇动态"), "event feed rendered");
  assert(root.innerHTML.includes("feed-item"), "feed items rendered");
}

// ── Test: broadcast panel preserved with completion ───────────────────────────────

console.log("\n── renderApp: broadcast panel preserved ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ completionFeedback: makeCompletionFeedback() }));

  assert(root.innerHTML.includes("🎧 小镇氛围"), "atmosphere panel rendered");
}

// ── Results ────────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll completion feedback checks passed!");
