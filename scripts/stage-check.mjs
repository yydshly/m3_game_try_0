// Stage check — validates illustrated town stage rendering
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

// ── Illustrated SVG background exists ─────────────────────────────────────────────

console.log("\n── SVG background asset ──");
{
  const fs = await import("node:fs");
  const path = await import("node:path");
  const svgPath = path.join(process.cwd(), "src/assets/map/town-stage-day.svg");
  const exists = fs.existsSync(svgPath);
  assert(exists, "town-stage-day.svg exists in src/assets/map/");
  if (exists) {
    const content = fs.readFileSync(svgPath, "utf8");
    assert(content.includes("<svg"), "file is valid SVG");
    assert(content.includes("viewBox"), "SVG has viewBox");
    assert(content.length < 100_000, `SVG file size reasonable (${content.length} bytes)`);
  }
}

// ── renderApp: stage elements ─────────────────────────────────────────────────────

console.log("\n── renderApp: town stage elements ──");
{
  const state = advancePhase(advancePhase(createInitialState()));
  root.innerHTML = "";
  renderApp(root, state, noopHandlers);

  assert(root.innerHTML.includes('class="town-stage'), "town-stage rendered");
  assert(root.innerHTML.includes("town-stage__background"), "stage background layer rendered");
  assert(root.innerHTML.includes("town-stage__labels"), "stage labels layer rendered");
  assert(root.innerHTML.includes("town-stage__characters"), "stage characters layer rendered");
  assert(root.innerHTML.includes("stage-place-label"), "place labels rendered");
  assert(root.innerHTML.includes("stage-character"), "stage characters rendered");
  assert(root.innerHTML.includes("stage-bubble"), "stage bubble rendered");
  assert(root.innerHTML.includes("stage-legend"), "stage legend rendered");
}

// ── renderApp: place labels ────────────────────────────────────────────────────────

console.log("\n── renderApp: place labels ──");
{
  const state = advancePhase(advancePhase(createInitialState()));
  root.innerHTML = "";
  renderApp(root, state, noopHandlers);

  assert(root.innerHTML.includes("花园"), "garden place label rendered");
  assert(root.innerHTML.includes("餐厅"), "cafe place label rendered");
  assert(root.innerHTML.includes("工坊"), "workshop place label rendered");
  assert(root.innerHTML.includes("广场"), "plaza place label rendered");
  assert(root.innerHTML.includes("森林"), "forest place label rendered");
}

// ── renderApp: resident characters ───────────────────────────────────────────────

console.log("\n── renderApp: resident characters ──");
{
  const state = advancePhase(advancePhase(createInitialState()));
  root.innerHTML = "";
  renderApp(root, state, noopHandlers);

  assert(root.innerHTML.includes('data-action="select-resident"'), "select-resident action on character");
  assert(root.innerHTML.includes("stage-character__task"), "task bubble rendered");
  assert(root.innerHTML.includes("stage-character__name"), "character name label rendered");
  assert(root.innerHTML.includes("小花"), "hua character name rendered");
  assert(root.innerHTML.includes("阿远"), "yuan character name rendered");
  assert(root.innerHTML.includes("米米"), "mimi character name rendered");
  assert(root.innerHTML.includes("老周"), "zhou character name rendered");
  assert(root.innerHTML.includes("小七"), "seven character name rendered");
  assert(root.innerHTML.includes('data-resident-id="hua"'), "hua resident id in character data attribute");
  assert(root.innerHTML.includes('data-resident-id="seven"'), "seven resident id in character data attribute");
}

// ── renderApp: location codex ─────────────────────────────────────────────────────

console.log("\n── renderApp: location codex ──");
{
  const state = advancePhase(createInitialState());
  root.innerHTML = "";
  renderApp(root, state, noopHandlers);

  assert(root.innerHTML.includes("location-codex"), "location codex rendered");
  assert(root.innerHTML.includes("location-codex__item"), "location codex items rendered");
  assert(root.innerHTML.includes("location-codex__icon"), "location codex icons rendered");
}

// ── renderApp: story section preserved ─────────────────────────────────────────────

console.log("\n── renderApp: story section preserved ──");
{
  const state = advancePhase(advancePhase(advancePhase(createInitialState())));
  root.innerHTML = "";
  renderApp(root, state, noopHandlers);

  assert(root.innerHTML.includes("story-section"), "story section preserved");
  assert(root.innerHTML.includes("feed-item"), "event feed preserved");
  assert(root.innerHTML.includes("town-memory"), "town memory preserved");
  assert(root.innerHTML.includes('class="relations"') || root.innerHTML.includes('relations"'), "relationships section preserved");
  assert(root.innerHTML.includes("report"), "report section preserved");
}

// ── Results ────────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\nAll stage checks passed!");
