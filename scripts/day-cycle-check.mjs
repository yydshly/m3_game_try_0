// day-cycle-check — validates the AI town day cycle orchestration
import { createInitialState, upgradeState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";
import { applyChoiceMemory } from "../src/domain/memory.js";
import { buildAiDirectorContext, selectTownLifeScenario } from "../src/domain/aiDirector.js";
import { buildFallbackResidentSceneBeats } from "../src/services/residentDialogue.js";
import { renderApp } from "../src/ui/render.js";

const DAY_CYCLE_DEFAULT = {
  status: "idle",
  step: "",
  scenarioId: "",
  error: "",
  startedAt: 0,
  completedAt: 0,
};

const root = {
  innerHTML: "",
  querySelector: () => ({ addEventListener() {} }),
  querySelectorAll: () => [],
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

// ── 1. dayCycle state structure ──────────────────────────────────────────────
console.log("\n── dayCycle state structure ──");
{
  const state = createInitialState();
  const dc = DAY_CYCLE_DEFAULT;
  assert(typeof dc.status !== "undefined", "dayCycle has status field");
  assert(["idle", "running", "waiting_choice", "completed", "error"].includes(dc.status), "status has valid values");
  assert(typeof dc.step === "string", "dayCycle has step field");
  assert(typeof dc.scenarioId === "string", "dayCycle has scenarioId field");
  assert(typeof dc.error === "string", "dayCycle has error field");
  assert(typeof dc.startedAt === "number", "dayCycle has startedAt field");
  assert(typeof dc.completedAt === "number", "dayCycle has completedAt field");
}

// ── 2. runTownDayCycle function exists in app.js ─────────────────────────────
console.log("\n── runTownDayCycle function exists ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("async function runTownDayCycle()"), "runTownDayCycle is an async function");
  assert(appContent.includes("completeDayCycle"), "completeDayCycle function exists");
  assert(appContent.includes("DAY_CYCLE_DEFAULT"), "DAY_CYCLE_DEFAULT constant exists");
}

// ── 3. dayCycle in uiState ───────────────────────────────────────────────────
console.log("\n── dayCycle in uiState ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("dayCycle: { ...DAY_CYCLE_DEFAULT }"), "dayCycle initialized in uiState");
  assert(appContent.includes("dayCycle.status === \"running\""), "running guard check exists");
  assert(appContent.includes("waiting_choice"), "waiting_choice status exists");
}

// ── 4. dayCycle reset on new-town ────────────────────────────────────────────
console.log("\n── dayCycle reset on new-town ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("dayCycle: { ...DAY_CYCLE_DEFAULT }"), "dayCycle reset in onNewTown");
}

// ── 5. onRunTownDayCycle handler wired ──────────────────────────────────────
console.log("\n── onRunTownDayCycle handler ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("onRunTownDayCycle:"), "onRunTownDayCycle handler defined");
  assert(appContent.includes("runTownDayCycle();"), "onRunTownDayCycle calls runTownDayCycle");
}

// ── 6. completeDayCycle called from onChooseEvent ────────────────────────────
console.log("\n── completeDayCycle from onChooseEvent ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("completeDayCycle(nextState)"), "onChooseEvent calls completeDayCycle");
}

// ── 7. Day cycle button in render ────────────────────────────────────────────
console.log("\n── Day cycle button in render ──");
{
  const fs = await import("fs");
  const renderContent = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(renderContent.includes("data-action=\"run-town-day-cycle\""), "day-cycle button rendered");
  assert(renderContent.includes("dayCycle:"), "dayCycle in safeUiState");
  assert(renderContent.includes("renderDayCycleStatus"), "renderDayCycleStatus function exists");
  assert(renderContent.includes("day-cycle-status--running"), "running CSS class exists");
  assert(renderContent.includes("day-cycle-status--waiting"), "waiting CSS class exists");
}

// ── 8. Button disabled during running ───────────────────────────────────────
console.log("\n── Button disabled during running ──");
{
  const fs = await import("fs");
  const renderContent = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(renderContent.includes("dayCycleActive || isAnimating"), "button disabled when dayCycleActive or isAnimating");
}

// ── 9. Fallback: AI Director ────────────────────────────────────────────────
console.log("\n── AI Director fallback ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("catch (dirErr)"), "AI Director context has try/catch fallback");
  assert(appContent.includes("directorCtx = { activeScenario: scenario }"), "fallback sets default context");
}

// ── 10. Fallback: Resident dialogue ──────────────────────────────────────────
console.log("\n── Resident dialogue fallback ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("catch (diagErr)"), "Resident dialogue has try/catch fallback");
  assert(appContent.includes("dialogueBeats = beats"), "fallback uses buildFallbackResidentSceneBeats");
}

// ── 11. Fallback: Broadcast ─────────────────────────────────────────────────
console.log("\n── Broadcast fallback ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("catch (bcErr)"), "Broadcast has try/catch fallback");
  assert(appContent.includes("broadcastStatus: \"error\""), "fallback sets broadcastStatus error");
}

// ── 12. Fallback: Event ─────────────────────────────────────────────────────
console.log("\n── Event fallback ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("catch (evtErr)"), "Event has try/catch fallback");
  assert(appContent.includes("eventDirectorStatus: \"error\""), "fallback sets eventDirectorStatus error");
}

// ── 13. waiting_choice status after event generation ────────────────────────
console.log("\n── waiting_choice after event ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  const idx = appContent.indexOf("status: \"waiting_choice\"");
  assert(idx !== -1, "waiting_choice status is set after event generation");
}

// ── 14. Memory written after choice ────────────────────────────────────────
console.log("\n── Memory written after choice ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  const memoryContent = fs.readFileSync("./src/domain/memory.js", "utf8");
  assert(appContent.includes("applyChoiceMemory(state, sourceEvent, choice, currentPhase)"), "applyChoiceMemory called on choice");
  assert(memoryContent.includes("townMemory") && memoryContent.includes("createChoiceMemoryEntry"), "memory.js creates townMemory entry");
}

// ── 15. completeDayCycle updates dayCycle to completed ──────────────────────
console.log("\n── completeDayCycle sets completed ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("status: \"completed\""), "completeDayCycle sets status to completed");
  assert(appContent.includes("completedAt: Date.now()"), "completeDayCycle sets completedAt");
}

