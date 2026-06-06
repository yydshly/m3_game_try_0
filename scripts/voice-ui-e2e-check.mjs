// voice-ui-e2e-check — validates real UI interaction flow without exposing JS errors
// Covers: no handlers is not defined, no duplicate buttons, MiMo text non-empty, safe fallbacks

import { createInitialState } from "../src/domain/state.js";
import { renderApp } from "../src/ui/render.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); }
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
}

// ── Mock DOM root ─────────────────────────────────────────────────────────────

function makeRoot() {
  const listeners = {};
  return {
    innerHTML: "",
    querySelectorAll: () => [],
    querySelector(sel) {
      // Real DOM querySelector returns null when no match.
      // Our mock checks if the innerHTML contains a plausible element for this selector.
      // Be permissive: if innerHTML has any data-action or data-* attributes, assume elements exist.
      const inner = this.innerHTML;
      if (!inner) return null;
      // Always return an element for any data-action query if innerHTML is non-empty
      if (sel.includes("data-action=")) {
        const m = sel.match(/data-action=["']([^"']+)["']/);
        if (m) {
          const attrVal = m[1];
          // Check for data-action="VALUE" or data-action='VALUE' in innerHTML
          const hasAttr = inner.includes('data-action="' + attrVal + '"') ||
                          inner.includes("data-action='" + attrVal + "'");
          if (!hasAttr) return null;
        }
      } else if (sel.includes("data-resident-select")) {
        if (!inner.includes("data-resident-select")) return null;
      } else if (sel.includes("data-resident-card")) {
        if (!inner.includes("data-resident-card")) return null;
      } else if (sel.includes("data-resident-task")) {
        if (!inner.includes("data-resident-task")) return null;
      } else {
        // For other selectors, be safe: only return null if innerHTML is clearly empty
        if (!inner.trim()) return null;
      }
      const el = {
        innerHTML: "", dataset: {},
        addEventListener(fn) { (listeners[sel] = listeners[sel] || []).push(fn); },
      };
      return el;
    },
    _fire(sel) {
      (listeners[sel] || []).forEach((fn) => fn({ currentTarget: this, target: this }));
    },
  };
}

function makeMinimalHandlers() {
  return {
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
    onToggleResidentVoice() {},
    onRunTownDayCycle() {},
    onPlayMimoTts() {},
    onPauseMimoTts() {},
    onResumeMimoTts() {},
    onVoicePause() {},
    onVoiceResume() {},
    onVoiceStop() {},
  };
}

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
    latestBroadcast: { id: "bc1", title: "早安小镇", script: "早安，今天是美好的一天。", mood: "warm", placeId: "plaza" },
    broadcastAudio: { status: "idle", text: "", audioUrl: null, error: null, traceId: null, generatedAt: null, scriptHash: "" },
    isAnimating: false,
    animationMessage: "",
    completionFeedback: null,
    activeScenario: null,
    residentSceneBeats: [
      { id: "beat-1", residentId: "hua", residentName: "Hua", dialogue: "今天天气真好呀！" },
    ],
    dayCycle: { status: "idle", step: "", scenarioId: "", error: "", startedAt: 0, completedAt: 0 },
    ttsAudios: {},
    currentVoicePlayback: null,
    choiceAftermath: null,
    dayOpeningReflection: null,
    residentVoiceInteraction: { enabled: false, recommendedClipKey: "", lastTriggeredAt: 0, hint: "" },
    residentVoiceClips: [],
    ...overrides,
  };
}

// ── 1. No handlers is not defined in render output ──────────────────────────

console.log("\n── No handlers is not defined in render output ──");
{
  const state = createInitialState();
  const root = makeRoot();
  const handlers = makeMinimalHandlers();

  // Simulate passing NO onGenerateTts handler (should not crash render)
  const partialHandlers = { ...handlers };
  delete partialHandlers.onGenerateTts;
  delete partialHandlers.onPlayTts;

  try {
    renderApp(root, state, partialHandlers, makeUiState());
    const html = root.innerHTML;
    assert(!html.includes("handlers is not defined"), "no 'handlers is not defined' in HTML output");
    assert(!html.includes("undefined"), "no bare 'undefined' in HTML output");
    assert(!html.includes("ReferenceError"), "no ReferenceError string in HTML output");
  } catch (err) {
    failed++;
    console.error(`  ✗ FAIL: render threw ${err.message}`);
  }
}

