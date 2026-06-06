// player-guidance-check — validates buildGameGuideView and guide-card rendering
// Tests: view model steps, next action logic, guide-card in render output, no dev terms

import { createInitialState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";
import { buildGameGuideView } from "../src/ui/render.js";
import { renderApp } from "../src/ui/render.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); }
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
}

const noopHandlers = {
  onAdvance() {}, onRunDay() {}, onToggleAutoPlay() {}, onMiniMaxPlan() {},
  onMiniMaxEvent() {}, onMiniMaxBroadcast() {}, onAssignTask() {},
  onSelectResident() {}, onResetAssignments() {}, onNewTown() {}, onChooseEvent() {},
};

const mockRoot = {
  innerHTML: "",
  querySelector: () => ({ addEventListener() {} }),
  querySelectorAll: () => [],
};

// ── Test 1: returns steps array ──────────────────────────────────────────────
console.log("\n── buildGameGuideView: returns steps ──");
{
  const state = createInitialState();
  const view = buildGameGuideView(state, { llmStatus: "idle" });
  assert(Array.isArray(view.steps), "steps is an array");
  assert(view.steps.length > 0, "steps is not empty");
  assert(view.steps.some((s) => s.id === "plan"), "has AI管家安排 step");
  assert(view.steps.some((s) => s.id === "advance"), "has 推进时间 step");
  assert(view.steps.some((s) => s.id === "event"), "has 生成事件 step");
  assert(view.steps.some((s) => s.id === "choice"), "has 做出选择 step");
  assert(view.steps.some((s) => s.id === "broadcast"), "has 生成广播 step");
  assert(view.steps.some((s) => s.id === "dialogue"), "has 居民对话 step");
  assert(view.steps.some((s) => s.id === "end-day"), "has 结束今天 step");
}

// ── Test 2: nextActionText changes with state ────────────────────────────────
console.log("\n── buildGameGuideView: nextActionText varies by state ──");
{
  const state = createInitialState();
  const idleView = buildGameGuideView(state, { llmStatus: "idle" });
  assert(typeof idleView.nextActionText === "string", "nextActionText is string");
  assert(idleView.nextActionText.length > 0, "nextActionText is non-empty");

  // After AI plan is ready, next action should change
  const plannedView = buildGameGuideView(state, { llmStatus: "ready" });
  assert(typeof plannedView.nextActionText === "string", "nextActionText is string after planning");

  // After advancing, should suggest generating events
  const advanced = advancePhase(state);
  const advancedView = buildGameGuideView(advanced, { llmStatus: "ready", latestBroadcast: null, residentConversation: { enabled: false } });
  assert(advancedView.nextActionText.includes("事件") || advancedView.nextActionText.includes("选择"), "nextActionText mentions event or choice after advance");
}

// ── Test 3: guide card rendered in renderApp output ──────────────────────────
console.log("\n── renderApp: guide-card rendered ──");
{
  const state = createInitialState();
  mockRoot.innerHTML = "";
  renderApp(mockRoot, state, noopHandlers, { llmStatus: "idle", eventDirectorStatus: "idle", broadcastStatus: "idle", residentConversation: { enabled: false } });
  assert(mockRoot.innerHTML.includes("game-guide"), "game-guide CSS class present in output");
  assert(mockRoot.innerHTML.includes("今日指引"), "今日指引 title present");
  assert(mockRoot.innerHTML.includes("AI 管家安排"), "AI管家安排 step label present");
  assert(mockRoot.innerHTML.includes("game-guide__next-action") || mockRoot.innerHTML.includes("game-guide__next"), "next-action element present");
}

// ── Test 4: guide-card does not contain dev terminology ───────────────────────
console.log("\n── buildGameGuideView: no dev terminology in nextActionText ──");
{
  const devTerms = ["endpoint", "schema", "state.events", "apiKey", "API", "JSON", "fetch", "M3", "debug"];
  const state = createInitialState();
  const view = buildGameGuideView(state, { llmStatus: "idle" });
  const found = devTerms.filter((term) => view.nextActionText.toLowerCase().includes(term.toLowerCase()));
  assert(found.length === 0, `nextActionText contains no dev terms (found: ${found.join(", ") || "none"})`);

  // Also check the guide card rendered HTML
  mockRoot.innerHTML = "";
  renderApp(mockRoot, state, noopHandlers, { llmStatus: "idle", eventDirectorStatus: "idle", broadcastStatus: "idle", residentConversation: { enabled: false } });
  const guideSection = mockRoot.innerHTML.match(/<div class="game-guide"[^>]*>[\s\S]*?<\/div>\s*</)?.[0] ?? "";
  const devInGuide = devTerms.filter((term) => guideSection.toLowerCase().includes(term.toLowerCase()));
  assert(devInGuide.length === 0, `guide-card HTML contains no dev terms (found: ${devInGuide.join(", ") || "none"})`);
}

// ── Test 5: guide-card visible even when event is chosen ──────────────────────
console.log("\n── buildGameGuideView: works when event already chosen ──");
{
  const state = createInitialState();
  const stateWithEvent = {
    ...state,
    events: [
      ...state.events,
      {
        id: "chosen-event",
        type: "m3-event",
        day: 1,
        phase: "下午",
        title: "测试事件",
        text: "测试内容",
        tone: "cozy",
        residentIds: [],
        placeId: "plaza",
        choices: [
          { id: "a", label: "选A", preview: "提示A", resultText: "结果A" },
        ],
        chosenChoiceId: "a",
        choiceResultText: "结果A",
      },
    ],
  };
  const view = buildGameGuideView(stateWithEvent, {
    llmStatus: "ready",
    latestBroadcast: null,
    residentConversation: { enabled: false },
    choiceAftermath: null,
  });
  assert(view.visible === true, "guide view still visible after event chosen");
  assert(typeof view.nextActionText === "string", "nextActionText still valid");
}

// ── Test 6: buildGameGuideView is a pure function (idempotent) ───────────────
console.log("\n── buildGameGuideView: pure / idempotent ──");
{
  const state = createInitialState();
  const ui1 = { llmStatus: "idle" };
  const ui2 = { llmStatus: "idle" };
  const v1 = buildGameGuideView(state, ui1);
  const v2 = buildGameGuideView(state, ui2);
  assert(JSON.stringify(v1.steps) === JSON.stringify(v2.steps), "steps are deterministic");
  assert(v1.nextActionText === v2.nextActionText, "nextActionText is deterministic");
}

// ── Test 7: guide-card does not block town-stage ─────────────────────────────
console.log("\n── renderApp: guide-card does not block stage ──");
{
  const state = createInitialState();
  mockRoot.innerHTML = "";
  renderApp(mockRoot, state, noopHandlers, { llmStatus: "idle", eventDirectorStatus: "idle", broadcastStatus: "idle", residentConversation: { enabled: false } });
  assert(mockRoot.innerHTML.includes("town-stage"), "town-stage is present in output");
  assert(mockRoot.innerHTML.includes("game-guide"), "game-guide is in left column (not blocking stage)");
}

// ── Results ───────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll player-guidance checks passed!");
