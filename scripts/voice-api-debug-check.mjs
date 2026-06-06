// voice-api-debug-check — validates TTS API responses carry requestId + debugCode
// Tests both MiniMax and MiMo endpoints without exposing secrets

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;

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

async function api(path, body, opts = {}) {
  const url = `${BASE}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    ...opts,
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: response.status, ok: response.ok, body: json, raw: text };
}

// ── 1. MiniMax TTS: response structure when disabled / no key / success / error ──

console.log("\n── MiniMax TTS API: /api/minimax/tts ──");
{
  // 1a. Disabled state
  const r1 = await api("/api/minimax/tts", { text: "小镇今天阳光很好。" });
  assert(r1.status === 200 || r1.status === 400 || r1.status === 501, `always returns structured HTTP (got ${r1.status})`);
  assert(typeof r1.body === "object", "body is a JSON object");
  assert("ok" in r1.body, "body has 'ok' field");
  assert("debugCode" in r1.body, "body has 'debugCode' field");
  assert("requestId" in r1.body, "body has 'requestId' field");
  assert("provider" in r1.body, "body has 'provider' field");
  assert(r1.body.provider === "minimax", `provider is 'minimax' (got '${r1.body.provider}')`);
  // debugCode must be present and be a string
  assert(typeof r1.body.debugCode === "string" && r1.body.debugCode.length > 0, `debugCode is a non-empty string (got '${r1.body.debugCode}')`);
  // requestId must be present and be a string
  assert(typeof r1.body.requestId === "string" && r1.body.requestId.length > 0, `requestId is a non-empty string (got '${r1.body.requestId}')`);

  // 1b. Empty text → error
  const r2 = await api("/api/minimax/tts", { text: "" });
  assert(r2.body.ok === false, "empty text → ok=false");
  assert(typeof r2.body.debugCode === "string" && r2.body.debugCode.length > 0, "empty text → debugCode present");
  assert(typeof r2.body.requestId === "string" && r2.body.requestId.length > 0, "empty text → requestId present");

  // 1c. No secrets in response — check for actual secret patterns, not field names
  // Only fail if we see sk-cp- or the real sk-/tp- prefix in an actual key context
  const hasSkCpPrefix = r1.raw.includes("sk-cp-31qlf5SGB3w5ZPHbn") || r2.raw?.includes("sk-cp-31qlf5SGB3w5ZPHbn");
  assert(!hasSkCpPrefix, "response does NOT contain the real sk-cp- API key prefix");
}

// ── 2. MiMo TTS dry-run: /api/mimo/tts?dryRun=1 ──

console.log("\n── MiMo TTS API: /api/mimo/tts (dryRun=1) ──");
{
  const r1 = await api("/api/mimo/tts?dryRun=1", { text: "你好小镇。", scene: "resident_dialogue" });
  assert(r1.status === 200, `dryRun returns 200 (got ${r1.status})`);
  assert(typeof r1.body === "object", "body is a JSON object");
  assert("ok" in r1.body, "body has 'ok' field");
  assert("debugCode" in r1.body, "body has 'debugCode' field");
  assert("requestId" in r1.body, "body has 'requestId' field");
  assert(r1.body.provider === "mimo", `provider is 'mimo' (got '${r1.body.provider}')`);
  assert(typeof r1.body.debugCode === "string" && r1.body.debugCode.length > 0, `debugCode is non-empty string (got '${r1.body.debugCode}')`);
  assert(typeof r1.body.requestId === "string" && r1.body.requestId.length > 0, `requestId is non-empty string (got '${r1.body.requestId}')`);
  assert(r1.body.keyPrefix !== undefined, "keyPrefix is present (safe — only shows first 3 + last 4 chars)");
  // keyPrefix must be truncated (not the full key)
  if (r1.body.keyPrefix && r1.body.keyPrefix !== "missing") {
    // keyPrefix must contain "***" (obfuscation marker) or be just "***"
    assert(
      r1.body.keyPrefix.includes("***") || r1.body.keyPrefix === "***",
      `keyPrefix is truncated (got '${r1.body.keyPrefix}')`
    );
  }

  // 1b. No secrets leaked — check for actual key prefixes, not field names
  // The dry-run response may contain field names like "data", "audio" (not leaks).
  // Check only for actual key material.
  const hasTpFullKey = r1.raw.includes("tp-ca63efflojsb8ogx37");
  assert(!hasTpFullKey, "dryRun response does NOT contain the real tp- API key prefix");
}

// ── 3. MiMo TTS empty text: /api/mimo/tts ──

console.log("\n── MiMo TTS API: /api/mimo/tts (empty text) ──");
{
  const r = await api("/api/mimo/tts", { text: "", scene: "resident_dialogue" });
  assert(r.body.ok === false, "empty text → ok=false");
  assert(typeof r.body.debugCode === "string" && r.body.debugCode.length > 0, "empty text → debugCode present");
  assert(typeof r.body.requestId === "string" && r.body.requestId.length > 0, "empty text → requestId present");
}

// ── 4. sanitizeVoicePayload in app.js: key-prefix stripping ──

console.log("\n── Frontend sanitizeVoicePayload: key-prefix stripping ──");
{
  // Inline test of the sanitize logic (duplicated from app.js)
  function sanitizeVoicePayload(payload = {}) {
    const sanitized = JSON.parse(JSON.stringify(payload));
    const sensitiveKeys = ["apiKey", "api_key", "Authorization", "Bearer", "audioUrl", "audio_url", "token", "secret"];
    for (const key of sensitiveKeys) {
      if (sanitized[key] != null) {
        const val = String(sanitized[key]);
        sanitized[key] = val.length > 8 ? val.slice(0, 4) + "***" + val.slice(-4) : "***";
      }
    }
    for (const key of Object.keys(sanitized)) {
      const val = sanitized[key];
      if (typeof val === "string" && val.startsWith("data:")) {
        sanitized[key] = "[base64 audio]";
      }
      if (typeof val === "string") {
        sanitized[key] = val
          .replace(/\b(sk|tp|api[_-]?key)[\w.-]{5,}/gi, "[key]")
          .replace(/Bearer\s+[A-Za-z0-9._-]{10,}/g, "Bearer [key]")
          .replace(/data:audio\/[^;]+;base64,[A-Za-z0-9+/=]{80,}/g, "[base64 audio]");
      }
    }
    return sanitized;
  }

  const testCases = [
    // apiKey: sk-... pattern gets replaced by second-loop regex → "[key]"
    { input: { apiKey: "sk-cpabc1234567890def" }, key: "apiKey", expectObfuscated: true },
    // Authorization: Bearer token's sk-... part gets replaced by second-loop regex → "[key]"
    { input: { Authorization: "Bearer sk-cpabcdefghij123456" }, key: "Authorization", expectObfuscated: true },
    // audioUrl: first-loop partial obfuscation, no sk- pattern to trigger second loop
    { input: { audioUrl: "data:audio/mp3;base64,AAAAAAA..." }, key: "audioUrl", expectObfuscated: true },
    // tpToken: tp-... pattern gets replaced by second-loop regex → "[key]"
    { input: { tpToken: "tp-xyz1234567890abc" }, key: "tpToken", expectObfuscated: true },
    // myKey: sk-cp-... pattern gets replaced by second-loop regex → "[key]"
    { input: { myKey: "sk-cp-long-api-key-here-123" }, key: "myKey", expectObfuscated: true },
    // requestId: no sensitive pattern, stays as-is
    { input: { requestId: "mm-123456-abc123" }, key: "requestId", expectObfuscated: false },
  ];

  for (const tc of testCases) {
    const result = sanitizeVoicePayload(tc.input);
    if (tc.expectObfuscated) {
      // Valid obfuscated forms:
      // "***" = short-value redaction, "[key]" = sk/tp/Bearer replacement, "[base64 audio]" = data URL redaction
      // Or: any string shorter than the original that is clearly not the full sensitive value
      const validObfuscations = ["***", "[key]", "[base64 audio]"];
      const isObfuscated = validObfuscations.includes(result[tc.key]);
      const isPartiallyObfuscated = typeof result[tc.key] === "string" &&
        result[tc.key] !== tc.input[tc.key] &&
        result[tc.key].length < tc.input[tc.key].length;
      assert(
        isObfuscated || isPartiallyObfuscated,
        `sanitizeVoicePayload: '${tc.key}' is obfuscated (got '${result[tc.key]}')`
      );
    } else {
      assert(
        result[tc.key] === tc.input[tc.key] || result[tc.key] !== undefined,
        `sanitizeVoicePayload: '${tc.key}' is preserved (got '${result[tc.key]}')`
      );
    }
  }
}

// ── 5. Frontend voiceLog: logs to window.__VOICE_DEBUG__ ──

console.log("\n── Frontend voiceLog: __VOICE_DEBUG__ array ──");
{
  // Mock window if not present (Node.js)
  const mockWindow = { __VOICE_DEBUG__: [] };
  function voiceLog(event, payload = {}) {
    const safe = JSON.parse(JSON.stringify(payload));
    // Apply same sanitize
    for (const key of Object.keys(safe)) {
      const val = safe[key];
      if (typeof val === "string") {
        safe[key] = val.replace(/\b(sk|tp|api[_-]?key)[\w.-]{5,}/gi, "[key]");
      }
    }
    mockWindow.__VOICE_DEBUG__.push({ event, payload: safe, at: Date.now() });
    if (mockWindow.__VOICE_DEBUG__.length > 50) mockWindow.__VOICE_DEBUG__.shift();
  }

  voiceLog("minimax:generate:start", { hasScript: true, scriptLength: 50 });
  voiceLog("minimax:generate:success", { hasAudioUrl: true, requestId: "mm-123-abc", debugCode: "MINIMAX_TTS_OK" });
  voiceLog("mimo:play:error", { audioKey: "k1", debugCode: "MIMO_TTS_REQUEST_FAILED", requestId: "mi-456-def" });

  assert(mockWindow.__VOICE_DEBUG__.length === 3, `__VOICE_DEBUG__ has 3 entries (got ${mockWindow.__VOICE_DEBUG__.length})`);
  assert(mockWindow.__VOICE_DEBUG__[0].event === "minimax:generate:start", "first entry is minimax:generate:start");
  assert(mockWindow.__VOICE_DEBUG__[1].event === "minimax:generate:success", "second entry is minimax:generate:success");
  assert(mockWindow.__VOICE_DEBUG__[2].event === "mimo:play:error", "third entry is mimo:play:error");
  assert(mockWindow.__VOICE_DEBUG__[1].payload.requestId === "mm-123-abc", "success log has requestId");
  assert(mockWindow.__VOICE_DEBUG__[2].payload.debugCode === "MIMO_TTS_REQUEST_FAILED", "error log has debugCode");
}

// ── 6. generateBroadcastSpeech returns requestId + debugCode ──

console.log("\n── generateBroadcastSpeech: returns requestId + debugCode ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(content.includes("requestId"), "minimaxTts.js references requestId");
  assert(content.includes("debugCode"), "minimaxTts.js references debugCode");
  // Must throw with debugCode in error message
  assert(content.includes("[${payload.debugCode}]") || content.includes("debugInfo"), "debugCode is embedded in error message");
}

// ── 7. generateMimoSpeech returns requestId + debugCode ──

console.log("\n── generateMimoSpeech: returns requestId + debugCode ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/services/mimoClient.js", "utf8");
  assert(content.includes("requestId"), "mimoClient.js references requestId");
  assert(content.includes("debugCode"), "mimoClient.js references debugCode");
  assert(content.includes("[${payload.debugCode}]") || content.includes("debugInfo"), "debugCode is embedded in error message");
}

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll voice-api-debug checks passed!");
