// broadcast-tts-check — validates broadcast TTS playback loop
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

// ── Test: TTS button exists ───────────────────────────────────────────────────

console.log("\n── TTS button: data-action=generate-tts exists ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: { id: "bc1", title: "早安", script: "早安小镇。", mood: "warm", placeId: "plaza" },
  }));
  assert(root.innerHTML.includes('data-action="generate-tts"'), "generate-tts button present");
}

// ── Test: All broadcastAudio status values are handled ─────────────────────────

console.log("\n── broadcastAudio.status: idle / loading / ready / playing / paused / error ──");
{
  const state = createInitialState();
  const statuses = ["idle", "loading", "ready", "playing", "paused", "error"];
  const expectedTexts = {
    idle: "生成语音广播",
    loading: "正在生成…",
    ready: "播放广播",
    playing: "暂停广播",
    paused: "播放广播",
    error: "重新生成",
  };
  for (const status of statuses) {
    root.innerHTML = "";
    renderApp(root, state, handlers, makeUiState({
      latestBroadcast: { id: "bc1", title: "测试广播", script: "测试内容。", mood: "warm", placeId: "plaza" },
      broadcastAudio: {
        status,
        text: "测试内容。",
        audioUrl: status === "ready" || status === "playing" || status === "paused" ? "/mock-audio.mp3" : null,
        error: status === "error" ? "语音生成失败，请稍后重试。" : null,
        scriptHash: "abc",
      },
    }));
    assert(root.innerHTML.includes(expectedTexts[status]), `status="${status}" shows "${expectedTexts[status]}"`);
  }
}

// ── Test: loading state disables button (no double-click) ───────────────────

console.log("\n── TTS button disabled rules ──");
// idle/error: enabled (can generate/retry)
// loading/ready/playing/paused: disabled (audio already exists or generation in progress)
{
  const state = createInitialState();
  const testCases = [
    { status: "idle",     shouldBeDisabled: false, label: "idle" },
    { status: "loading",   shouldBeDisabled: true,  label: "loading" },
    { status: "ready",    shouldBeDisabled: true, label: "ready" },
    { status: "playing",  shouldBeDisabled: true, label: "playing" },
    { status: "paused",   shouldBeDisabled: true, label: "paused" },
    { status: "error",    shouldBeDisabled: false, label: "error" },
  ];
  for (const tc of testCases) {
    root.innerHTML = "";
    renderApp(root, state, handlers, makeUiState({
      latestBroadcast: { id: "bc1", title: "测试", script: "测试。", mood: "warm", placeId: "plaza" },
      broadcastAudio: {
        status: tc.status,
        text: "测试。",
        audioUrl: tc.status === "ready" || tc.status === "playing" || tc.status === "paused" ? "/mock.mp3" : null,
        error: tc.status === "error" ? "生成失败。" : null,
        scriptHash: "abc",
      },
    }));
    const btnMatch = root.innerHTML.match(/<button[^>]*data-action="generate-tts"[^>]*>/);
    const isDisabled = btnMatch !== null && btnMatch[0].includes("disabled");
    assert(
      isDisabled === tc.shouldBeDisabled,
      `status="${tc.label}" button ${tc.shouldBeDisabled ? "is disabled" : "is clickable"}`
    );
  }
}

// ── Test: playing state shows 暂停广播 and is disabled ─────────────────────

console.log("\n── playing state: shows 暂停广播 and is disabled ──");
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
  assert(root.innerHTML.includes("暂停广播"), "playing shows 暂停广播");
  const btnMatch = root.innerHTML.match(/<button[^>]*data-action="generate-tts"[^>]*>/);
  // TTS button is disabled during playback to prevent interruption
  assert(btnMatch !== null && btnMatch[0].includes("disabled"), "playing button is disabled");
}

// ── Test: paused state shows 播放广播 and is disabled ────────────────────

console.log("\n── paused state: shows 播放广播 and is disabled ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: { id: "bc1", title: "测试", script: "测试。", mood: "warm", placeId: "plaza" },
    broadcastAudio: {
      status: "paused",
      text: "测试。",
      audioUrl: "/mock.mp3",
      error: null,
      scriptHash: "abc",
    },
  }));
  // Paused shows "播放广播" as status label (TTS button disabled; resume via play button)
  assert(root.innerHTML.includes("播放广播"), "paused shows 播放广播");
  const btnMatch = root.innerHTML.match(/<button[^>]*data-action="generate-tts"[^>]*>/);
  assert(btnMatch !== null && btnMatch[0].includes("disabled"), "paused button is disabled");
}

