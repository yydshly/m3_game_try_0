// resident-focus-click-check — validates resident focus click feedback on stage
import { createInitialState } from "../src/domain/state.js";
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
  onGenerateTts() {},
  onPlayTts() {},
  onPauseTts() {},
  onAssignTask() {},
  onSelectResident() {},
  onResetAssignments() {},
  onNewTown() {},
  onChooseEvent() {},
  onPlayMimoTts() {},
  onPauseMimoTts() {},
  onStopConversation() {},
  onRunTownDayCycle() {},
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

// ── Test 1: Initial render shows "当前场景" not resident focus ──────────────

console.log("\n── Initial render: shows '当前场景' when no resident is clicked ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, {});

  const html = root.innerHTML;

  // Should show scene digest by default
  assert(html.includes("当前场景"), "initial render shows '当前场景' bubble");
  assert(html.includes("stage-bubble--scene"), "initial bubble has stage-bubble--scene class");
  assert(!html.includes("stage-bubble--resident-focus"), "initial bubble does NOT have stage-bubble--resident-focus");
  assert(!html.includes("正在观察"), "initial bubble does NOT show '正在观察'");
}

// ── Test 2: Clicking a resident switches bubble to resident focus ───────────

console.log("\n── Clicking a resident: bubble switches to resident focus ──");
{
  const state = createInitialState();
  const residentId = state.residents[1].id;

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    selectedResidentId: residentId,
    selectedResidentFocus: {
      residentId,
      clickedAt: Date.now(),
    },
  });

  const html = root.innerHTML;

  assert(html.includes("正在观察"), "resident focus bubble shows '正在观察'");
  assert(html.includes(state.residents[1].name), "resident focus bubble shows resident name");
  assert(html.includes("stage-bubble--resident-focus"), "bubble has stage-bubble--resident-focus class");
  assert(html.includes("data-focus-resident-id"), "bubble has data-focus-resident-id attribute");
  assert(html.includes("📍"), "resident focus shows location icon");
  assert(html.includes("📋"), "resident focus shows task icon");
}

// ── Test 3: Re-clicking same resident still refreshes feedback ───────────────

console.log("\n── Re-clicking same resident: feedback still shows (no early return) ──");
{
  const state = createInitialState();
  const residentId = state.residents[2].id;
  const firstClick = Date.now();
  const secondClick = firstClick + 100;

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    selectedResidentId: residentId,
    selectedResidentFocus: {
      residentId,
      clickedAt: secondClick,
    },
  });

  const html = root.innerHTML;

  assert(html.includes("正在观察"), "re-clicked resident still shows '正在观察'");
  assert(html.includes(state.residents[2].name), "re-clicked resident still shows name");
  assert(html.includes(String(secondClick)), "re-clicked resident shows updated clickedAt");
}

// ── Test 4: Stage character selected class applied to correct resident ───────

console.log("\n── Stage character selected class on correct resident ──");
{
  const state = createInitialState();
  const residentId = state.residents[3].id;

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    selectedResidentId: residentId,
    selectedResidentFocus: {
      residentId,
      clickedAt: Date.now(),
    },
  });

  const html = root.innerHTML;
  // Verify the selected resident has stage-character--selected class on their button.
  // The button classes look like: class="stage-character stage-character--selected stage-character--steady"
  // and data-resident-id is on a child span/element.
  const hasSelectedClass = html.includes("stage-character--selected") && html.includes(`data-resident-id="${residentId}"`);
  assert(hasSelectedClass, "selected resident has stage-character--selected class");
}

// ── Test 5: onSelectResident no longer has early return guard ───────────────

console.log("\n── onSelectResident: no early return on same residentId ──");
{
  // This is a source-code check: verify the guard was removed
  const fs = await import("fs");
  const appSource = fs.readFileSync("./src/app.js", "utf8");
  const hasEarlyReturn = appSource.includes("if (uiState.selectedResidentId === residentId) return;");
  assert(!hasEarlyReturn, "onSelectResident no longer has early return guard");
}

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
