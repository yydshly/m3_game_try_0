// ai-director-check — validates AI Director life scenario layer
import { createInitialState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";
import { renderApp } from "../src/ui/render.js";
import { TOWN_LIFE_SCENARIOS, buildAiDirectorContext, selectTownLifeScenario } from "../src/domain/aiDirector.js";

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

// ── 1. TOWN_LIFE_SCENARIOS exists ──────────────────────────────────────────────
console.log("\n── TOWN_LIFE_SCENARIOS exists ──");
assert(Array.isArray(Object.keys(TOWN_LIFE_SCENARIOS)), "TOWN_LIFE_SCENARIOS is an object");
assert(Object.keys(TOWN_LIFE_SCENARIOS).length >= 8, `at least 8 scenarios (got ${Object.keys(TOWN_LIFE_SCENARIOS).length})`);

// ── 2. Each scenario has required fields ──────────────────────────────────────
console.log("\n── Scenario fields ──");
for (const [id, scenario] of Object.entries(TOWN_LIFE_SCENARIOS)) {
  assert(typeof scenario.id === "string" && scenario.id === id, `${id}: id present and matches key`);
  assert(typeof scenario.label === "string" && scenario.label.length > 0, `${id}: label present`);
  assert(typeof scenario.description === "string" && scenario.description.length > 0, `${id}: description present`);
  assert(Array.isArray(scenario.relatedTasks) && scenario.relatedTasks.length > 0, `${id}: relatedTasks is non-empty array`);
  assert(typeof scenario.tone === "string" && scenario.tone.length > 0, `${id}: tone present`);
}

// ── 3. Not just eat/sleep/rest ─────────────────────────────────────────────────
console.log("\n── Scenario variety ──");
const allRelatedTasks = Object.values(TOWN_LIFE_SCENARIOS).flatMap((s) => s.relatedTasks);
const uniqueTasks = [...new Set(allRelatedTasks)];
assert(uniqueTasks.length >= 5, `relatedTasks variety: at least 5 unique tasks (got ${uniqueTasks.length})`);
assert(uniqueTasks.some((t) => t === "repair"), "includes repair (not just eat/sleep/rest)");
assert(uniqueTasks.some((t) => t === "plant" || t === "forage"), "includes garden/forage tasks");

// ── 4. buildAiDirectorContext exists ────────────────────────────────────────────
console.log("\n── buildAiDirectorContext function ──");
assert(typeof buildAiDirectorContext === "function", "buildAiDirectorContext is a function");

// ── 5. selectTownLifeScenario exists ───────────────────────────────────────────
console.log("\n── selectTownLifeScenario function ──");
assert(typeof selectTownLifeScenario === "function", "selectTownLifeScenario is a function");

// ── 6. buildAiDirectorContext returns expected shape ──────────────────────────────
console.log("\n── buildAiDirectorContext output shape ──");
{
  const state = createInitialState();
  const ctx = buildAiDirectorContext(state);
  assert(ctx !== null && typeof ctx === "object", "returns an object");
  assert(ctx.activeScenario !== null && typeof ctx.activeScenario === "object", "activeScenario present");
  assert(Array.isArray(ctx.residentSnapshots), "residentSnapshots is array");
  assert(typeof ctx.townMemorySummary === "string", "townMemorySummary is string");
  assert(typeof ctx.promptText === "string", "promptText is string");
  assert(Array.isArray(ctx.availablePlaces), "availablePlaces is array");
  assert(ctx.taskDistribution !== null && typeof ctx.taskDistribution === "object", "taskDistribution is object");
}

// ── 7. selectTownLifeScenario returns valid scenario ────────────────────────────
console.log("\n── selectTownLifeScenario output ──");
{
  const state = createInitialState();
  const scenario = selectTownLifeScenario(state);
  const validIds = Object.keys(TOWN_LIFE_SCENARIOS);
  assert(validIds.includes(scenario.id), `returns valid scenario id (got ${scenario.id})`);
  assert(TOWN_LIFE_SCENARIOS[scenario.id]?.id === scenario.id, "returns scenario from TOWN_LIFE_SCENARIOS");
}

// ── 8. buildAiDirectorContext uses townMemory ─────────────────────────────────
console.log("\n── townMemory in AI Director context ──");
{
  const stateWithMemory = {
    ...createInitialState(),
    townMemory: [
      { day: 1, phase: "早上", type: "player-choice", title: "测试", text: "选择了帮助邻居", residentIds: [], placeId: "plaza" },
    ],
  };
  const ctx = buildAiDirectorContext(stateWithMemory);
  assert(ctx.townMemorySummary.length > 0, "townMemorySummary non-empty when memory exists");
  assert(ctx.recentChoices.length > 0, "recentChoices populated from player-choice");
}

// ── 9. buildAiDirectorContext uses resident memory ─────────────────────────────
console.log("\n── resident memory in AI Director context ──");
{
  const state = createInitialState();
  state.residents[0].memory = ["和小花聊了聊天，感觉很开心。"];
  const ctx = buildAiDirectorContext(state);
  assert(ctx.residentMemorySummary.length > 0, "residentMemorySummary populated");
}

// ── 10. Fallback when no memory ────────────────────────────────────────────────
console.log("\n── Fallback when no memory ──");
{
  const emptyState = {
    ...createInitialState(),
    townMemory: [],
    residents: createInitialState().residents.map((r) => ({ ...r, memory: [] })),
  };
  const ctx = buildAiDirectorContext(emptyState);
  assert(ctx.townMemorySummary === "", "townMemorySummary empty when no memory");
  assert(ctx.recentChoices === "", "recentChoices empty when no choices");
  assert(ctx.activeScenario !== null, "activeScenario still selected without memory");
}

// ── 11. Rules select different scenarios by task ───────────────────────────────
console.log("\n── selectTownLifeScenario rule coverage ──");
{
  // Force repair task on 2+ residents → repair_moment
  const repairState = createInitialState();
  repairState.residents[0].assignmentId = "repair";
  repairState.residents[1].assignmentId = "repair";
  const s1 = selectTownLifeScenario(repairState);
  assert(s1.id === "repair_moment", "repair×2 → repair_moment");

  // Force plant + forage + cook → garden_day or market_errand
  const gardenState = createInitialState();
  gardenState.residents[0].assignmentId = "plant";
  gardenState.residents[1].assignmentId = "forage";
  gardenState.residents[2].assignmentId = "cook";
  const s2 = selectTownLifeScenario(gardenState);
  assert(["garden_day", "market_errand"].includes(s2.id), "plant+forage+cook → garden_day or market_errand");

  // Low mood on 3+ residents → resident_mood (override task rules since mood priority is highest non-memory rule)
  const moodState = createInitialState();
  moodState.residents[0].mood = 30;
  moodState.residents[1].mood = 25;
  moodState.residents[2].mood = 28;
  // Assign all repair to trigger repair_moment BEFORE the lowMoodCount rule fires
  moodState.residents[0].assignmentId = "repair";
  moodState.residents[1].assignmentId = "repair";
  moodState.residents[2].assignmentId = "repair";
  const s3 = selectTownLifeScenario(moodState);
  assert(s3.id === "resident_mood", "low mood×3 → resident_mood");
}

// ── 12. UI renders active scenario ─────────────────────────────────────────────
console.log("\n── UI: active scenario rendered ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, { activeScenario: selectTownLifeScenario(state) });
  assert(root.innerHTML.includes("atmosphere-scenario"), "atmosphere-scenario element present");
  assert(root.innerHTML.includes("今日场景"), "今日场景 label rendered");
}

// ── 13. Resident task labels reference scenario ────────────────────────────────
console.log("\n── UI: task labels enhanced with scenario ──");
{
  const state = createInitialState();
  const scenario = TOWN_LIFE_SCENARIOS.garden_day;
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    activeScenario: scenario,
    activeTaskAnimations: [],
  });
  assert(root.innerHTML.includes("花园日"), "scenario label appears in task context");
}

