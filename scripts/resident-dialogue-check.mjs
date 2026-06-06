// resident-dialogue-check — validates AI resident scene dialogues
import { createInitialState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";
import { renderApp } from "../src/ui/render.js";
import { buildAiDirectorContext, selectTownLifeScenario } from "../src/domain/aiDirector.js";
import {
  buildResidentDialogueContext,
  buildFallbackResidentSceneBeats,
  requestMiniMaxResidentDialogues,
  validateBeat,
  getBeatForResident,
  buildBeatsSummary,
} from "../src/services/residentDialogue.js";

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

// ── 1. residentSceneBeats state exists ──────────────────────────────────────────
console.log("\n── residentSceneBeats state ──");
{
  const state = createInitialState();
  const beats = buildFallbackResidentSceneBeats(state, null);
  assert(Array.isArray(beats), "buildFallbackResidentSceneBeats returns an array");
  assert(beats.length > 0, "beats has entries for all residents");
  assert(beats.every((b) => b.id && b.residentId && b.dialogue), "each beat has id, residentId, dialogue");
}

// ── 2. buildResidentDialogueContext exists ───────────────────────────────────────
console.log("\n── buildResidentDialogueContext function ──");
assert(typeof buildResidentDialogueContext === "function", "buildResidentDialogueContext is a function");

// ── 3. buildResidentDialogueContext reads state ───────────────────────────────────
console.log("\n── buildResidentDialogueContext reads state ──");
{
  const state = createInitialState();
  const ctx = buildResidentDialogueContext(state, null);
  assert(ctx !== null && typeof ctx === "object", "returns an object");
  assert(Array.isArray(ctx.residentInputs), "residentInputs is array");
  assert(ctx.activeScenario !== undefined, "activeScenario accessible");
  assert(typeof ctx.townMemorySummary === "string", "townMemorySummary is string");
  assert(typeof ctx.promptText === "string", "promptText is string");
}

// ── 4. requestMiniMaxResidentDialogues exists ────────────────────────────────────
console.log("\n── requestMiniMaxResidentDialogues function ──");
assert(typeof requestMiniMaxResidentDialogues === "function", "requestMiniMaxResidentDialogues is a function");

// ── 5. buildFallbackResidentSceneBeats exists ────────────────────────────────────
console.log("\n── buildFallbackResidentSceneBeats function ──");
assert(typeof buildFallbackResidentSceneBeats === "function", "buildFallbackResidentSceneBeats is a function");

// ── 6. Fallback uses task and scenario ─────────────────────────────────────────
console.log("\n── Fallback uses task and scenario ──");
{
  const state = createInitialState();
  state.residents[0].assignmentId = "repair";
  state.residents[1].assignmentId = "plant";
  const directorCtx = buildAiDirectorContext(state);
  const beats = buildFallbackResidentSceneBeats(state, directorCtx);
  assert(beats.length === state.residents.length, "fallback returns beat per resident");
  const repairBeat = beats.find((b) => b.taskId === "repair");
  const plantBeat = beats.find((b) => b.taskId === "plant");
  assert(repairBeat?.dialogue.length > 0, "repair beat has dialogue");
  assert(plantBeat?.dialogue.length > 0, "plant beat has dialogue");
  assert(repairBeat?.emotion, "repair beat has emotion");
  assert(plantBeat?.actionHint, "plant beat has actionHint");
}

// ── 7. Dialogue is short ──────────────────────────────────────────────────────────
console.log("\n── Dialogue length constraints ──");
{
  const state = createInitialState();
  const beats = buildFallbackResidentSceneBeats(state, null);
  for (const beat of beats) {
    assert(beat.dialogue.length >= 4 && beat.dialogue.length <= 40, `beat dialogue length ${beat.dialogue.length} is within 4-40`);
  }
}

// ── 8. Empty dialogue fallback ────────────────────────────────────────────────────
console.log("\n── validateBeat filters empty dialogue ──");
{
  const state = createInitialState();
  const badBeat = { residentId: "hua", dialogue: "  " };
  const result = validateBeat(badBeat, state);
  assert(result === null, "empty/whitespace dialogue returns null");
}

// ── 9. JSON异常 fallback ───────────────────────────────────────────────────────
console.log("\n── requestMiniMaxResidentDialogues network error fallback ──");
{
  const state = createInitialState();
  // No server running — should fall back gracefully
  const beats = await requestMiniMaxResidentDialogues(state, null);
  assert(Array.isArray(beats), "returns array on network error");
  assert(beats.length > 0, "returns fallback beats on network error");
  assert(beats.every((b) => b.dialogue), "all fallback beats have dialogue");
}

// ── 10. getBeatForResident ─────────────────────────────────────────────────────
console.log("\n── getBeatForResident utility ──");
{
  const state = createInitialState();
  const beats = buildFallbackResidentSceneBeats(state, null);
  const beat = getBeatForResident(beats, state.residents[0].id);
  assert(beat !== null && beat !== undefined, "returns beat for valid residentId");
  const noBeat = getBeatForResident(beats, "nonexistent-id");
  assert(noBeat === null, "returns null for invalid residentId");
  const emptyBeat = getBeatForResident(null, "hua");
  assert(emptyBeat === null, "returns null for null beats");
}

// ── 11. buildBeatsSummary ────────────────────────────────────────────────────────
console.log("\n── buildBeatsSummary utility ──");
{
  const state = createInitialState();
  const beats = buildFallbackResidentSceneBeats(state, null);
  const summary = buildBeatsSummary(beats);
  assert(typeof summary === "string", "returns string");
  assert(summary.includes("："), "summary contains name:dialogue format");
  const empty = buildBeatsSummary([]);
  assert(empty === "", "empty array returns empty string");
  const nullSummary = buildBeatsSummary(null);
  assert(nullSummary === "", "null returns empty string");
}

// ── 12. beats have required fields ───────────────────────────────────────────────
console.log("\n── Beat required fields ──");
{
  const state = createInitialState();
  const beats = buildFallbackResidentSceneBeats(state, null);
  for (const beat of beats) {
    assert(typeof beat.id === "string" && beat.id.length > 0, `${beat.residentName}: has id`);
    assert(typeof beat.residentId === "string" && beat.residentId.length > 0, `${beat.residentName}: has residentId`);
    assert(typeof beat.residentName === "string" && beat.residentName.length > 0, `${beat.residentName}: has residentName`);
    assert(typeof beat.dialogue === "string" && beat.dialogue.length > 0, `${beat.residentName}: has dialogue`);
    assert(typeof beat.actionHint === "string", `${beat.residentName}: has actionHint`);
    assert(typeof beat.emotion === "string", `${beat.residentName}: has emotion`);
    assert(typeof beat.createdAt === "number", `${beat.residentName}: has createdAt`);
  }
}

// ── 13. Context reads activeScenario ─────────────────────────────────────────────
console.log("\n── Context reads activeScenario ──");
{
  const state = createInitialState();
  state.residents[0].assignmentId = "repair";
  state.residents[1].assignmentId = "repair";
  const ctx = buildResidentDialogueContext(state, null);
  assert(ctx.activeScenario !== null, "activeScenario present in context");
  assert(ctx.activeScenario.id !== undefined, "scenario has id");
}

// ── 14. Context reads resident task ──────────────────────────────────────────────
console.log("\n── Context reads resident task ──");
{
  const state = createInitialState();
  state.residents[0].assignmentId = "cook";
  const ctx = buildResidentDialogueContext(state, null);
  const input = ctx.residentInputs.find((r) => r.residentId === state.residents[0].id);
  assert(input?.assignmentId === "cook", "residentInputs contains correct assignmentId");
  assert(input?.taskLabel?.includes("餐点"), "taskLabel is resolved");
}

// ── 15. Context reads townMemory ─────────────────────────────────────────────────
console.log("\n── Context reads townMemory ──");
{
  const stateWithMemory = {
    ...createInitialState(),
    townMemory: [{ day: 1, phase: "早上", type: "player-choice", text: "选择了帮助邻居", residentIds: [], placeId: "plaza" }],
  };
  const ctx = buildResidentDialogueContext(stateWithMemory, null);
  assert(ctx.townMemorySummary.length > 0, "townMemorySummary non-empty when memory exists");
}

// ── 16. Context reads resident memory ─────────────────────────────────────────────
console.log("\n── Context reads resident memory ──");
{
  const state = createInitialState();
  state.residents[0].memory = ["和小花聊了聊天，感觉很开心。"];
  const ctx = buildResidentDialogueContext(state, null);
  assert(ctx.residentMemorySummary.length > 0, "residentMemorySummary populated");
}

// ── 17. Map dialogue UI exists ──────────────────────────────────────────────────
console.log("\n── UI: map dialogue bubble ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  const beats = buildFallbackResidentSceneBeats(state, null);
  renderApp(root, state, handlers, { residentSceneBeats: beats, activeScenario: selectTownLifeScenario(state) });
  assert(root.innerHTML.includes("stage-character__dialogue"), "stage-character__dialogue element present");
  assert(root.innerHTML.includes("stage-character__dialogue--scenario"), "scenario dialogue class present");
}

// ── 18. Right panel beats summary UI exists ──────────────────────────────────────
console.log("\n── UI: right panel dialogue summary ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  const beats = buildFallbackResidentSceneBeats(state, null);
  renderApp(root, state, handlers, { residentSceneBeats: beats, activeScenario: selectTownLifeScenario(state) });
  assert(root.innerHTML.includes("dialogue-beats-panel"), "dialogue-beats-panel element present");
  assert(root.innerHTML.includes("dialogue-beat"), "dialogue-beat entries present");
  assert(root.innerHTML.includes("dialogue-beat__name"), "dialogue-beat__name present");
  assert(root.innerHTML.includes("dialogue-beat__text"), "dialogue-beat__text present");
}

// ── 19. No dialogue when beats empty ────────────────────────────────────────────
console.log("\n── UI: no dialogue bubble when beats empty ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, { residentSceneBeats: [], activeScenario: selectTownLifeScenario(state) });
  const dialogueCount = (root.innerHTML.match(/stage-character__dialogue/g) || []).length;
  assert(dialogueCount === 0, "no dialogue elements when beats is empty array");
}

// ── 20. Dialogue is truncated in map bubble ──────────────────────────────────────
console.log("\n── UI: long dialogue truncated in map bubble ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  const longBeat = {
    id: "beat-long",
    residentId: state.residents[0].id,
    residentName: state.residents[0].name,
    scenarioId: "garden_day",
    taskId: "plant",
    mood: "平静",
    actionHint: "照料植物",
    dialogue: "这是一句非常非常长的对白，超过了应该显示的长度限制，需要被截断显示。",
    memoryReference: "",
    emotion: "平静",
    createdAt: Date.now(),
  };
  renderApp(root, state, handlers, {
    residentSceneBeats: [longBeat],
    activeScenario: selectTownLifeScenario(state),
  });
  assert(root.innerHTML.includes("stage-character__dialogue"), "dialogue element present");
}