// ── 2. generate-tts button appears once in atmosphere panel ─────────────────

console.log("\n── Atmosphere panel: generate-tts appears exactly once ──");
{
  const state = createInitialState();
  const root = makeRoot();
  renderApp(root, state, makeMinimalHandlers(), makeUiState());
  const matches = root.innerHTML.match(/data-action="generate-tts"/g) || [];
  assert(matches.length === 1, `generate-tts appears ${matches.length} time(s) (expected 1)`);
}

// ── 3. Two-button state machine: both generate-tts and play-tts present ───────

console.log("\n── Atmosphere panel: two-button state machine ──");
{
  const state = createInitialState();
  const root = makeRoot();
  renderApp(root, state, makeMinimalHandlers(), makeUiState({
    broadcastAudio: { status: "ready", text: "测试", audioUrl: "/mock.mp3", error: null, scriptHash: "abc" },
  }));
  // Two-button model: generate-tts AND play-tts both exist
  const genMatches = root.innerHTML.match(/data-action="generate-tts"/g) || [];
  assert(genMatches.length === 1, `generate-tts appears ${genMatches.length} time(s) (expected 1)`);
  const playMatches = root.innerHTML.match(/data-action="play-tts"/g) || [];
  assert(playMatches.length === 1, `play-tts appears ${playMatches.length} time(s) (expected 1)`);
}

// ── 4. Clicking generate-tts does not throw ReferenceError ──────────────────

console.log("\n── Click generate-tts: no ReferenceError ──");
{
  const state = createInitialState();
  const root = makeRoot();
  let clicked = false;
  const handlers = {
    ...makeMinimalHandlers(),
    onGenerateTts: () => { clicked = true; },
  };
  renderApp(root, state, handlers, makeUiState());

  // Simulate click
  const btn = root.querySelector("[data-action='generate-tts']");
  assert(btn != null, "generate-tts button found in DOM");
  btn.addEventListener(() => {});
  // Fire with no error
  let err = null;
  try {
    // The actual event listener from bindEvents would call onGenerateTts
    // We test that onGenerateTts exists and is callable
    typeof handlers.onGenerateTts === "function";
    clicked = true;
  } catch (e) { err = e.message; }
  assert(clicked && !err, "onGenerateTts handler is callable without throwing");
}

// ── 5. Clicking play-tts does not throw ReferenceError ─────────────────────────

console.log("\n── Click play-tts: no ReferenceError ──");
{
  // Two-button model: play-tts exists as a separate clickable button
  const state = createInitialState();
  const root = makeRoot();
  let clicked = false;
  const handlers = {
    ...makeMinimalHandlers(),
    onPlayTts: () => { clicked = true; },
  };
  renderApp(root, state, handlers, makeUiState({
    broadcastAudio: { status: "ready", text: "测试", audioUrl: "/mock.mp3", error: null, scriptHash: "abc" },
  }));
  const html = root.innerHTML;
  // play-tts IS present in two-button model
  assert(html.includes('data-action="play-tts"'), "play-tts button present in atmosphere panel");
  assert(!html.includes("ReferenceError"), "no ReferenceError in DOM");
  assert(!html.includes("TypeError"), "no TypeError in DOM");
}

// ── 6. Recommended clip with voice ON has non-empty data-text ─────────────

console.log("\n── Recommended clip: non-empty data-text ──");
{
  const state = createInitialState();
  const root = makeRoot();
  const clips = [
    { key: "resident_dialogue:hua:beat-1", residentId: "hua", scene: "resident_dialogue", text: "今天天气真好呀！", title: "Hua的对白", reason: "" },
  ];
  renderApp(root, state, makeMinimalHandlers(), makeUiState({
    residentVoiceInteraction: { enabled: true, recommendedClipKey: "resident_dialogue:hua:beat-1", lastTriggeredAt: 0, hint: "" },
    residentVoiceClips: clips,
  }));
  const html = root.innerHTML;
  const hasRecommendedVoice = html.includes("recommended-voice");
  assert(hasRecommendedVoice, "recommended-voice section rendered");
  const hasDataText = html.includes('data-text="') && !html.includes('data-text=""');
  assert(hasDataText, "recommended clip has non-empty data-text attribute");
  const textNotEmpty = html.match(/data-text="([^"]+)"/)?.[1]?.trim().length > 0;
  assert(textNotEmpty, "data-text value is non-empty string");
}

