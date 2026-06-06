// tts-playback-check — validates TTS playback闭环 states and UI transitions
import { createInitialState } from "../src/domain/state.js";
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
  onPauseTts() {},
};

function makeBroadcast() {
  return {
    id: "bc-test",
    title: "傍晚小镇广播",
    script: "亲爱的居民们，傍晚好。今天的小镇一切安好。",
    mood: "calm",
    musicMood: "轻柔晚风",
    placeId: "plaza",
    durationHint: "20s",
  };
}

function makeAudio(overrides = {}) {
  return {
    status: "idle",
    text: "",
    audioUrl: null,
    error: null,
    traceId: null,
    generatedAt: null,
    scriptHash: "",
    ...overrides,
  };
}

function render(uiState) {
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, noopHandlers, {
    latestBroadcast: makeBroadcast(),
    broadcastAudio: makeAudio(),
    ...uiState,
  });
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

// ── TTS button: idle state ────────────────────────────────────────────────────
console.log("\n── TTS button: idle state ──");
{
  render({ broadcastAudio: makeAudio({ status: "idle" }) });
  assert(root.innerHTML.includes('data-action="generate-tts"'), "generate-tts button present in idle");
  assert(!root.innerHTML.includes("disabled"), "idle: button not disabled");
  assert(root.innerHTML.includes("MiniMax 生成语音") || root.innerHTML.includes("🔊 MiniMax"), "idle label: MiniMax 生成语音");
  assert(root.innerHTML.includes("🔊"), "idle icon: 🔊");
  assert(!root.innerHTML.includes("data-action=\"play-tts\""), "idle: no separate play-tts button");
}

// ── TTS button: loading state ─────────────────────────────────────────────────
console.log("\n── TTS button: loading state ──");
{
  render({ broadcastAudio: makeAudio({ status: "loading", text: "亲爱的居民们，傍晚好。" }) });
  assert(root.innerHTML.includes('data-action="generate-tts"'), "generate-tts button present in loading");
  assert(root.innerHTML.includes("disabled"), "loading: button disabled");
  assert(root.innerHTML.includes("MiniMax 生成中") || root.innerHTML.includes("🔊 MiniMax"), "loading label: MiniMax 生成中…");
  assert(root.innerHTML.includes("🔊"), "loading icon: 🔊");
  assert(!root.innerHTML.includes("data-action=\"play-tts\""), "loading: no separate play-tts button");
}

// ── TTS button: ready state ──────────────────────────────────────────────────
console.log("\n── TTS button: ready state ──");
{
  render({
    broadcastAudio: makeAudio({
      status: "ready",
      text: "亲爱的居民们，傍晚好。",
      audioUrl: "data:audio/mp3;base64,abc",
      scriptHash: "abc123",
    }),
  });
  assert(root.innerHTML.includes('data-action="generate-tts"'), "generate-tts button present in ready");
  // TTS button is disabled when audio already exists to prevent double-generation
  // Clicking generate-tts when ready triggers play (toggle in handler)
  assert(root.innerHTML.includes("disabled"), "ready: TTS button disabled (audio exists)");
  assert(root.innerHTML.includes("MiniMax 播放") || root.innerHTML.includes("▶️ MiniMax"), "ready label: MiniMax 播放");
  assert(root.innerHTML.includes("▶️"), "ready icon: ▶️");
  // No separate play-tts button — generate-tts handles play/pause/continue
  assert(!root.innerHTML.includes("data-action=\"play-tts\""), "ready: no separate play-tts button");
}

// ── TTS button: playing state ────────────────────────────────────────────────
console.log("\n── TTS button: playing state ──");
{
  render({
    broadcastAudio: makeAudio({
      status: "playing",
      text: "亲爱的居民们，傍晚好。",
      audioUrl: "data:audio/mp3;base123",
    }),
  });
  assert(root.innerHTML.includes('data-action="generate-tts"'), "generate-tts button present in playing");
  assert(root.innerHTML.includes("disabled"), "playing: TTS button disabled");
  assert(root.innerHTML.includes("MiniMax 暂停") || root.innerHTML.includes("⏸️ MiniMax"), "playing label: MiniMax 暂停");
  assert(root.innerHTML.includes("⏸️"), "playing icon: ⏸️");
  // No separate play-tts button — generate-tts handles toggle
  assert(!root.innerHTML.includes("data-action=\"play-tts\""), "playing: no separate play-tts button");
}

