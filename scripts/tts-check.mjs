// TTS check — tests config defaults, text validation, error response handling, and render integration
import { ttsConfigDefaults, validateBroadcastText, generateBroadcastSpeech } from "../src/services/minimaxTts.js";
import { createInitialState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";
import { renderApp } from "../src/ui/render.js";

// ── Mock fetch helper ──────────────────────────────────────────────────────────
const originalFetch = globalThis.fetch;

function mockFetch(response) {
  globalThis.fetch = async () => new Response(JSON.stringify(response), {
    status: response?.ok === false ? 502 : 200,
    headers: { "content-type": "application/json" },
  });
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

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

// ── Config defaults ───────────────────────────────────────────────────────────
console.log("\n── TTS config defaults ──");

assert(ttsConfigDefaults.enabled === true, "enabled defaults to true");
assert(ttsConfigDefaults.model === "speech-2.8-hd", "model is speech-2.8-hd");
assert(ttsConfigDefaults.voiceId === "male-qn-qingse", "voiceId is male-qn-qingse (connectivity test voice)");
assert(ttsConfigDefaults.speed === 1, "speed defaults to 1");
assert(ttsConfigDefaults.vol === 1, "vol defaults to 1");
assert(ttsConfigDefaults.pitch === 0, "pitch defaults to 0");
assert(ttsConfigDefaults.sampleRate === 32000, "sampleRate is 32000");
assert(ttsConfigDefaults.bitrate === 128000, "bitrate is number 128000 (not string)");
assert(ttsConfigDefaults.format === "mp3", "format is mp3");
assert(ttsConfigDefaults.channel === 1, "channel is 1");
assert(ttsConfigDefaults.timeoutMs === 30000, "timeoutMs is 30000");

// ── Text validation ─────────────────────────────────────────────────────────
console.log("\n── validateBroadcastText ──");

{
  const result = validateBroadcastText("你好，这里是小镇广播。");
  assert(result.valid === true, "valid text accepted");
  assert(!result.reason, "no error reason for valid text");
}

{
  const result = validateBroadcastText("");
  assert(result.valid === false, "empty string rejected");
  assert(result.reason?.includes("空"), "empty error reason mentions '空'");
}

{
  const result = validateBroadcastText("   ");
  assert(result.valid === false, "whitespace-only rejected");
}

{
  const result = validateBroadcastText(null);
  assert(result.valid === false, "null rejected");
}

{
  const result = validateBroadcastText(undefined);
  assert(result.valid === false, "undefined rejected");
}

{
  const longText = "小镇".repeat(2000); // ~4000 chars, well over 3000
  const result = validateBroadcastText(longText);
  assert(result.valid === false, "text over 3000 chars rejected");
  assert(result.reason?.includes("3000"), "error mentions 3000 limit");
}

// ── Error response handling ────────────────────────────────────────────────────
console.log("\n── generateBroadcastSpeech error responses ──");

{
  mockFetch({ ok: false, statusCode: 1004, statusMsg: "invalid voice_id", traceId: "trace-abc123" });
  try {
    await generateBroadcastSpeech("测试文本");
    assert(false, "should throw on ok:false with statusMsg");
  } catch (err) {
    const msg = err.message;
    assert(msg.includes("1004"), "error includes statusCode");
    assert(msg.includes("invalid voice_id"), "error includes statusMsg");
    assert(msg.includes("trace-abc123"), "error includes traceId");
  } finally {
    restoreFetch();
  }
}

{
  mockFetch({ ok: false, statusCode: 1002, statusMsg: "text too long", traceId: null });
  try {
    await generateBroadcastSpeech("测试文本");
    assert(false, "should throw on ok:false");
  } catch (err) {
    const msg = err.message;
    assert(msg.includes("1002"), "error includes statusCode");
    assert(msg.includes("text too long"), "error includes statusMsg");
  } finally {
    restoreFetch();
  }
}

{
  mockFetch({ ok: false, error: "HTTP 403", statusCode: 403, statusMsg: null, traceId: null });
  try {
    await generateBroadcastSpeech("测试文本");
    assert(false, "should throw on HTTP 403");
  } catch (err) {
    assert(err.message.includes("403"), "error includes HTTP status");
  } finally {
    restoreFetch();
  }
}

{
  mockFetch({ ok: false, statusCode: 0, statusMsg: "success", data: null, traceId: "trace-no-data" });
  try {
    await generateBroadcastSpeech("测试文本");
    assert(false, "should throw when data is null");
  } catch (err) {
    const msg = err.message;
    assert(msg.includes("no audio") || msg.includes("trace-no-data"), "error includes traceId for null data");
  } finally {
    restoreFetch();
  }
}

{
  // Successful response — hex audio
  const fakeHex = "49545370640000001c00000100000000".slice(0, 30); // small fake hex
  mockFetch({ ok: true, audioUrl: null, traceId: "trace-ok", extraInfo: {} });
  try {
    await generateBroadcastSpeech("测试");
    assert(false, "should throw when ok:true but no audioUrl");
  } catch (err) {
    assert(err.message.includes("no audio data"), "throws when no audioUrl despite ok:true");
  } finally {
    restoreFetch();
  }
}

{
  // Successful response with valid data URL
  mockFetch({ ok: true, audioUrl: "data:audio/mp3;base64,abc123", traceId: "trace-success", extraInfo: { audioFormat: "mp3" } });
  try {
    const result = await generateBroadcastSpeech("测试");
    assert(result.audioUrl === "data:audio/mp3;base64,abc123", "audioUrl returned on success");
    assert(result.traceId === "trace-success", "traceId returned on success");
    assert(result.extraInfo?.audioFormat === "mp3", "extraInfo returned on success");
  } finally {
    restoreFetch();
  }
}

// ── Render integration ──────────────────────────────────────────────────────
console.log("\n── renderApp TTS integration ──");

const state = advancePhase(advancePhase(createInitialState()));
renderApp(root, state, noopHandlers);

// TTS button only appears when a broadcast exists
assert(!root.innerHTML.includes('data-action="generate-tts"'), "no TTS button when no broadcast");
assert(!root.innerHTML.includes("🔊 生成语音"), "no TTS button label when no broadcast");

// With latestBroadcast but no audio
const stateWithBroadcast = {
  ...state,
  events: [
    ...state.events,
    {
      id: "broadcast-test-tts",
      type: "town-broadcast",
      day: 2,
      phase: "下午",
      title: "下午小镇广播",
      text: "亲爱的居民们，下午好。今天的小镇一切安好。",
      mood: "warm",
      musicMood: "轻快午后",
      placeId: "plaza",
      durationHint: "20s",
    },
  ],
};

root.innerHTML = "";
renderApp(root, stateWithBroadcast, noopHandlers, {
  latestBroadcast: {
    id: "broadcast-test-tts",
    title: "下午小镇广播",
    script: "亲爱的居民们，下午好。今天的小镇一切安好。",
    mood: "warm",
    musicMood: "轻快午后",
    placeId: "plaza",
  },
  broadcastAudio: { status: "idle", text: "", audioUrl: null, error: null, traceId: null, generatedAt: null },
});

assert(root.innerHTML.includes("generate-tts") || root.innerHTML.includes("生成语音"), "TTS button visible when broadcast exists");
assert(root.innerHTML.includes("data-action=\"generate-tts\""), "generate-tts action wired");

// With generating state
root.innerHTML = "";
renderApp(root, stateWithBroadcast, noopHandlers, {
  latestBroadcast: {
    id: "broadcast-test-tts",
    title: "下午小镇广播",
    script: "亲爱的居民们，下午好。今天的小镇一切安好。",
    mood: "warm",
    musicMood: "轻快午后",
    placeId: "plaza",
  },
  broadcastAudio: { status: "generating", text: "亲爱的居民们，下午好。", audioUrl: null, error: null, traceId: null, generatedAt: null },
});

assert(root.innerHTML.includes("生成中") || root.innerHTML.includes("正在生成"), "generating status shown");

// With error state
root.innerHTML = "";
renderApp(root, stateWithBroadcast, noopHandlers, {
  latestBroadcast: {
    id: "broadcast-test-tts",
    title: "下午小镇广播",
    script: "亲爱的居民们，下午好。今天的小镇一切安好。",
    mood: "warm",
    musicMood: "轻快午后",
    placeId: "plaza",
  },
  broadcastAudio: { status: "error", text: "亲爱的居民们，下午好。", audioUrl: null, error: "语音合成失败", traceId: null, generatedAt: null },
});

assert(root.innerHTML.includes("error") || root.innerHTML.includes("重试") || root.innerHTML.includes("语音合成失败"), "error state shown in TTS UI");

// With ready audio
root.innerHTML = "";
renderApp(root, stateWithBroadcast, noopHandlers, {
  latestBroadcast: {
    id: "broadcast-test-tts",
    title: "下午小镇广播",
    script: "亲爱的居民们，下午好。今天的小镇一切安好。",
    mood: "warm",
    musicMood: "轻快午后",
    placeId: "plaza",
  },
  broadcastAudio: {
    status: "ready",
    text: "亲爱的居民们，下午好。",
    audioUrl: "data:audio/mp3;base64,abc123",
    error: null,
    traceId: "trace-123",
    generatedAt: Date.now(),
  },
});

assert(root.innerHTML.includes("data-action=\"play-tts\"") || root.innerHTML.includes("播放"), "play button shown when audio ready");
assert(root.innerHTML.includes("播放语音") || root.innerHTML.includes("播放"), "ready status text shown");

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\nAll TTS checks passed!");