// ── 14. TTS generate button still exists ───────────────────────────────────────
console.log("\n── TTS generate button exists ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    latestBroadcast: { id: "bc1", script: "测试", title: "测试", mood: "warm", placeId: "plaza" },
    broadcastAudio: { status: "idle" },
    activeScenario: selectTownLifeScenario(state),
  });
  assert(root.innerHTML.includes('data-action="generate-tts"'), "generate-tts button present");
}

// ── 15. TTS play button exists ────────────────────────────────────────────────
console.log("\n── TTS play button exists ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    latestBroadcast: { id: "bc1", script: "测试", title: "测试", mood: "warm", placeId: "plaza" },
    broadcastAudio: { status: "ready", audioUrl: "/mock.mp3" },
    activeScenario: selectTownLifeScenario(state),
  });
  assert(root.innerHTML.includes('data-action="play-tts"'), "play-tts button present when audio ready");
}

// ── 16. Playing state has clickable pause button ───────────────────────────────
console.log("\n── Playing: clickable pause button ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    latestBroadcast: { id: "bc1", script: "测试", title: "测试", mood: "warm", placeId: "plaza" },
    broadcastAudio: { status: "playing", audioUrl: "/mock.mp3" },
    activeScenario: selectTownLifeScenario(state),
  });
  // Must have a clickable pause entry
  const hasClickablePause = root.innerHTML.includes("暂停") && root.innerHTML.includes("button");
  assert(hasClickablePause, "pause button visible in playing state");
}