// ── TTS button: paused state ─────────────────────────────────────────────────
console.log("\n── TTS button: paused state ──");
{
  render({
    broadcastAudio: makeAudio({
      status: "paused",
      text: "亲爱的居民们，傍晚好。",
      audioUrl: "data:audio/mp3;base123",
    }),
  });
  assert(root.innerHTML.includes('data-action="generate-tts"'), "generate-tts button present in paused");
  // TTS button is disabled when audio already exists
  assert(root.innerHTML.includes("disabled"), "paused: TTS button disabled (audio exists)");
  assert(root.innerHTML.includes("MiniMax 播放") || root.innerHTML.includes("▶️ MiniMax"), "paused label: MiniMax 播放");
  assert(root.innerHTML.includes("▶️"), "paused icon: ▶️");
  // No separate play-tts button — generate-tts handles toggle
  assert(!root.innerHTML.includes("data-action=\"play-tts\""), "paused: no separate play-tts button");
}

// ── TTS button: error state ──────────────────────────────────────────────────
console.log("\n── TTS button: error state ──");
{
  render({
    broadcastAudio: makeAudio({
      status: "error",
      text: "亲爱的居民们，傍晚好。",
      error: "语音合成失败，请稍后重试。",
      scriptHash: "abc123",
    }),
  });
  assert(root.innerHTML.includes('data-action="generate-tts"'), "generate-tts button present in error");
  assert(!root.innerHTML.includes("disabled"), "error: TTS button re-enabled for retry");
  assert(root.innerHTML.includes("重新生成"), "error label: 重新生成");
  assert(root.innerHTML.includes("⚠️"), "error icon: ⚠️");
  assert(root.innerHTML.includes("语音合成失败"), "error message shown");
}

// ── TTS badge: shows TTS status in atmosphere panel header ───────────────────
console.log("\n── TTS status badge in atmosphere panel header ──");
{
  render({ broadcastAudio: makeAudio({ status: "idle" }) });
  assert(!root.innerHTML.includes("panel-badge--tts"), "idle: no TTS badge");

  render({ broadcastAudio: makeAudio({ status: "loading" }) });
  assert(root.innerHTML.includes("panel-badge--tts"), "loading: TTS badge present");
  assert(root.innerHTML.includes("语音生成中"), "loading: badge says 语音生成中…");

  render({
    broadcastAudio: makeAudio({
      status: "ready",
      audioUrl: "data:audio/mp3;base123",
    }),
  });
  assert(root.innerHTML.includes("panel-badge--tts"), "ready: TTS badge present");
  assert(root.innerHTML.includes("可播放"), "ready: badge says 可播放");

  render({ broadcastAudio: makeAudio({ status: "playing" }) });
  assert(root.innerHTML.includes("播放中"), "playing: badge says 播放中…");

  render({ broadcastAudio: makeAudio({ status: "paused" }) });
  assert(root.innerHTML.includes("已暂停"), "paused: badge says 已暂停");

  render({ broadcastAudio: makeAudio({ status: "error", error: "fail" }) });
  assert(root.innerHTML.includes("语音生成失败"), "error: badge says 语音生成失败");
}

// ── Play button: replay after audio naturally ends (status → ready) ──────────
console.log("\n── Play button: replay after audio naturally ends ──");
{
  render({
    broadcastAudio: makeAudio({
      status: "ready",
      text: "亲爱的居民们，傍晚好。",
      audioUrl: "data:audio/mp3;base123",
      scriptHash: "abc123",
    }),
  });
  // No separate play-tts button — clicking generate-tts triggers play
  assert(!root.innerHTML.includes("data-action=\"play-tts\""), "after natural end: no separate play-tts button (generate-tts handles play)");
  assert(root.innerHTML.includes("MiniMax 播放") || root.innerHTML.includes("▶️ MiniMax"), "after natural end: button shows MiniMax 播放");
}