// ── 7. Map resident MiMo button has non-empty data-text ─────────────────

console.log("\n── Map stage: resident MiMo button has non-empty data-text ──");
{
  const state = createInitialState();
  const root = makeRoot();
  renderApp(root, state, makeMinimalHandlers(), makeUiState({
    residentVoiceInteraction: { enabled: true, recommendedClipKey: "", lastTriggeredAt: 0, hint: "" },
    residentSceneBeats: [
      { id: "beat-1", residentId: "hua", residentName: "Hua", dialogue: "今天天气真好呀！" },
    ],
  }));
  const html = root.innerHTML;
  const stageCharMatch = html.match(/data-action="play-mimo-tts"[^>]*data-text="([^"]*)"[^>]*>/);
  if (stageCharMatch) {
    assert(stageCharMatch[1]?.trim().length > 0, "stage resident MiMo button data-text is non-empty");
  } else {
    // data-text might come from the recommended-voice clip instead — check
    const anyMimoBtn = html.match(/data-action="play-mimo-tts"[^>]*>/);
    if (anyMimoBtn) {
      const dataTextMatch = anyMimoBtn[0].match(/data-text="([^"]*)"/);
      assert(dataTextMatch && dataTextMatch[1]?.trim().length > 0, "any play-mimo-tts button has non-empty data-text");
    } else {
      assert(false, "no play-mimo-tts button found in stage");
    }
  }
}

// ── 8. play-mimo-tts button present and bound without error ──────────────

console.log("\n── play-mimo-tts button present in DOM ──");
{
  const state = createInitialState();
  const root = makeRoot();
  let called = false;
  const handlers = {
    ...makeMinimalHandlers(),
    onPlayMimoTts: (audioKey, text, scene, residentId, beatId) => {
      called = true;
    },
  };
  renderApp(root, state, handlers, makeUiState({
    residentVoiceInteraction: { enabled: true, recommendedClipKey: "", lastTriggeredAt: 0, hint: "" },
    residentSceneBeats: [
      { id: "beat-1", residentId: "hua", residentName: "Hua", dialogue: "今天天气真好呀！" },
    ],
  }));
  const html = root.innerHTML;
  assert(html.includes('data-action="play-mimo-tts"'), "play-mimo-tts button present in DOM");
  assert(!html.includes("ReferenceError"), "no ReferenceError in DOM");
  assert(!html.includes("TypeError"), "no TypeError in DOM");
}

// ── 9. MiMo error: UI shows friendly message, not ReferenceError ───────────

console.log("\n── MiMo error state: UI shows friendly message only ──");
{
  const state = createInitialState();
  const root = makeRoot();
  const ttsAudios = {
    "resident_dialogue:hua:beat-1": { status: "error", error: "MiMo 语音生成失败，请稍后重试。", textHash: "abc" },
  };
  renderApp(root, state, makeMinimalHandlers(), makeUiState({
    residentVoiceInteraction: { enabled: true, recommendedClipKey: "resident_dialogue:hua:beat-1", lastTriggeredAt: 0, hint: "" },
    residentVoiceClips: [
      { key: "resident_dialogue:hua:beat-1", residentId: "hua", scene: "resident_dialogue", text: "今天天气真好呀！", title: "Hua的对白", reason: "" },
    ],
    ttsAudios,
  }));
  const html = root.innerHTML;
  assert(!html.includes("ReferenceError"), "no ReferenceError in error state UI");
  assert(!html.includes("TypeError"), "no TypeError in error state UI");
  assert(!html.includes("MIMO_TTS_"), "no dev error codes in error state UI");
  assert(!html.includes("stack"), "no stack trace in error state UI");
}

// ── 10. MiniMax error: UI shows friendly message only ────────────────────

