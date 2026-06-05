// Animation check — validates task animation layer rendering
import { createInitialState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";
import { renderApp } from "../src/ui/render.js";

const root = {
  innerHTML: "",
  querySelector: () => ({ addEventListener() {} }),
  querySelectorAll: () => [],
};

// renderApp(root, state, handlers, uiState)
// uiState is the 4th arg, handlers is the 3rd
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

// ── Mock task effects (same as app.js TASK_STAGE_EFFECTS) ──────────────────────────

const TASK_STAGE_EFFECTS = {
  plant:   { action: "work", effect: "bloom", bubble: "花园变得更有精神了。" },
  cook:    { action: "work", effect: "steam",  bubble: "餐厅飘出了热气。" },
  repair:  { action: "work", effect: "spark",  bubble: "工坊传来轻轻的敲打声。" },
  chat:    { action: "chat", effect: "chat",   bubble: "广场上的聊天声多了起来。" },
  forage:  { action: "work", effect: "leaf",   bubble: "森林里传来树叶沙沙声。" },
  rest:    { action: "rest", effect: "rest",   bubble: "有人在安静地休息。" },
};

function buildMockAnimations(state) {
  return state.residents.map((resident) => {
    const taskId = resident.assignmentId;
    const effect = TASK_STAGE_EFFECTS[taskId] ?? TASK_STAGE_EFFECTS.rest;
    return {
      id: `anim-${Date.now()}-${resident.id}`,
      residentId: resident.id,
      taskId,
      placeId: resident.locationId,
      action: effect.action,
      effect: effect.effect,
      bubble: effect.bubble,
      startedAt: Date.now(),
    };
  });
}

function makeUiState(animations) {
  return {
    activeTaskAnimations: animations,
    selectedResidentId: null,
    autoPlay: false,
    llmStatus: "idle",
    llmMessage: "",
    eventDirectorStatus: "idle",
    eventDirectorMessage: "",
    broadcastStatus: "idle",
    broadcastMessage: "",
    latestBroadcast: null,
  };
}

// ── renderApp: no animations (default state) ─────────────────────────────────────

console.log("\n── renderApp: default (no animations) ──");
{
  const state = advancePhase(createInitialState());
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState([]));

  assert(root.innerHTML.includes("town-stage"), "stage renders without animations");
  assert(root.innerHTML.includes("stage-character"), "characters render without animations");
  assert(!root.innerHTML.includes("stage-character--active"), "no active class without animations");
  assert(!root.innerHTML.includes("stage-character__action-bubble"), "no action bubble without animations");
}

// ── renderApp: with activeTaskAnimations ─────────────────────────────────────────

console.log("\n── renderApp: with activeTaskAnimations ──");
{
  const state = advancePhase(createInitialState());
  const animations = buildMockAnimations(state);
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState(animations));

  assert(root.innerHTML.includes("stage-character--active"), "active class added to character");
  assert(animations.length >= 5, `at least 5 animations generated (got ${animations.length})`);

  const firstAnim = animations[0];
  const expectedActionClass = `stage-character--${firstAnim.action}`;
  assert(root.innerHTML.includes(expectedActionClass), `character has action class ${expectedActionClass}`);
  assert(root.innerHTML.includes("stage-character__action-bubble"), "action bubble rendered");
  assert(root.innerHTML.includes(firstAnim.bubble), "action bubble text matches resident task");

  const expectedPlaceTaskClass = `stage-place-label--effect-${firstAnim.effect}`;
  assert(root.innerHTML.includes("stage-place-label--task"), "place label has task class");
  assert(root.innerHTML.includes(expectedPlaceTaskClass), `place label has effect class ${expectedPlaceTaskClass}`);
  assert(root.innerHTML.includes("stage-effect-anchor"), "effect anchor rendered");
  assert(root.innerHTML.includes(`stage-effect-anchor--${firstAnim.effect}`), `effect anchor has effect type ${firstAnim.effect}`);
}

// ── renderApp: bloom effect ─────────────────────────────────────────────────

console.log("\n── renderApp: bloom effect ──");
{
  const state = advancePhase(createInitialState());
  const plantResident = state.residents.find((r) => r.assignmentId === "plant");
  if (plantResident) {
    const anim = {
      id: "test-bloom",
      residentId: plantResident.id,
      taskId: "plant",
      placeId: plantResident.locationId,
      action: "work",
      effect: "bloom",
      bubble: "花园变得更有精神了。",
      startedAt: Date.now(),
    };
    root.innerHTML = "";
    renderApp(root, state, handlers, makeUiState([anim]));
    assert(root.innerHTML.includes("花园变得更有精神了。"), "bloom bubble text rendered");
    assert(root.innerHTML.includes("stage-effect-anchor--bloom"), "bloom effect anchor rendered");
    assert(root.innerHTML.includes("stage-character--work"), "character has work action class");
  } else {
    failed++;
    console.error("  ✗ FAIL: no plant resident found in test state");
  }
}

// ── renderApp: chat effect ──────────────────────────────────────────────────

console.log("\n── renderApp: chat effect ──");
{
  const state = advancePhase(createInitialState());
  const chatResident = state.residents.find((r) => r.assignmentId === "chat");
  if (chatResident) {
    const anim = {
      id: "test-chat",
      residentId: chatResident.id,
      taskId: "chat",
      placeId: chatResident.locationId,
      action: "chat",
      effect: "chat",
      bubble: "广场上的聊天声多了起来。",
      startedAt: Date.now(),
    };
    root.innerHTML = "";
    renderApp(root, state, handlers, makeUiState([anim]));
    assert(root.innerHTML.includes("广场上的聊天声多了起来。"), "chat bubble text rendered");
    assert(root.innerHTML.includes("stage-effect-anchor--chat"), "chat effect anchor rendered");
    assert(root.innerHTML.includes("stage-character--chat"), "character has chat action class");
  } else {
    failed++;
    console.error("  ✗ FAIL: no chat resident found in test state");
  }
}

// ── Other panels still work ───────────────────────────────────────────────────

console.log("\n── renderApp: other panels preserved ──");
{
  const state = advancePhase(advancePhase(advancePhase(createInitialState())));
  const animations = buildMockAnimations(state);
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState(animations));

  assert(root.innerHTML.includes('data-action="select-resident"'), "select-resident action preserved");
  assert(root.innerHTML.includes("town-memory"), "town memory section preserved");
  assert(root.innerHTML.includes("feed-item"), "event feed preserved");
  assert(root.innerHTML.includes("atmosphere-panel") || root.innerHTML.includes("town-broadcast"), "broadcast/atm panel preserved");
  assert(root.innerHTML.includes("relations"), "relationships preserved");
}

// ── Results ────────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\nAll animation checks passed!");