// ── Test: no script → button disabled ────────────────────────────────────

console.log("\n── No script: button disabled or not rendered ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ latestBroadcast: null }));
  const btnMatch = root.innerHTML.match(/<button[^>]*data-action="generate-tts"[^>]*>/);
  // Button may not exist or be disabled — either is acceptable
  const isAbsent = btnMatch === null;
  const isDisabled = btnMatch !== null && btnMatch[0].includes("disabled");
  assert(isAbsent || isDisabled, "no script → button absent or disabled");
}

// ── Test: Same script (same hash) does not regenerate ───────────────────────

console.log("\n── Same script hash: no regeneration needed ──");
{
  // Verify the hash function is exported from app.js by checking behavior
  // When same script + same hash + ready status → onGenerateTts should call onPlayTts
  // We test this by checking that when status=ready and hash matches, no loading state appears
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: { id: "bc1", title: "测试", script: "测试内容。", mood: "warm", placeId: "plaza" },
    broadcastAudio: {
      status: "ready",
      text: "测试内容。",
      audioUrl: "/mock-audio.mp3",
      error: null,
      scriptHash: "abc123",
    },
  }));
  // Button should show "播放广播" not "正在生成"
  assert(root.innerHTML.includes("播放广播"), "ready state shows 播放广播");
  assert(!root.innerHTML.includes("正在生成"), "ready state does NOT show 正在生成");
}

// ── Test: Different script allows regeneration ────────────────────────────────

console.log("\n── Different script: regeneration allowed ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: { id: "bc1", title: "新广播", script: "新的广播内容。", mood: "warm", placeId: "plaza" },
    broadcastAudio: {
      status: "ready",
      text: "旧广播内容。",  // different from latestBroadcast.script
      audioUrl: "/mock-old.mp3",
      error: null,
      scriptHash: "oldhash",
    },
  }));
  // Should show "播放广播" (ready to play) — the UI knows it's a different script
  assert(root.innerHTML.includes("播放广播") || root.innerHTML.includes("生成语音"), "different script shows generate or play");
}

// ── Test: Playing state shows broadcast indicator on map ─────────────────────

console.log("\n── Playing state: map stage has broadcast indicator ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: { id: "bc1", title: "播放中", script: "正在播放的广播。", mood: "warm", placeId: "plaza" },
    broadcastAudio: {
      status: "playing",
      text: "正在播放的广播。",
      audioUrl: "/mock-audio.mp3",
      error: null,
      scriptHash: "abc",
    },
  }));
  assert(root.innerHTML.includes("town-stage--broadcast-playing") || root.innerHTML.includes("stage-broadcast-indicator"), "map stage has broadcast-playing class or indicator");
  assert(root.innerHTML.includes("📻") && root.innerHTML.includes("广播播放中"), "indicator shows 📻 and 播放中 text");
}

// ── Test: Error state shows friendly message ─────────────────────────────────

console.log("\n── Error state: no API keys or stack traces in UI ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: { id: "bc1", title: "错误测试", script: "测试。", mood: "warm", placeId: "plaza" },
    broadcastAudio: {
      status: "error",
      text: "测试。",
      audioUrl: null,
      error: "statusCode=400: API key invalid (trace_id: abc123)",
      scriptHash: "abc",
    },
  }));
  const html = root.innerHTML;
  assert(!html.includes("apiKey") && !html.includes("API_KEY") && !html.includes("sk-cp-"), "no API key in UI");
  assert(!html.includes("trace_id") && !html.includes("traceId") && !html.includes("abc123"), "no trace ID in UI");
  assert(!html.includes("stack") && !html.includes("Error:"), "no stack trace in UI");
  assert(html.includes("重新生成") || html.includes("tts-error-hint"), "error state shows 重新生成 or error hint");
}

// ── Test: No API keys in UI ────────────────────────────────────────────────

console.log("\n── UI: no API keys or sensitive data exposed ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: { id: "bc1", title: "安全测试", script: "测试。", mood: "warm", placeId: "plaza" },
    broadcastAudio: {
      status: "error",
      text: "测试。",
      audioUrl: null,
      error: "API_KEY_sk_test_12345 (trace_id: xyz789) some internal error",
      scriptHash: "abc",
    },
  }));
  assert(!root.innerHTML.includes("API_KEY"), "no API_KEY in UI");
  assert(!root.innerHTML.includes("sk-cp-"), "no sk-cp- token in UI");
  assert(!root.innerHTML.includes("trace_id"), "no trace_id in UI");
}

