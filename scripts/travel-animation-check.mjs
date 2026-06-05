// Travel animation check — validates resident travel animation rendering
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

// ── Mock buildTaskAnimations (same logic as app.js) ──────────────────────────────────────

const EFFECTS = {
  plant:   { action: "work", effect: "bloom", bubble: "花园变得更有精神了。", gait: "walk" },
  cook:    { action: "work", effect: "steam",  bubble: "餐厅飘出了热气。", gait: "walk" },
  repair:  { action: "work", effect: "spark",  bubble: "工坊传来轻轻的敲打声。", gait: "walk" },
  chat:    { action: "chat", effect: "chat",   bubble: "广场上的聊天声多了起来。", gait: "walk" },
  forage:  { action: "work", effect: "leaf",   bubble: "森林里传来树叶沙沙声。", gait: "run" },
  rest:    { action: "rest", effect: "rest",   bubble: "有人在安静地休息。", gait: "slow" },
};

function buildTravelAnimations(prevState, nextState) {
  const prevById = new Map((prevState?.residents ?? []).map((r) => [r.id, r]));
  return nextState.residents.map((resident) => {
    const taskId = resident.assignmentId;
    const effect = EFFECTS[taskId] ?? EFFECTS.rest;
    const prevRes = prevById.get(resident.id);
    const fromPlaceId = prevRes?.locationId ?? null;
    const toPlaceId = resident.locationId;
    const traveling = fromPlaceId != null && toPlaceId !== fromPlaceId;
    const gait = taskId === "forage" ? "run" : taskId === "rest" ? "slow" : (resident.energy ?? 100) < 30 ? "slow" : "walk";
    return {
      id: `anim-${Date.now()}-${resident.id}`,
      residentId: resident.id,
      taskId,
      fromPlaceId: fromPlaceId ?? toPlaceId,
      toPlaceId,
      placeId: toPlaceId,
      action: effect.action,
      effect: effect.effect,
      bubble: effect.bubble,
      gait,
      traveling,
      startedAt: Date.now(),
    };
  });
}

// ── Test: travel from plaza (48,58) to garden (24,34) ───────────────────────────────

console.log("\n── renderApp: travel animation (plaza → garden) ──");
{
  // Simulate prevState with plaza, nextState with garden
  const prevState = JSON.parse(JSON.stringify(createInitialState()));
  // Move hua to plaza
  prevState.residents = prevState.residents.map((r) =>
    r.id === "hua" ? { ...r, locationId: "plaza" } : r
  );

  const nextState = JSON.parse(JSON.stringify(createInitialState()));
  // hua moves to garden
  nextState.residents = nextState.residents.map((r) =>
    r.id === "hua" ? { ...r, locationId: "garden" } : r
  );

  const animations = buildTravelAnimations(prevState, nextState);
  const huaAnim = animations.find((a) => a.residentId === "hua");
  const state = advancePhase(nextState);

  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState(animations));

  assert(huaAnim, "hua animation exists");
  assert(huaAnim.traveling === true, "hua is traveling");
  assert(huaAnim.fromPlaceId === "plaza", `hua fromPlaceId is plaza (got ${huaAnim.fromPlaceId})`);
  assert(huaAnim.toPlaceId === "garden", "hua toPlaceId is garden");
  assert(huaAnim.gait === "walk", `hua gait is walk (got ${huaAnim.gait})`);
  assert(root.innerHTML.includes("stage-character--traveling"), "traveling class applied");
  assert(root.innerHTML.includes("stage-character--gait-walk"), "gait-walk class applied");
  assert(root.innerHTML.includes("--from-x"), "CSS from-x variable present");
  assert(root.innerHTML.includes("--to-x"), "CSS to-x variable present");
  assert(root.innerHTML.includes('hua'), "hua name rendered");
}

// ── Test: forage = run gait ─────────────────────────────────────────────────────────────

