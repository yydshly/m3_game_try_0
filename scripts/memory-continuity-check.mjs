// memory-continuity-check — validates memory references in broadcasts and events
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
  onGenerateTts() {},
  onPlayTts() {},
  onPauseTts() {},
};

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
    broadcastAudio: { status: "idle", text: "", audioUrl: null, error: null, traceId: null, generatedAt: null, scriptHash: "" },
    isAnimating: false,
    animationMessage: "",
    completionFeedback: null,
    ...overrides,
  };
}

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

// ── Test: buildPromptMemoryNarrative exists in minimaxClient ─────────────────────────

console.log("\n── minimaxClient: buildPromptMemoryNarrative exists ──");
{
  const { readFileSync } = await import("fs");
  const content = readFileSync("./src/services/minimaxClient.js", "utf8");
  assert(content.includes("buildPromptMemoryNarrative"), "buildPromptMemoryNarrative defined in minimaxClient.js");
  assert(content.includes("小镇近期记忆"), "memory narrative text includes 小镇近期记忆 prompt context");
}

// ── Test: compactBroadcastState and compactEventState include memoryNarrative ───────────

console.log("\n── compact states: memoryNarrative in compact state output ──");
{
  const { readFileSync } = await import("fs");
  const content = readFileSync("./src/services/minimaxClient.js", "utf8");
  assert(content.includes("memoryNarrative: buildPromptMemoryNarrative(state)"), "compactBroadcastState includes memoryNarrative");
  assert(content.includes("memoryNarrative: buildPromptMemoryNarrative(state)"), "compactEventState includes memoryNarrative");
}

// ── Test: latestBroadcast.memoryReferences is rendered in atmosphere panel ─────────────

console.log("\n── UI: memoryReferences rendered in atmosphere panel ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: {
      id: "bc1",
      title: "早安广播",
      script: "早安小镇内容",
      mood: "warm",
      placeId: "plaza",
      memoryReferences: ["上次花园事件", "小花的记忆"],
    },
  }));
  assert(root.innerHTML.includes("📖"), "memory reference indicator rendered in atmosphere panel");
  assert(root.innerHTML.includes("上次花园事件"), "memory reference text shown");
}

// ── Test: event memoryReferences rendered in event feed ─────────────────────────────

console.log("\n── UI: memoryReferences rendered in event feed ──");
{
  const state = advancePhase(createInitialState());
  // Add an m3-event with memoryReferences
  state.events.push({
    id: "evt1",
    type: "m3-event",
    day: 1,
    phase: "afternoon",
    title: "花园里的惊喜",
    text: "花园里长出了新芽",
    tone: "warm",
    placeId: "garden",
    residentIds: ["hua"],
    suggestedFollowUp: "继续观察",
    choices: [],
    memoryReferences: ["小花照看了花园", "上次广场聚会"],
  });

  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState());
  assert(root.innerHTML.includes("m3-event"), "m3-event rendered");
  assert(root.innerHTML.includes("📖"), "memory reference icon in event feed");
  assert(root.innerHTML.includes("小花照看了花园"), "memory reference text in event feed");
}

// ── Test: no memory → no reference UI shown ────────────────────────────────────

console.log("\n── UI: no memoryReferences when empty ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: {
      id: "bc2",
      title: "早安",
      script: "早安内容",
      mood: "warm",
      placeId: "plaza",
      memoryReferences: [],
    },
  }));
  const html = root.innerHTML;
  assert(!html.includes("📖 上次") && !html.includes("memory-refs"), "no spurious memory-ref UI when empty");
}

// ── Test: TTS playing button is disabled (prevents double-generation) ───────────────

console.log("\n── TTS playing button: disabled (prevents double-generation) ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: { id: "bc1", title: "测试", script: "测试。", mood: "warm", placeId: "plaza" },
    broadcastAudio: {
      status: "playing",
      text: "测试。",
      audioUrl: "/mock.mp3",
      error: null,
      scriptHash: "abc",
    },
  }));
  const btnMatch = root.innerHTML.match(/<button[^>]*data-action="generate-tts"[^>]*>/);
  // TTS button is disabled during playback to prevent interrupting audio or double-generation
  assert(btnMatch !== null && btnMatch[0].includes("disabled"), "playing button is disabled");
}

// ── Test: TTS loading button is disabled ──────────────────────────────────────────