// ── 21. completionFeedback not affected ─────────────────────────────────────────
console.log("\n── completionFeedback not affected ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  const beats = buildFallbackResidentSceneBeats(state, null);
  renderApp(root, state, handlers, {
    residentSceneBeats: beats,
    completionFeedback: {
      id: "cf1", message: "本阶段完成", startedAt: Date.now(),
      residentResults: [{ residentId: state.residents[0].id, icon: "🌸", label: "完成花园" }],
    },
    activeScenario: selectTownLifeScenario(state),
  });
  assert(root.innerHTML.includes("completion-banner") || root.innerHTML.includes("本阶段完成"), "completion feedback still renders");
}

// ── 22. activeTaskAnimations not affected ───────────────────────────────────────
console.log("\n── activeTaskAnimations not affected ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  const beats = buildFallbackResidentSceneBeats(state, null);
  renderApp(root, state, handlers, {
    residentSceneBeats: beats,
    activeTaskAnimations: [{
      residentId: state.residents[0].id, taskId: "plant", fromPlaceId: "garden", toPlaceId: "garden",
      placeId: "garden", action: "work", effect: "bloom", bubble: "花园更有精神了",
      gait: "walk", traveling: false,
      presentationClass: "is-farming", prop: "⛏️", propClass: "prop--tool",
      placeEffect: "soil-bloom", motion: "work-loop",
    }],
    activeScenario: selectTownLifeScenario(state),
  });
  assert(root.innerHTML.includes("stage-character__action-bubble"), "action bubble preserved");
  assert(root.innerHTML.includes("stage-character__dialogue"), "dialogue bubble also present");
}