// ── 16. CSS for day-cycle-status ────────────────────────────────────────────
console.log("\n── CSS for day-cycle-status ──");
{
  const fs = await import("fs");
  const cssContent = fs.readFileSync("./src/styles.css", "utf8");
  assert(cssContent.includes(".day-cycle-status"), "day-cycle-status CSS class exists");
  assert(cssContent.includes(".day-cycle-status--running"), "running variant CSS exists");
  assert(cssContent.includes(".day-cycle-status--waiting"), "waiting variant CSS exists");
  assert(cssContent.includes("button--day-cycle"), "button--day-cycle CSS exists");
}

// ── 17. onRunTownDayCycle in handlers object ────────────────────────────────
console.log("\n── onRunTownDayCycle in handlers object ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("renderApp(root, state, {"), "renderApp called with handlers object");
  const handlerIdx = appContent.indexOf("onRunTownDayCycle:");
  assert(handlerIdx !== -1, "onRunTownDayCycle found in app.js");
}

// ── 18. dayCycle not persisted in state ────────────────────────────────────
console.log("\n── dayCycle not persisted in state ──");
{
  const fs = await import("fs");
  const stateContent = fs.readFileSync("./src/domain/state.js", "utf8");
  // dayCycle should NOT appear in state.js createInitialState or upgradeState
  assert(!stateContent.includes("dayCycle"), "dayCycle not in state schema");
}

// ── 19. TTS buttons still exist ─────────────────────────────────────────────
console.log("\n── TTS buttons still exist ──");
{
  const fs = await import("fs");
  const renderContent = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(renderContent.includes('data-action="generate-tts"'), "generate-tts button present");
  assert(renderContent.includes('data-action="play-tts"'), "play-tts button present");
}

// ── 20. Pause button during playback ────────────────────────────────────────
console.log("\n── Pause button during playback ──");
{
  const fs = await import("fs");
  const renderContent = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(renderContent.includes("暂停"), "pause button visible text exists");
  assert(renderContent.includes("playing"), "playing state handled in TTS");
}

// ── 21. activeTaskAnimations not affected ───────────────────────────────────
console.log("\n── activeTaskAnimations not affected ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("activeTaskAnimations"), "activeTaskAnimations still referenced");
  assert(appContent.includes("showTaskAnimations"), "showTaskAnimations still exists");
}

// ── 22. completionFeedback not affected ─────────────────────────────────────
console.log("\n── completionFeedback not affected ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("completionFeedback"), "completionFeedback still referenced");
  assert(appContent.includes("buildCompletionFeedback"), "buildCompletionFeedback still exists");
}

// ── 23. No music_generation in minimaxClient ────────────────────────────────
console.log("\n── music_generation not modified ──");
{
  const fs = await import("fs");
  const clientContent = fs.readFileSync("./src/services/minimaxClient.js", "utf8");
  assert(!clientContent.includes("music_generation"), "music_generation not added to minimaxClient");
}

// ── 24. MiniMax speech-t2a-http not modified ────────────────────────────────
console.log("\n── MiniMax speech-t2a-http not modified ──");
{
  const fs = await import("fs");
  const ttsContent = fs.readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(ttsContent.includes("speech-2.8-hd"), "speech-2.8-hd model still in minimaxTts.js");
}

// ── 25. Game values not modified ────────────────────────────────────────────
console.log("\n── Game values not modified ──");
{
  const fs = await import("fs");
  const simContent = fs.readFileSync("./src/domain/simulation.js", "utf8");
  assert(simContent.includes("mood") && simContent.includes("energy"), "mood and energy still in simulation.js");
}

// ── 26. No new frameworks ─────────────────────────────────────────────────
console.log("\n── No new frameworks introduced ──");
{
  const fs = await import("fs");
  const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const forbidden = ["phaser", "pixi", "pixi.js", "pixi-legacy", "matter-js", "playwright", "puppeteer", "react", "vue", "svelte", "angular", "solid-js", "lit", "howler", "tone.js"];
  const found = forbidden.filter((k) => deps[k]);
  assert(found.length === 0, `no forbidden frameworks (found: ${found.join(", ") || "none"})`);
}

// ── 27. No API keys committed ───────────────────────────────────────────────
console.log("\n── No API keys committed ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  const clientContent = fs.readFileSync("./src/services/minimaxClient.js", "utf8");
  const hasKey = /sk-[a-zA-Z0-9]{20,}/.test(appContent + clientContent);
  assert(!hasKey, "no sk- API keys in app.js or minimaxClient.js");
}

// ── 28. Flow steps in sequence ──────────────────────────────────────────────
console.log("\n── Day cycle flow steps in sequence ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  const steps = [
    "advancePhase",
    "selectTownLifeScenario",
    "buildFallbackResidentSceneBeats",
    "buildAiDirectorContext",
    "requestMiniMaxResidentDialogues",
    "requestMiniMaxBroadcast",
    "requestMiniMaxEvent",
    "waiting_choice",
  ];
  for (const step of steps) {
    assert(appContent.includes(step), `flow includes "${step}"`);
  }
}

// ── 29. bindEvents includes run-town-day-cycle ──────────────────────────────
console.log("\n── bindEvents includes run-town-day-cycle ──");
{
  const fs = await import("fs");
  const renderContent = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(renderContent.includes("data-action='run-town-day-cycle'") ||
         renderContent.includes('data-action="run-town-day-cycle"'),
         "bindEvents wires run-town-day-cycle");
}

// ── Results ───────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll day cycle checks passed!");