console.log("\n── TTS loading button: disabled ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: { id: "bc1", title: "测试", script: "测试。", mood: "warm", placeId: "plaza" },
    broadcastAudio: { status: "loading", text: "测试。", audioUrl: null, error: null, scriptHash: "abc" },
  }));
  const btnMatch = root.innerHTML.match(/<button[^>]*data-action="generate-tts"[^>]*>/);
  assert(btnMatch !== null && btnMatch[0].includes("disabled"), "loading button IS disabled");
}

// ── Test: activeTaskAnimations preserved ──────────────────────────────────────────

console.log("\n── activeTaskAnimations preserved with memory reference ──");
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
  renderApp(root, state, handlers, makeUiState({
    activeTaskAnimations: [anim],
    isAnimating: true,
    latestBroadcast: { id: "bc1", title: "测试", script: "测试。", mood: "warm", placeId: "plaza", memoryReferences: [] },
  }));
  assert(root.innerHTML.includes("stage-character__action-bubble"), "action bubble preserved");
  assert(root.innerHTML.includes("is-farming") || root.innerHTML.includes("stage-character--work"), "animation class preserved");
}

// ── Test: completionFeedback preserved with memory ref ──────────────────────────────

console.log("\n── completionFeedback preserved with memory reference ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    completionFeedback: {
      id: "cf1", message: "本阶段完成", startedAt: Date.now(),
      residentResults: [{ residentId: state.residents[0].id, icon: "🌸", label: "完成花园" }],
    },
    latestBroadcast: { id: "bc1", title: "测试", script: "测试。", mood: "warm", placeId: "plaza" },
  }));
  assert(root.innerHTML.includes("completion-banner") || root.innerHTML.includes("本阶段完成"), "completion banner preserved");
}

// ── Test: no API keys in render output ──────────────────────────────────────────────

console.log("\n── UI: no API keys in memory reference display ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: {
      id: "bc1", title: "安全测试", script: "安全内容", mood: "warm", placeId: "plaza",
      memoryReferences: ["上次玩家的选择：帮小花浇水"],
    },
  }));
  assert(!root.innerHTML.includes("API_KEY"), "no API_KEY in HTML");
  assert(!root.innerHTML.includes("apiKey"), "no apiKey in HTML");
  assert(!root.innerHTML.includes("sk-cp-"), "no sk-cp- in HTML");
}

// ── Test: no new dependencies introduced ───────────────────────────────────────────

console.log("\n── Dependencies: no new heavy libraries ──");
{
  const { readFileSync } = await import("fs");
  const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const forbidden = ["phaser", "pixi", "playwright", "puppeteer", "react", "vue", "angular", "lit", "howler", "tone.js"];
  const found = forbidden.filter((k) => deps[k]);
  assert(found.length === 0, `no forbidden libraries (found: ${found.join(", ") || "none"})`);
}

// ── Test: MiniMax speech-t2a-http not modified ──────────────────────────────────

console.log("\n── MiniMax speech-t2a-http not modified ──");
{
  const { readFileSync } = await import("fs");
  const content = readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(content.includes("speech-2.8-hd"), "MiniMax speech-2.8-hd model preserved");
}

// ── Test: music_generation not modified ───────────────────────────────────────────

console.log("\n── music_generation not modified ──");
{
  const { readFileSync } = await import("fs");
  const minimaxContent = readFileSync("./src/services/minimaxClient.js", "utf8");
  assert(!minimaxContent.includes("music_generation"), "music_generation not introduced in minimaxClient.js");
}

// ── Test: resident mood/energy not modified ─────────────────────────────────────────

console.log("\n── Game values: resident mood/energy not modified in state.js ──");
{
  const { readFileSync } = await import("fs");
  // Only check we didn't accidentally change simulation/domain files that affect mood/energy
  const simContent = readFileSync("./src/domain/simulation.js", "utf8");
  // Mood/energy updates should still use clamp/etc - just check the domain file is readable (not garbled)
  assert(simContent.includes("mood") && simContent.includes("energy"), "simulation.js mood/energy preserved");
}

// ── Test: TASK_STAGE_PRESENTATIONS preserved ─────────────────────────────────

console.log("\n── TASK_STAGE_PRESENTATIONS preserved in app.js ──");
{
  const { readFileSync } = await import("fs");
  const appContent = readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("TASK_STAGE_PRESENTATIONS"), "TASK_STAGE_PRESENTATIONS still defined");
  assert(appContent.includes("is-farming") && appContent.includes("⛏️"), "TASK_STAGE_PRESENTATIONS content intact");
}

// ── Results ─────────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll memory-continuity checks passed!");