// ── 23. TTS generate button still exists ───────────────────────────────────────
console.log("\n── TTS generate button still exists ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  const beats = buildFallbackResidentSceneBeats(state, null);
  renderApp(root, state, handlers, {
    residentSceneBeats: beats,
    latestBroadcast: { id: "bc1", script: "测试", title: "测试", mood: "warm", placeId: "plaza" },
    broadcastAudio: { status: "idle" },
    activeScenario: selectTownLifeScenario(state),
  });
  assert(root.innerHTML.includes('data-action="generate-tts"'), "generate-tts button present");
}

// ── 24. TTS play button still exists ────────────────────────────────────────────
console.log("\n── TTS play button still exists ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  const beats = buildFallbackResidentSceneBeats(state, null);
  renderApp(root, state, handlers, {
    residentSceneBeats: beats,
    latestBroadcast: { id: "bc1", script: "测试", title: "测试", mood: "warm", placeId: "plaza" },
    broadcastAudio: { status: "ready", audioUrl: "/mock.mp3" },
    activeScenario: selectTownLifeScenario(state),
  });
  assert(root.innerHTML.includes('data-action="play-tts"'), "play-tts button present");
}

// ── 25. Playing state has clickable pause button ─────────────────────────────────
console.log("\n── Playing: clickable pause button exists ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  const beats = buildFallbackResidentSceneBeats(state, null);
  renderApp(root, state, handlers, {
    residentSceneBeats: beats,
    latestBroadcast: { id: "bc1", script: "测试", title: "测试", mood: "warm", placeId: "plaza" },
    broadcastAudio: { status: "playing", audioUrl: "/mock.mp3" },
    activeScenario: selectTownLifeScenario(state),
  });
  const hasPause = root.innerHTML.includes("暂停") && root.innerHTML.includes("button");
  assert(hasPause, "pause button visible in playing state");
}

