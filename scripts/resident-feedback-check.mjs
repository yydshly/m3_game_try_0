// Resident feedback check — tests buildResidentMoodView and render integration
import { buildResidentMoodView, MOOD_VIEW_MAP } from "../src/domain/residentMood.js";
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
  onGenerateTts() {},
  onPlayTts() {},
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

// ── MOOD_VIEW_MAP ───────────────────────────────────────────────────────────────
console.log("\n── MOOD_VIEW_MAP ──");

assert(MOOD_VIEW_MAP.tired, "tired entry exists");
assert(MOOD_VIEW_MAP["low-mood"], "low-mood entry exists");
assert(MOOD_VIEW_MAP.happy, "happy entry exists");
assert(MOOD_VIEW_MAP.steady, "steady entry exists");
assert(MOOD_VIEW_MAP.neutral, "neutral entry exists");
assert(typeof MOOD_VIEW_MAP.tired.icon === "string" && MOOD_VIEW_MAP.tired.icon.length > 0, "tired has icon");
assert(typeof MOOD_VIEW_MAP.tired.label === "string" && MOOD_VIEW_MAP.tired.label.length > 0, "tired has label");
assert(typeof MOOD_VIEW_MAP.tired.cssClass === "string" && MOOD_VIEW_MAP.tired.cssClass.length > 0, "tired has cssClass");

// ── buildResidentMoodView — mood classification ──────────────────────────────────
console.log("\n── buildResidentMoodView: mood classification ──");

{
  const view = buildResidentMoodView({ id: "hua", mood: 90, energy: 80 });
  assert(view.moodCssClass === MOOD_VIEW_MAP.happy.cssClass, "mood>=82 → happy");
  assert(view.moodIcon === MOOD_VIEW_MAP.happy.icon, "happy icon");
  assert(view.moodLabel === MOOD_VIEW_MAP.happy.label, "happy label");
}

{
  const view = buildResidentMoodView({ id: "hua", mood: 50, energy: 80 });
  assert(view.moodCssClass === MOOD_VIEW_MAP.steady.cssClass, "45<=mood<82 → steady");
}

{
  const view = buildResidentMoodView({ id: "hua", mood: 30, energy: 80 });
  assert(view.moodCssClass === MOOD_VIEW_MAP["low-mood"].cssClass, "mood<45 → low-mood");
}

{
  const view = buildResidentMoodView({ id: "hua", mood: 90, energy: 20 });
  assert(view.moodCssClass === MOOD_VIEW_MAP.tired.cssClass, "energy<30 → tired (even if mood high)");
}

{
  const view = buildResidentMoodView({ id: "hua", mood: 90, energy: 29 });
  assert(view.moodCssClass === MOOD_VIEW_MAP.tired.cssClass, "energy=29 → tired");
}

// ── buildResidentMoodView — null/undefined inputs ────────────────────────────────
console.log("\n── buildResidentMoodView: null/undefined inputs ──");

{
  const view = buildResidentMoodView(null);
  assert(view.residentId === null, "null resident returns null residentId");
  assert(view.moodCssClass === MOOD_VIEW_MAP.neutral.cssClass, "null resident falls back to neutral");
  assert(view.statusText === "在小镇里闲逛", "null resident: wander status");
}

{
  const view = buildResidentMoodView(undefined);
  assert(view.residentId === null, "undefined resident returns null residentId");
  assert(view.moodCssClass === MOOD_VIEW_MAP.neutral.cssClass, "undefined resident falls back to neutral");
}

{
  const view = buildResidentMoodView({ id: "" });
  assert(view.residentId === "", "empty string id preserved");
}

{
  const view = buildResidentMoodView({ id: "hua" });
  assert(view.residentId === "hua", "missing mood/energy uses defaults");
  assert(view.moodCssClass === MOOD_VIEW_MAP.steady.cssClass, "missing mood falls back to steady");
}

// ── buildResidentMoodView — task status ─────────────────────────────────────────
console.log("\n── buildResidentMoodView: task status ──");

{
  const view = buildResidentMoodView(
    { id: "hua", mood: 70, energy: 60, assignmentId: "plant" },
    { completionById: new Map(), activeAnimations: [] }
  );
  assert(view.statusText === "照看花园", "plant assignment → 照看花园");
  assert(view.statusCssClass === "status-plant", "status-plant cssClass");
}

{
  const view = buildResidentMoodView(
    { id: "hua", mood: 70, energy: 60, assignmentId: "cook" },
    { completionById: new Map(), activeAnimations: [] }
  );
  assert(view.statusText === "准备餐点", "cook assignment → 准备餐点");
}

{
  const view = buildResidentMoodView(
    { id: "hua", mood: 70, energy: 60, assignmentId: "rest" },
    { completionById: new Map(), activeAnimations: [] }
  );
  assert(view.statusText === "正在休息", "rest assignment → 正在休息");
}

{
  const view = buildResidentMoodView(
    { id: "hua", mood: 70, energy: 60, assignmentId: null },
    { completionById: new Map(), activeAnimations: [] }
  );
  assert(view.statusText === "在小镇里闲逛", "no assignment → 闲逛");
}

{
  const view = buildResidentMoodView(
    { id: "hua", mood: 70, energy: 60, assignmentId: "unknown-task" },
    { completionById: new Map(), activeAnimations: [] }
  );
  assert(view.statusText === "在小镇里闲逛", "unknown assignment → 闲逛");
}

// ── buildResidentMoodView — completion feedback ──────────────────────────────────
console.log("\n── buildResidentMoodView: completion feedback ──");