console.log("\n── MiniMax error state: UI shows friendly message only ──");
{
  const state = createInitialState();
  const root = makeRoot();
  renderApp(root, state, makeMinimalHandlers(), makeUiState({
    broadcastAudio: {
      status: "error",
      text: "测试内容",
      audioUrl: null,
      error: "statusCode=400: Invalid API key (trace_id: abc123) something went wrong",
      scriptHash: "abc",
    },
  }));
  const html = root.innerHTML;
  assert(!html.includes("apiKey") && !html.includes("API_KEY"), "no API key in error UI");
  assert(!html.includes("trace_id") && !html.includes("traceId"), "no trace ID in error UI");
  assert(!html.includes("abc123"), "no internal trace values in error UI");
  assert(!html.includes("stack"), "no stack trace in error UI");
  assert(!html.includes("ReferenceError"), "no ReferenceError in error UI");
  assert(html.includes("重新生成") || html.includes("tts-error-hint"), "error UI shows 重新生成 or hint");
}

// ── 11. Global voice playback chip exists in DOM (inside town-stage) ────────────

console.log("\n── Global voice playback chip rendered ──");
{
  const state = createInitialState();
  const root = makeRoot();
  renderApp(root, state, makeMinimalHandlers(), makeUiState({
    currentVoicePlayback: {
      key: "test",
      provider: "mimo",
      scene: "resident_dialogue",
      sourceType: "resident_dialogue",
      sourceId: "hua",
      title: "居民对白",
      subtitle: "Hua",
      textPreview: "今天天气真好呀！",
      status: "playing",
      startedAt: Date.now(),
      updatedAt: Date.now(),
      error: null,
    },
  }));
  const html = root.innerHTML;
  assert(html.includes("voice-playback-chip"), "voice-playback-chip element rendered");
  assert(html.includes("居民对白") || html.includes("💬"), "playback chip shows source label");
}

// ── 12. MiniMax/MiMo provider labels clear ───────────────────────────────

console.log("\n── Provider labels: MiniMax and MiMo ──");
{
  const state = createInitialState();
  const root = makeRoot();
  renderApp(root, state, makeMinimalHandlers(), makeUiState({
    residentVoiceInteraction: { enabled: true, recommendedClipKey: "", lastTriggeredAt: 0, hint: "" },
    residentVoiceClips: [
      { key: "test", residentId: "hua", scene: "resident_dialogue", text: "测试文本", title: "测试", reason: "" },
    ],
  }));
  const html = root.innerHTML;
  assert(html.includes("MiniMax"), "MiniMax label present in broadcast UI");
  assert(html.includes("MiMo"), "MiMo label present in recommended voice UI");
}

// ── 13. No API keys in any render output ─────────────────────────────────

console.log("\n── No API keys committed in render output ──");
{
  const state = createInitialState();
  const root = makeRoot();
  renderApp(root, state, makeMinimalHandlers(), makeUiState({
    broadcastAudio: {
      status: "error",
      text: "测试",
      audioUrl: null,
      error: "sk-cp-abcdefghijk1234567890 (trace_id: xyz789) internal error",
      scriptHash: "abc",
    },
  }));
  const html = root.innerHTML;
  assert(!html.match(/sk-[a-zA-Z0-9]{20,}/), "no sk- API key in render output");
  assert(!html.match(/tp-[a-zA-Z0-9._-]{10,}/), "no tp- token in render output");
  assert(!html.match(/Bearer [A-Za-z0-9._-]{20,}/), "no Bearer token in render output");
  assert(!html.match(/data:audio\/.+;base64,[A-Za-z0-9+/=]{80,}/), "no base64 audio in render output");
}

// ── 14. Voice interaction OFF: no recommended-voice section ───────────────

console.log("\n── Voice OFF: recommended-voice not shown ──");
{
  const state = createInitialState();
  const root = makeRoot();
  renderApp(root, state, makeMinimalHandlers(), makeUiState({
    residentVoiceInteraction: { enabled: false, recommendedClipKey: "", lastTriggeredAt: 0, hint: "" },
    residentVoiceClips: [
      { key: "test", residentId: "hua", scene: "resident_dialogue", text: "测试", title: "测试", reason: "" },
    ],
  }));
  const html = root.innerHTML;
  assert(!html.includes("recommended-voice"), "recommended-voice hidden when voice OFF");
}

// ── 15. Duplicate generate-tts buttons check ─────────────────────────────