console.log("\n── renderApp: forage = run gait ──");
{
  const prevState = JSON.parse(JSON.stringify(createInitialState()));
  prevState.residents = prevState.residents.map((r) =>
    r.id === "seven" ? { ...r, locationId: "cafe" } : r
  );
  const nextState = JSON.parse(JSON.stringify(createInitialState()));
  nextState.residents = nextState.residents.map((r) =>
    r.id === "seven" ? { ...r, assignmentId: "forage", locationId: "forest" } : r
  );

  const animations = buildTravelAnimations(prevState, nextState);
  const sevenAnim = animations.find((a) => a.residentId === "seven");
  assert(sevenAnim?.gait === "run", `forage gait is run (got ${sevenAnim?.gait})`);

  const state = advancePhase(nextState);
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState(animations));

  assert(root.innerHTML.includes("stage-character--gait-run"), "gait-run class for forage");
}

// ── Test: rest = slow gait ─────────────────────────────────────────────────────────────

console.log("\n── renderApp: rest = slow gait ──");
{
  const prevState = JSON.parse(JSON.stringify(createInitialState()));
  prevState.residents = prevState.residents.map((r) =>
    r.id === "mimi" ? { ...r, locationId: "plaza" } : r
  );
  const nextState = JSON.parse(JSON.stringify(createInitialState()));
  nextState.residents = nextState.residents.map((r) =>
    r.id === "mimi" ? { ...r, assignmentId: "rest" } : r
  );

  const animations = buildTravelAnimations(prevState, nextState);
  const mimiAnim = animations.find((a) => a.residentId === "mimi");
  assert(mimiAnim?.gait === "slow", `rest gait is slow (got ${mimiAnim?.gait})`);

  const state = advancePhase(nextState);
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState(animations));
  assert(root.innerHTML.includes("stage-character--gait-slow"), "gait-slow class for rest");
}

// ── Test: no travel (same place) ───────────────────────────────────────────────

console.log("\n── renderApp: no travel when same place ──");
{
  const state = advancePhase(createInitialState());
  // All residents stay put — simulate prev=next same locations
  const animations = buildTravelAnimations(state, state);
  const traveling = animations.filter((a) => a.traveling);
  assert(traveling.length === 0, `no traveling animations when prev===next (${traveling.length} found`);

  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState(animations));
  assert(!root.innerHTML.includes("stage-character--traveling"), "no traveling class when prev===next");
}

// ── Test: action bubble still renders ──────────────────────────────────────────

console.log("\n── renderApp: action bubble with travel ──");
{
  const prevState = JSON.parse(JSON.stringify(createInitialState()));
  prevState.residents = prevState.residents.map((r) =>
    r.id === "hua" ? { ...r, locationId: "plaza" } : r
  );
  const nextState = JSON.parse(JSON.stringify(createInitialState()));
  nextState.residents = nextState.residents.map((r) =>
    r.id === "hua" ? { ...r, locationId: "garden" } : r
  );

  const animations = buildTravelAnimations(prevState, nextState);
  const state = advancePhase(nextState);
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState(animations));

  assert(root.innerHTML.includes("stage-character__action-bubble"), "action bubble rendered during travel");
  assert(root.innerHTML.includes("stage-effect-anchor"), "effect anchor rendered during travel");
}

// ── Test: select-resident still works ───────────────────────────────────────────

console.log("\n── renderApp: select-resident during travel ──");
{
  const prevState = JSON.parse(JSON.stringify(createInitialState()));
  prevState.residents = prevState.residents.map((r) =>
    r.id === "zhou" ? { ...r, locationId: "plaza" } : r
  );
  const nextState = JSON.parse(JSON.stringify(createInitialState()));
  nextState.residents = nextState.residents.map((r) =>
    r.id === "zhou" ? { ...r, locationId: "workshop" } : r
  );
  const animations = buildTravelAnimations(prevState, nextState);
  const state = advancePhase(nextState);
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState(animations));

  assert(root.innerHTML.includes('data-action="select-resident"'), "select-resident action preserved");
}

// ── Results ────────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll travel animation checks passed!");