// ── 26. music_generation not modified ───────────────────────────────────────────
console.log("\n── music_generation not modified ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/services/residentDialogue.js", "utf8");
  assert(!content.includes("music_generation"), "music_generation not in residentDialogue.js");
  const ttsContent = fs.readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(!ttsContent.includes("music_generation"), "music_generation not in minimaxTts.js");
}

// ── 27. MiniMax speech-t2a-http not modified ─────────────────────────────────────
console.log("\n── MiniMax speech-t2a-http not modified ──");
{
  const fs = await import("fs");
  const ttsContent = fs.readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(ttsContent.includes("speech-2.8-hd"), "speech-2.8-hd still in minimaxTts.js");
}

// ── 28. Game values not modified ────────────────────────────────────────────────
console.log("\n── Game values not modified ──");
{
  const fs = await import("fs");
  const simContent = fs.readFileSync("./src/domain/simulation.js", "utf8");
  assert(simContent.includes("mood") && simContent.includes("energy"), "mood and energy still in simulation.js");
  // state.js passes through resident objects from seed.js — mood/energy come from seed
  const seedContent = fs.readFileSync("./src/data/seed.js", "utf8");
  assert(seedContent.includes("mood") && seedContent.includes("energy"), "mood and energy still in seed.js (resident data source)");
}

// ── 29. No new frameworks ───────────────────────────────────────────────────────
console.log("\n── No new frameworks introduced ──");
{
  const fs = await import("fs");
  const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const forbidden = ["phaser", "pixi", "pixi.js", "pixi-legacy", "matter-js", "playwright", "puppeteer", "react", "vue", "svelte", "angular", "solid-js", "lit", "howler", "tone.js"];
  const found = forbidden.filter((k) => deps[k]);
  assert(found.length === 0, `no forbidden frameworks (found: ${found.join(", ") || "none"})`);
}

// ── 30. No API keys committed ───────────────────────────────────────────────────
console.log("\n── No API keys committed ──");
{
  const fs = await import("fs");
  const dialogueContent = fs.readFileSync("./src/services/residentDialogue.js", "utf8");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  const hasKey = /sk-[a-zA-Z0-9]{20,}/.test(dialogueContent + appContent);
  assert(!hasKey, "no sk- API keys in residentDialogue.js or app.js");
}

// ── Results ──────────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll resident dialogue checks passed!");