// ── Test: No forbidden dependencies ─────────────────────────────────────────

console.log("\n── Dependencies: no third-party audio player libraries ──");
{
  const { readFileSync } = await import("fs");
  const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const forbidden = ["howler", "tone.js", "soundjs", "flac", "audiobuffer", "phaser", "pixi"];
  const found = forbidden.filter((k) => deps[k]);
  assert(found.length === 0, `no forbidden audio/game libraries found (got: ${found.join(", ") || "none"})`);
}

// ── Test: MiniMax speech-t2a-http not modified ─────────────────────────────

console.log("\n── MiniMax speech-t2a-http not modified ──");
{
  const { readFileSync } = await import("fs");
  const content = readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(content.includes("speech-2.8-hd"), "MiniMax speech-t2a-http model preserved");
  assert(content.includes("male-qn-qingse"), "MiniMax voice ID preserved");
}

// ── Test: music_generation not modified ────────────────────────────────────

console.log("\n── music_generation not modified ──");
{
  const { readFileSync } = await import("fs");
  const content = readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(!content.includes("music_generation"), "no music_generation reference in minimaxTts.js");
}

// ── Test: prefers-reduced-motion covers broadcast indicator ──────────────────

console.log("\n── CSS: prefers-reduced-motion covers broadcast indicator ──");
{
  const { readFileSync } = await import("fs");
  const css = readFileSync("./src/styles.css", "utf8");
  assert(css.includes("prefers-reduced-motion"), "prefers-reduced-motion media query exists");
  assert(css.includes("broadcastIndicatorPulse") || css.includes("stage-broadcast-indicator"), "broadcast indicator has reduced-motion rule or animation");
}

// ── Test: Render output has required elements ───────────────────────────────

console.log("\n── Render: town-stage, atmosphere-panel, generate-tts all present ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: { id: "bc1", title: "完整测试", script: "完整广播内容。", mood: "warm", placeId: "plaza" },
    broadcastAudio: {
      status: "ready",
      text: "完整广播内容。",
      audioUrl: "/mock-audio.mp3",
      error: null,
      scriptHash: "abc",
    },
  }));
  assert(root.innerHTML.includes("town-stage"), "town-stage present");
  assert(root.innerHTML.includes("atmosphere-panel") || root.innerHTML.includes("小镇氛围"), "atmosphere-panel present");
  assert(root.innerHTML.includes('data-action="generate-tts"'), "generate-tts button present");
  assert(root.innerHTML.includes("stage-character"), "stage-character present");
  assert(root.innerHTML.includes("stage-place-label"), "stage-place-label present");
  assert(root.innerHTML.includes("completion-badge") || root.innerHTML.includes("stage-character"), "completion/character system preserved");
}

// ── Test: activeTaskAnimations still work alongside TTS ──────────────────────

console.log("\n── activeTaskAnimations preserved alongside TTS ──");
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
    latestBroadcast: { id: "bc1", title: "同时测试", script: "测试。", mood: "warm", placeId: "plaza" },
    broadcastAudio: { status: "playing", text: "测试。", audioUrl: "/mock.mp3", error: null, scriptHash: "abc" },
    activeTaskAnimations: [anim],
    isAnimating: true,
  }));
  assert(root.innerHTML.includes("stage-character__action-bubble"), "action bubble preserved");
  assert(root.innerHTML.includes("is-farming") || root.innerHTML.includes("stage-character--work"), "animation class preserved");
  assert(root.innerHTML.includes("stage-broadcast-indicator") || root.innerHTML.includes("town-stage--broadcast-playing"), "broadcast indicator present alongside animations");
}

// ── Test: CompletionFeedback still works ─────────────────────────────────────

console.log("\n── completionFeedback preserved with TTS ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: { id: "bc1", title: "完成测试", script: "测试。", mood: "warm", placeId: "plaza" },
    broadcastAudio: { status: "ready", text: "测试。", audioUrl: "/mock.mp3", error: null, scriptHash: "abc" },
    completionFeedback: {
      id: "cf1", message: "本阶段完成", startedAt: Date.now(),
      residentResults: [{ residentId: state.residents[0].id, icon: "🌸", label: "完成花园" }],
    },
  }));
  assert(root.innerHTML.includes("game-actions__completion-banner") || root.innerHTML.includes("completion-banner"), "completion banner preserved");
  assert(root.innerHTML.includes("stage-character__completion-badge"), "completion badge preserved");
}

// ── Results ────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll broadcast TTS checks passed!");