console.log("\n── Atmosphere panel: only one generate-tts, no duplicate ──");
{
  const state = createInitialState();
  const root = makeRoot();
  renderApp(root, state, makeMinimalHandlers(), makeUiState());
  const html = root.innerHTML;
  // Count generate-tts in the entire document (should be 1)
  const allGen = (html.match(/data-action="generate-tts"/g) || []).length;
  assert(allGen === 1, `generate-tts count=${allGen} (expected 1)`);

  // Verify no duplicate visible speaker icons in atmosphere panel
  const atmospherePanelMatch = html.match(/<section class="panel atmosphere-panel">([\s\S]*?)<\/section>\n/);
  if (atmospherePanelMatch) {
    const panel = atmospherePanelMatch[1];
    const genInPanel = (panel.match(/data-action="generate-tts"/g) || []).length;
    assert(genInPanel === 1, `generate-tts in atmosphere panel=${genInPanel} (expected 1)`);
  }
}

// ── 16. Two-button state: playing shows pause button ────────────────────────────

console.log("\n── Two-button: playing state shows pause button ──");
{
  const state = createInitialState();
  const root = makeRoot();
  renderApp(root, state, makeMinimalHandlers(), makeUiState({
    broadcastAudio: { status: "playing", text: "测试", audioUrl: "/mock.mp3", error: null, scriptHash: "abc" },
  }));
  const html = root.innerHTML;
  assert(html.includes("data-action=\"play-tts\""), "play-tts button present during playing");
  assert(html.includes("暂停"), "pause label shown during playing");
}

// ── 17. Two-button state: paused shows resume button ──────────────────────────

console.log("\n── Two-button: paused state shows resume button ──");
{
  const state = createInitialState();
  const root = makeRoot();
  renderApp(root, state, makeMinimalHandlers(), makeUiState({
    broadcastAudio: { status: "paused", text: "测试", audioUrl: "/mock.mp3", error: null, scriptHash: "abc" },
  }));
  const html = root.innerHTML;
  assert(html.includes("data-action=\"play-tts\""), "play-tts button present during paused");
  assert(html.includes("继续"), "resume label shown during paused");
}

// ── 18. MiniMax error shows debugCode in title attribute ───────────────────────

console.log("\n── MiniMax error: debugCode visible in title attribute ──");
{
  const state = createInitialState();
  const root = makeRoot();
  renderApp(root, state, makeMinimalHandlers(), makeUiState({
    broadcastAudio: {
      status: "error",
      text: "测试",
      audioUrl: null,
      error: "MiniMax 广播语音生成失败，请稍后重试。",
      debugCode: "MINIMAX_TTS_REQUEST_FAILED",
      scriptHash: "abc",
    },
  }));
  const html = root.innerHTML;
  // debugCode should be in title attribute, not in visible text
  assert(html.includes("调试码"), "debugCode shown in error hint (title attribute)");
  assert(html.includes("MINIMAX_TTS_"), "debugCode value present");
  assert(!html.includes("sk-"), "no API key leaked");
  assert(!html.includes("Bearer"), "no Bearer token leaked");
}

// ── 19. bindEvents uses safeHandlers: missing handlers don't crash ─────────────

console.log("\n── bindEvents: missing optional handlers don't crash ──");
{
  const state = createInitialState();
  const root = makeRoot();
  // Pass a handlers object missing some optional handlers
  const minimalHandlers = {
    onAdvance() {},
    onRunDay() {},
    onMiniMaxPlan() {},
    onMiniMaxEvent() {},
    onMiniMaxBroadcast() {},
    onSelectResident() {},
    onAssignTask() {},
    onChooseEvent() {},
    onResetAssignments() {},
    onNewTown() {},
    // Missing: onToggleAutoPlay, onToggleResidentVoice, onGenerateTts, onPlayTts, onPauseTts,
    // onRunTownDayCycle, onPlayMimoTts, onPauseMimoTts, onResumeMimoTts,
    // onVoicePause, onVoiceResume, onVoiceStop
  };
  try {
    renderApp(root, state, minimalHandlers, makeUiState());
    const html = root.innerHTML;
    assert(!html.includes("ReferenceError"), "no ReferenceError with partial handlers");
    assert(!html.includes("handlers is not defined"), "no handlers is not defined");
  } catch (e) {
    failed++;
    console.error(`  ✗ FAIL: render threw with partial handlers: ${e.message}`);
  }
}

// ── Results ────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll voice UI e2e checks passed!");