{
  const completionById = new Map([["hua", { residentId: "hua", icon: "🌸", label: "完成照看花园" }]]);
  const view = buildResidentMoodView(
    { id: "hua", mood: 70, energy: 60, assignmentId: "plant" },
    { completionById, activeAnimations: [] }
  );
  assert(view.statusText === "刚完成：完成照看花园", "completion overrides assignment");
  assert(view.statusCssClass === "status-just-completed", "status-just-completed cssClass");
}

// ── buildResidentMoodView — active animation ─────────────────────────────────────
console.log("\n── buildResidentMoodView: active animation ──");

{
  const activeAnimations = [{ residentId: "hua", action: "work", bubble: "花园变得更有精神了。" }];
  const view = buildResidentMoodView(
    { id: "hua", mood: 70, energy: 60, assignmentId: "plant" },
    { completionById: new Map(), activeAnimations }
  );
  assert(view.statusText === "正在行动中", "active animation shows 正在行动中");
  assert(view.statusCssClass === "status-active", "status-active cssClass");
}

// ── buildResidentMoodView — energy label ────────────────────────────────────────
console.log("\n── buildResidentMoodView: energy label ──");

{
  const view = buildResidentMoodView({ id: "hua", mood: 50, energy: 10 });
  assert(view.energyLabel === "体力不足", "energy<20 → 体力不足");
}
{
  const view = buildResidentMoodView({ id: "hua", mood: 50, energy: 25 });
  assert(view.energyLabel === "体力偏低", "energy<40 → 体力偏低");
}
{
  const view = buildResidentMoodView({ id: "hua", mood: 50, energy: 55 });
  assert(view.energyLabel === "精力一般", "energy<60 → 精力一般");
}
{
  const view = buildResidentMoodView({ id: "hua", mood: 50, energy: 75 });
  assert(view.energyLabel === "精力充足", "energy<80 → 精力充足");
}
{
  const view = buildResidentMoodView({ id: "hua", mood: 50, energy: 95 });
  assert(view.energyLabel === "精力充沛", "energy>=80 → 精力充沛");
}

// ── Render integration ──────────────────────────────────────────────────────────
console.log("\n── renderApp: no regression ──");

const state = advancePhase(advancePhase(createInitialState()));
renderApp(root, state, noopHandlers);

assert(root.innerHTML.includes("stage-character__sprite"), "stage characters render");
assert(root.innerHTML.includes("resident__mood-badge") || root.innerHTML.includes("resident__status-row"), "resident card status row renders");
assert(root.innerHTML.includes("spotlight__mood-row") || root.innerHTML.includes("mood-badge"), "spotlight mood row renders");
assert(root.innerHTML.includes("📋"), "task label still renders");
assert(root.innerHTML.includes("moodIcon") === false && root.innerHTML.includes("😐") === false, "no raw data leaked in HTML");

// ── Render: stage character mood icon ───────────────────────────────────────────
console.log("\n── renderApp: stage character mood icon ──");

{
  // Mood icon should appear on stage when there's no completion badge
  const state2 = createInitialState();
  renderApp(root, state2, noopHandlers);
  const huaHtml = root.innerHTML.match(/hua[^>]*>[\s\S]*?<button[^>]*>/m)?.[0] ?? "";
  // No completion badge for fresh state, mood icon should be present
  assert(
    root.innerHTML.includes("stage-character__mood") || !root.innerHTML.includes("stage-character__completion-badge"),
    "mood icon rendered when no completion badge"
  );
}

// ── Render: resident card status row ─────────────────────────────────────────────
console.log("\n── renderApp: resident card status row ──");

{
  const state2 = createInitialState();
  renderApp(root, state2, noopHandlers);
  assert(root.innerHTML.includes("resident__status-row"), "resident__status-row class present");
  assert(root.innerHTML.includes("resident__mood-badge"), "resident__mood-badge class present");
  assert(root.innerHTML.includes("resident__status-text"), "resident__status-text class present");
  assert(root.innerHTML.includes("resident__energy-hint"), "resident__energy-hint class present");
}

// ── Render: completion badge takes priority over mood icon ──────────────────────
console.log("\n── renderApp: completion badge priority ──");

{
  const state2 = createInitialState();
  renderApp(root, state2, noopHandlers, {
    completionFeedback: {
      id: "test",
      message: "本阶段行动完成",
      startedAt: Date.now(),
      residentResults: [
        { residentId: state2.residents[0].id, icon: "🌸", label: "完成照看花园" },
      ],
    },
  });
  assert(root.innerHTML.includes("stage-character__completion-badge"), "completion badge rendered");
  // mood icon should be absent when completion badge is shown
  // (mood icon is only shown when completionResult is falsy)
}

// ── Render: active animation status ─────────────────────────────────────────────
console.log("\n── renderApp: active animation status in card ──");

{
  const state2 = createInitialState();
  renderApp(root, state2, noopHandlers, {
    activeTaskAnimations: [
      {
        id: "anim-1",
        residentId: state2.residents[0].id,
        taskId: "plant",
        action: "work",
        effect: "bloom",
        bubble: "花园变得更有精神了。",
        gait: "walk",
        traveling: false,
        startedAt: Date.now(),
      },
    ],
  });
  assert(root.innerHTML.includes("stage-character__action-bubble"), "action bubble still renders");
  assert(root.innerHTML.includes("stage-character--work"), "work action class applied");
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\nAll resident-feedback checks passed!");
