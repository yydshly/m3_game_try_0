// Task completion feedback check — validates buildTaskCompletionFeedback and task-completion-panel
import { readFileSync } from "fs";
import { resolve } from "path";
import { createInitialState } from "../src/domain/state.js";
import { buildTaskCompletionFeedback } from "../src/domain/residentMood.js";
import { renderApp } from "../src/ui/render.js";

const SRC_DIR = resolve(import.meta.dirname, "../src");

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
  if (condition) { passed++; console.log(`  ✓ ${message}`); }
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
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
    residentVoiceInteraction: { enabled: false },
    residentVoiceClips: [],
    residentConversation: { enabled: false, status: "idle", queue: [], currentIndex: 0, currentLineId: "", visibleText: "", typingTimerId: null, autoPlayVoice: true, error: "", runId: "", startedCount: 0 },
    ttsAudios: {},
    broadcastAudio: { status: "idle" },
    dayCycle: {},
    currentVoicePlayback: null,
    ...overrides,
  };
}

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

console.log("\n── buildTaskCompletionFeedback: view model checks ──");

// 1. null completionFeedback → visible:false
{
  const result = buildTaskCompletionFeedback(createInitialState(), null);
  assert(result.visible === false, "null completionFeedback returns visible:false");
  assert(Array.isArray(result.completions), "completions is an array");
  assert(result.completions.length === 0, "completions is empty");
}

// 2. empty residentResults → visible:false
{
  const result = buildTaskCompletionFeedback(createInitialState(), { residentResults: [] });
  assert(result.visible === false, "empty residentResults returns visible:false");
}

// 3. valid feedback → visible:true and completions populated
{
  const state = createInitialState();
  const feedback = makeCompletionFeedback();
  const result = buildTaskCompletionFeedback(state, feedback);
  assert(result.visible === true, "valid feedback returns visible:true");
  assert(result.completions.length > 0, "completions is populated");
}

// 4. completions include residentName, taskLabel, resultText, moodDelta, energyDelta
{
  const state = createInitialState();
  const feedback = makeCompletionFeedback();
  const result = buildTaskCompletionFeedback(state, feedback);
  const first = result.completions[0];
  assert(typeof first.residentName === "string", "completion has residentName");
  assert(typeof first.taskLabel === "string", "completion has taskLabel");
  assert(typeof first.resultText === "string", "completion has resultText");
  assert(typeof first.moodDelta === "number", "completion has moodDelta");
  assert(typeof first.energyDelta === "number", "completion has energyDelta");
  assert(typeof first.icon === "string", "completion has icon");
  assert(typeof first.tone === "string", "completion has tone");
}

// 5. no crash when resident not found (safe fallback)
{
  const state = createInitialState();
  const feedback = { residentResults: [{ residentId: "nonexistent", icon: "✓", label: "测试" }] };
  const result = buildTaskCompletionFeedback(state, feedback);
  assert(result.visible === true, "returns visible:true even for unknown resident");
  assert(result.completions[0].residentName === "居民", "unknown resident uses fallback name");
}

// 6. task result text is deterministic (not random)
{
  const state = createInitialState();
  const feedback = makeCompletionFeedback();
  const r1 = buildTaskCompletionFeedback(state, feedback);
  const r2 = buildTaskCompletionFeedback(state, feedback);
  assert(r1.completions[0].resultText === r2.completions[0].resultText, "resultText is deterministic (not random)");
}

console.log("\n── renderApp: task-completion-panel rendering checks ──");

// 7. task-completion-panel always rendered (stable container)
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ completionFeedback: null }));
  assert(root.innerHTML.includes("deed-outcome-panel"), "deed-outcome-panel class rendered even when empty");
  assert(root.innerHTML.includes("deed-outcome-panel--empty") || !root.innerHTML.includes("deed-outcome-panel--active"), "empty state uses --empty class");
}

// 8. deed-outcome-panel--active when completionFeedback present
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ completionFeedback: makeCompletionFeedback() }));
  assert(root.innerHTML.includes("deed-outcome-panel--active"), "active state uses --active class");
}

// 9. residentName + taskLabel + resultText appear in active panel
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ completionFeedback: makeCompletionFeedback() }));
  assert(root.innerHTML.includes("task-completion-item"), "task-completion-item list items rendered");
  assert(root.innerHTML.includes("完成照看花园") || root.innerHTML.includes("🌸"), "task label or icon appears in panel");
}

// 10. stage-bubble (今日动态) still present with task completion panel
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ completionFeedback: makeCompletionFeedback() }));
  assert(root.innerHTML.includes("今日动态"), "stage-bubble still rendered (今日动态 not displaced)");
  assert(root.innerHTML.includes("deed-outcome-panel"), "deed-outcome-panel coexists with stage-bubble");
}

// 11. completion badge on characters still works
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ completionFeedback: makeCompletionFeedback() }));
  assert(root.innerHTML.includes("stage-character__completion-badge"), "completion badge still rendered on characters");
}

// 12. no state.events reverse find in buildTaskCompletionFeedback (pure view model)
{
  const src = readFileSync(resolve(SRC_DIR, "domain/residentMood.js"), "utf8");
  assert(
    !src.includes("[...state.events]") && !src.includes("state.events.reverse"),
    "buildTaskCompletionFeedback does not use state.events reverse find"
  );
}

// 13. no API keys or credentials
{
  const src = readFileSync(resolve(SRC_DIR, "domain/residentMood.js"), "utf8");
  const apiKeyPattern = /sk-cp-|tp-[a-z0-9]{10,}|apiKey.*sk-/;
  assert(!apiKeyPattern.test(src), "no API key patterns in residentMood.js");
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`${failed} check(s) failed — review output above`);
  process.exit(1);
} else {
  console.log("All task completion feedback checks passed!");
}
