// Animation sync check — validates animation lock and UI state
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
    ...overrides,
  };
}

// ── Test: isAnimating=false → buttons enabled ────────────────────────────────

console.log("\n── renderApp: isAnimating=false, buttons enabled ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ isAnimating: false }));

  const advanceBtn = root.innerHTML.match(/data-action="advance"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
  const runDayBtn = root.innerHTML.match(/data-action="run-day"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";

  assert(!advanceBtn.includes("disabled"), "advance button enabled when isAnimating=false");
  assert(!runDayBtn.includes("disabled"), "run-day button enabled when isAnimating=false");
  assert(!root.innerHTML.includes("居民正在行动中"), "no animation banner when isAnimating=false");
}

// ── Test: isAnimating=true → banner shown, buttons disabled ──────────────────────────

console.log("\n── renderApp: isAnimating=true, banner + disabled ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    isAnimating: true,
    animationMessage: "居民正在行动中……",
  }));

  const advanceBtn = root.innerHTML.match(/data-action="advance"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
  const runDayBtn = root.innerHTML.match(/data-action="run-day"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";

  assert(advanceBtn.includes("disabled"), "advance button disabled when isAnimating=true");
  assert(runDayBtn.includes("disabled"), "run-day button disabled when isAnimating=true");
  assert(root.innerHTML.includes("居民正在行动中"), "animation banner shown when isAnimating=true");
  assert(root.innerHTML.includes("game-actions__anim-banner"), "animation banner CSS class present");
  assert(advanceBtn.includes("居民行动中..."), "advance button text changes during animation");
}

// ── Test: auto-play toggle still enabled during animation ─────────────────────────────

console.log("\n── renderApp: auto-play toggle enabled during animation ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    isAnimating: true,
    animationMessage: "居民正在行动中……",
    autoPlay: false,
  }));

  const autoToggle = root.innerHTML.match(/data-action="toggle-auto"[^>]*>/)?.[0] ?? "";
  assert(!autoToggle.includes("disabled"), "auto-play toggle still enabled during animation");
}

// ── Test: activeTaskAnimations still work during isAnimating ────────────────────────

console.log("\n── renderApp: activeTaskAnimations + isAnimating together ──");
{
  // Force a location change: prevState has hua at plaza, nextState has hua at garden
  const prevState = JSON.parse(JSON.stringify(createInitialState()));
  prevState.residents = prevState.residents.map((r) =>
    r.id === "hua" ? { ...r, locationId: "plaza" } : r
  );
  const nextState = JSON.parse(JSON.stringify(createInitialState()));
  nextState.residents = nextState.residents.map((r) =>
    r.id === "hua" ? { ...r, locationId: "garden" } : r
  );

  const prevById = new Map(prevState.residents.map((r) => [r.id, r]));
  const animations = nextState.residents.map((resident) => {
    const fromRes = prevById.get(resident.id);
    const fromPlace = fromRes?.locationId ?? null;
    const toPlace = resident.locationId;
    return {
      id: `anim-${Date.now()}-${resident.id}`,
      residentId: resident.id,
      taskId: resident.assignmentId,
      fromPlaceId: fromPlace ?? toPlace,
      toPlaceId: toPlace,
      placeId: toPlace,
      action: "work",
      effect: "bloom",
      bubble: "测试气泡",
      gait: "walk",
      traveling: fromPlace != null && toPlace !== fromPlace,
      startedAt: Date.now(),
    };
  });

  root.innerHTML = "";
  renderApp(root, nextState, handlers, makeUiState({
    isAnimating: true,
    animationMessage: "居民正在行动中……",
    activeTaskAnimations: animations,
  }));

  assert(root.innerHTML.includes("stage-character--traveling"), "traveling class still applied with isAnimating");
  assert(root.innerHTML.includes("stage-character__action-bubble"), "action bubble still rendered");
  assert(root.innerHTML.includes("stage-effect-anchor"), "effect anchor still rendered");
  assert(root.innerHTML.includes("居民正在行动中"), "animation banner shown alongside animations");
}

// ── Test: new-town resets isAnimating ───────────────────────────────────────────────

console.log("\n── renderApp: fresh state has isAnimating=false ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ isAnimating: false }));

  const advanceBtn = root.innerHTML.match(/data-action="advance"[^>]*>/)?.[0] ?? "";
  assert(!advanceBtn.includes("disabled"), "fresh state: advance button enabled");
  assert(!root.innerHTML.includes("居民正在行动中"), "fresh state: no animation banner");
}

// ── Test: AI/event/broadcast buttons also disabled during animation ─────────────────

console.log("\n── renderApp: AI/event/broadcast disabled during animation ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    isAnimating: true,
    animationMessage: "居民正在行动中……",
  }));

  const planBtn = root.innerHTML.match(/data-action="minimax-plan"[^>]*>/)?.[0] ?? "";
  const eventBtn = root.innerHTML.match(/data-action="minimax-event"[^>]*>/)?.[0] ?? "";
  const broadcastBtn = root.innerHTML.match(/data-action="minimax-broadcast"[^>]*>/)?.[0] ?? "";

  assert(planBtn.includes("disabled"), "AI plan button disabled during animation");
  assert(eventBtn.includes("disabled"), "event button disabled during animation");
  assert(broadcastBtn.includes("disabled"), "broadcast button disabled during animation");
}

// ── Results ────────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll animation sync checks passed!");