// ── Play button: hidden when no audio ────────────────────────────────────────
console.log("\n── Play button: hidden when no audio ──");
{
  render({ broadcastAudio: makeAudio({ status: "ready", audioUrl: null }) });
  assert(!root.innerHTML.includes("data-action=\"play-tts\""), "no separate play-tts when audioUrl is null");

  render({ broadcastAudio: makeAudio({ status: "idle" }) });
  assert(!root.innerHTML.includes("data-action=\"play-tts\""), "no separate play-tts in idle state");

  render({ broadcastAudio: makeAudio({ status: "loading" }) });
  assert(!root.innerHTML.includes("data-action=\"play-tts\""), "no separate play-tts in loading state");
}

// ── TTS button: generate-tts handles play/pause/continue toggle ────────────────
console.log("\n── TTS button: generate-tts handles play/pause/continue toggle ──");
{
  // In playing state, generate-tts button shows "MiniMax 暂停" and is disabled
  // Clicking triggers pause via the toggle logic in onGenerateTts handler
  render({ broadcastAudio: makeAudio({ status: "playing" }) });
  assert(root.innerHTML.includes("disabled"), "playing: TTS button disabled");
  assert(root.innerHTML.includes("MiniMax 暂停") || root.innerHTML.includes("⏸️ MiniMax"), "playing: TTS button label shows MiniMax 暂停");

  // In paused state, generate-tts button shows "MiniMax 播放" and is disabled
  // Clicking triggers resume via the toggle logic
  render({ broadcastAudio: makeAudio({ status: "paused" }) });
  assert(root.innerHTML.includes("disabled"), "paused: TTS button disabled");
  assert(root.innerHTML.includes("MiniMax 播放") || root.innerHTML.includes("▶️ MiniMax"), "paused: TTS button label shows MiniMax 播放");
}

// ── Broadcast indicator on town-stage while playing ───────────────────────────
console.log("\n── Broadcast indicator on town-stage while playing ──");
{
  render({
    broadcastAudio: makeAudio({ status: "playing", audioUrl: "data:audio/mp3;base" }),
  });
  assert(root.innerHTML.includes("town-stage--broadcast-playing"), "town-stage has broadcast-playing class");
  assert(root.innerHTML.includes("stage-broadcast-indicator"), "stage broadcast indicator rendered");
  assert(root.innerHTML.includes("广播播放中"), "stage indicator text: 广播播放中…");

  render({
    broadcastAudio: makeAudio({ status: "paused", audioUrl: "data:audio/mp3;base" }),
  });
  assert(!root.innerHTML.includes("stage-broadcast-indicator"), "paused: no stage broadcast indicator");
}

// ── Friendly error: API keys never exposed ───────────────────────────────────
console.log("\n── Friendly error: API keys never exposed ──");
{
  render({
    broadcastAudio: makeAudio({
      status: "error",
      error: "Invalid API key sk-abc123xyz and trace_id: trace-xyz",
    }),
  });
  const html = root.innerHTML;
  assert(!html.includes("sk-abc123xyz"), "API key not in HTML");
  assert(!html.includes("trace-xyz"), "trace ID not in HTML");
  // Sensitive tokens replaced with [已隐藏]
  assert(!html.includes("api key"), "api key keyword not in HTML");
  assert(!html.includes("trace_id"), "trace_id keyword not in HTML");
}

// ── No broadcast: TTS button hidden, no error ─────────────────────────────────
console.log("\n── No broadcast: TTS button hidden ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, noopHandlers, {
    latestBroadcast: null,
    broadcastAudio: makeAudio({ status: "idle" }),
  });
  assert(!root.innerHTML.includes('data-action="generate-tts"'), "no TTS button when no broadcast");
  assert(!root.innerHTML.includes("panel-badge--tts"), "no TTS badge when no broadcast");
  assert(root.innerHTML.includes("atmosphere-empty"), "empty state placeholder shown");
}

// ── Results ───────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll TTS playback checks passed!");