// ── 17. Loading state prevents double generation ───────────────────────────────
console.log("\n── Loading: TTS button disabled ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    latestBroadcast: { id: "bc1", script: "测试", title: "测试", mood: "warm", placeId: "plaza" },
    broadcastAudio: { status: "loading" },
    activeScenario: selectTownLifeScenario(state),
  });
  const btnMatch = root.innerHTML.match(/<button[^>]*data-action="generate-tts"[^>]*>/);
  assert(btnMatch !== null && btnMatch[0].includes("disabled"), "TTS button disabled during loading");
}

// ── 18. activeTaskAnimations not affected ───────────────────────────────────
console.log("\n── activeTaskAnimations preserved ──");
{
  const state = createInitialState();
  const anim = {
    residentId: state.residents[0].id, taskId: "plant", fromPlaceId: "garden", toPlaceId: "garden",
    placeId: "garden", action: "work", effect: "bloom", bubble: "花园更有精神了",
    gait: "walk", traveling: false,
    presentationClass: "is-farming", prop: "⛏️", propClass: "prop--tool",
    placeEffect: "soil-bloom", motion: "work-loop",
  };
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    activeTaskAnimations: [anim],
    activeScenario: selectTownLifeScenario(state),
    latestBroadcast: null,
  });
  assert(root.innerHTML.includes("stage-character__action-bubble"), "action bubble preserved");
  assert(root.innerHTML.includes("is-farming") || root.innerHTML.includes("stage-character--work"), "animation class preserved");
}

// ── 19. completionFeedback preserved ─────────────────────────────────────────
console.log("\n── completionFeedback preserved ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    completionFeedback: {
      id: "cf1", message: "本阶段完成", startedAt: Date.now(),
      residentResults: [{ residentId: state.residents[0].id, icon: "🌸", label: "完成花园" }],
    },
    activeScenario: selectTownLifeScenario(state),
    latestBroadcast: null,
  });
  assert(root.innerHTML.includes("completion-banner") || root.innerHTML.includes("本阶段完成"), "completion banner preserved");
}

// ── 20. TASK_STAGE_PRESENTATIONS not affected ────────────────────────────────
console.log("\n── TASK_STAGE_PRESENTATIONS preserved ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("TASK_STAGE_PRESENTATIONS"), "TASK_STAGE_PRESENTATIONS still in app.js");
}

// ── 21. music_generation not modified ────────────────────────────────────────
console.log("\n── music_generation not modified ──");
{
  const fs = await import("fs");
  const ttsContent = fs.readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(!ttsContent.includes("music_generation"), "music_generation not in minimaxTts.js");
  const clientContent = fs.readFileSync("./src/services/minimaxClient.js", "utf8");
  assert(!clientContent.includes("music_generation"), "music_generation not in minimaxClient.js");
}

// ── 22. MiniMax speech-t2a-http not modified ────────────────────────────────
console.log("\n── MiniMax speech-t2a-http not modified ──");
{
  const fs = await import("fs");
  const ttsContent = fs.readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(ttsContent.includes("speech-2.8-hd"), "speech-2.8-hd model still in minimaxTts.js");
}

// ── 23. Game values not modified ─────────────────────────────────────────────
console.log("\n── Game values not modified ──");
{
  const fs = await import("fs");
  const simContent = fs.readFileSync("./src/domain/simulation.js", "utf8");
  // Check that mood/energy are still referenced (not removed)
  assert(simContent.includes("mood") && simContent.includes("energy"), "mood and energy still in simulation.js");
}

// ── 24. No new frameworks ────────────────────────────────────────────────────
console.log("\n── No new frameworks introduced ──");
{
  const fs = await import("fs");
  const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const forbidden = ["phaser", "pixi", "pixi.js", "pixi-legacy", "matter-js", "playwright", "puppeteer", "react", "vue", "svelte", "angular", "solid-js", "lit", "howler", "tone.js"];
  const found = forbidden.filter((k) => deps[k]);
  assert(found.length === 0, `no forbidden frameworks (found: ${found.join(", ") || "none"})`);
}

// ── 25. No API keys committed ──────────────────────────────────────────────────
console.log("\n── No API keys committed ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  const clientContent = fs.readFileSync("./src/services/minimaxClient.js", "utf8");
  const hasKey = /sk-[a-zA-Z0-9]{20,}/.test(appContent + clientContent);
  assert(!hasKey, "no sk- API keys in app.js or minimaxClient.js");
}

// ── 26. activeScenario in uiState ───────────────────────────────────────────
console.log("\n── activeScenario in uiState ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("activeScenario:"), "activeScenario in uiState");
  assert(appContent.includes("selectTownLifeScenario"), "selectTownLifeScenario called for activeScenario");
}

// ── Results ───────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll AI director checks passed!");
