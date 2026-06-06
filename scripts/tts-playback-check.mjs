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
  assert(root.innerHTML.includes("生成语音广播"), "idle label: 生成语音广播");
  assert(root.innerHTML.includes("🔊"), "idle icon: 🔊");
  assert(!root.innerHTML.includes("play-tts"), "idle: no play button");
}

// ── TTS button: loading state ─────────────────────────────────────────────────
console.log("\n── TTS button: loading state ──");
{
  render({ broadcastAudio: makeAudio({ status: "loading", text: "亲爱的居民们，傍晚好。" }) });
  assert(root.innerHTML.includes('data-action="generate-tts"'), "generate-tts button present in loading");
  assert(root.innerHTML.includes("disabled"), "loading: button disabled");
  assert(root.innerHTML.includes("正在生成"), "loading label: 正在生成…");
  assert(root.innerHTML.includes("🔊"), "loading icon: 🔊");
  assert(!root.innerHTML.includes("play-tts"), "loading: no play button");
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
  // TTS button is disabled in ready/paused/playing to prevent double-generation
  // Playback is controlled exclusively via the separate play button
  assert(root.innerHTML.includes("disabled"), "ready: TTS button disabled (playback via play button)");
  assert(root.innerHTML.includes("播放广播"), "ready label: 播放广播");
  assert(root.innerHTML.includes("▶️"), "ready icon: ▶️");
  assert(root.innerHTML.includes('data-action="play-tts"'), "ready: play button present");
  assert(root.innerHTML.includes("▶️ 播放"), "play button label: ▶️ 播放");
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
  assert(root.innerHTML.includes("暂停广播"), "playing label: 暂停广播");
  assert(root.innerHTML.includes("⏸️"), "playing icon: ⏸️");
  // A dedicated pause button (data-action=play-tts with "暂停") is shown during playback
  assert(root.innerHTML.includes('data-action="play-tts"'), "playing: dedicated pause button present");
  assert(root.innerHTML.includes("暂停"), "playing: pause button label visible");
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
  // TTS button is disabled when audio already exists (ready/paused/playing) to prevent double-generation
  assert(root.innerHTML.includes("disabled"), "paused: TTS button disabled (audio already exists)");
  assert(root.innerHTML.includes("播放广播"), "paused label: 播放广播");
  assert(root.innerHTML.includes("▶️"), "paused icon: ▶️");
  assert(root.innerHTML.includes('data-action="play-tts"'), "paused: play button present");
  assert(root.innerHTML.includes("继续"), "paused: play button label says 继续");
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
  assert(root.innerHTML.includes('data-action="play-tts"'), "after natural end: play button visible (status=ready, has audio)");
  assert(root.innerHTML.includes("▶️ 播放"), "after natural end: play button label is 播放");
}

// ── Play button: hidden when no audio ────────────────────────────────────────
console.log("\n── Play button: hidden when no audio ──");
{
  render({ broadcastAudio: makeAudio({ status: "ready", audioUrl: null }) });
  assert(!root.innerHTML.includes('data-action="play-tts"'), "no play button when audioUrl is null");

  render({ broadcastAudio: makeAudio({ status: "idle" }) });
  assert(!root.innerHTML.includes('data-action="play-tts"'), "no play button in idle state");

  render({ broadcastAudio: makeAudio({ status: "loading" }) });
  assert(!root.innerHTML.includes('data-action="play-tts"'), "no play button in loading state");
}

// ── TTS button does NOT toggle play/pause (only generate/retry) ───────────────
console.log("\n── TTS button: no play/pause toggle — only generate/retry ──");
{
  // In playing state, TTS button shows "暂停广播" as status (not action)
  // TTS button is disabled to prevent double-generation
  render({ broadcastAudio: makeAudio({ status: "playing" }) });
  assert(root.innerHTML.includes("disabled"), "playing: TTS button disabled");
  assert(root.innerHTML.includes("暂停广播"), "playing: TTS button label shows 暂停 as status");

  // In paused state, TTS button is disabled (audio already exists, use play button to resume)
  render({ broadcastAudio: makeAudio({ status: "paused" }) });
  assert(root.innerHTML.includes("disabled"), "paused: TTS button disabled (audio already exists)");
  assert(!root.innerHTML.includes("继续"), "paused: TTS button label does NOT say 继续 (that's the play button)");
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
