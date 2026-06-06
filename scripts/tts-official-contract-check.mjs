// tts-official-contract-check — validates TTS payloads match official API contracts
// Checks MiniMax t2a_v2 and MiMo speech-synthesis-v2.5 payload shapes

const SERVER_URL = process.env.MIMO_SERVER_URL ?? "http://127.0.0.1:4173";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); }
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
}

async function api(path, body = {}) {
  try {
    const res = await fetch(`${SERVER_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } catch {
    return { status: 0, json: {} };
  }
}

// ── 1. MiMo top-level payload keys only model/messages/audio ───────────────

console.log("\n── MiMo payload: top-level keys ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("async function handleMimoTts")[1]?.split("\nfunction resolvePath")[0] ?? "";

  const payloadMatch = fn.match(/const chatPayload\s*=\s*\{[\s\S]*?\};?\s*(?:try\s*\{)/);
  if (payloadMatch) {
    const payloadCode = payloadMatch[0];
    // Find top-level keys using brace-depth tracking.
    // Strategy: scan character by character, but only update depth AFTER checking
    // the current line for keys. This ensures "}, audio: {" works correctly:
    // depth is still 1 when we check "},", so "audio: {" (next line) still has depth=1.
    const topLevelKeys = [];
    let depth = 0;
    const lines = payloadCode.split("\n");
    for (const rawLine of lines) {
      const trimmed = rawLine.trimStart();
      // Check for keys BEFORE updating depth
      if (depth === 1) {
        const m = trimmed.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/);
        if (m) topLevelKeys.push(m[1]);
      }
      // Then update depth for braces on this line
      for (const ch of trimmed) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
    }
    console.log(`    top-level keys: ${JSON.stringify(topLevelKeys)}`);
    assert(
      topLevelKeys.length === 3 && topLevelKeys.includes("model") && topLevelKeys.includes("messages") && topLevelKeys.includes("audio"),
      `only model/messages/audio at top level (found: ${JSON.stringify(topLevelKeys)})`
    );
    assert(!topLevelKeys.includes("scene"), "no scene at top level");
    assert(!topLevelKeys.includes("emotion"), "no emotion at top level");
    assert(!topLevelKeys.includes("speed"), "no speed at top level");
    assert(!topLevelKeys.includes("metadata"), "no metadata at top level");
    assert(!topLevelKeys.includes("text"), "no text at top level");
  } else {
    assert(false, "could not find chatPayload construction");
  }
}

// ── 2. MiMo messages[0].role = "user" ───────────────────────────────────

console.log("\n── MiMo messages[0].role = 'user' ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("async function handleMimoTts")[1]?.split("\nfunction resolvePath")[0] ?? "";
  assert(
    fn.includes('role: "user"') || fn.includes("role: 'user'"),
    "messages[0] uses role: 'user' for style instruction"
  );
}

// ── 3. MiMo messages[1].role = "assistant" ─────────────────────────────

console.log("\n── MiMo messages[1].role = 'assistant' ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("async function handleMimoTts")[1]?.split("\nfunction resolvePath")[0] ?? "";
  assert(
    fn.includes('role: "assistant"') || fn.includes("role: 'assistant'"),
    "messages[1] uses role: 'assistant' for TTS text"
  );
}

// ── 4. MiMo audio.voice default = mimo_default ───────────────────────────

console.log("\n── MiMo audio.voice default = mimo_default ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("async function handleMimoTts")[1]?.split("\nfunction resolvePath")[0] ?? "";
  assert(
    fn.includes("mimo_default"),
    "audio.voice defaults to mimo_default"
  );
}

// ── 5. MiMo audio.format default = wav ─────────────────────────────────

console.log("\n── MiMo audio.format default = wav ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("async function handleMimoTts")[1]?.split("\nfunction resolvePath")[0] ?? "";
  assert(
    fn.includes('format: "wav"') || fn.includes("format: 'wav'"),
    "audio.format defaults to wav"
  );
}

// ── 6. MiMo scene/emotion/speed/metadata/text not in chatPayload ───────

console.log("\n── MiMo scene/emotion/speed/metadata/text not in chatPayload ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("async function handleMimoTts")[1]?.split("\nfunction resolvePath")[0] ?? "";
  const jsonStrIdx = fn.indexOf("JSON.stringify(chatPayload)");
  if (jsonStrIdx > 0) {
    const beforeJson = fn.slice(0, jsonStrIdx);
    const payloadStart = beforeJson.lastIndexOf("const chatPayload");
    const payloadBlock = beforeJson.slice(payloadStart);
    assert(!payloadBlock.includes("scene:"), "scene not in chatPayload");
    assert(!payloadBlock.includes("emotion:"), "emotion not in chatPayload");
    assert(!payloadBlock.includes("speed:"), "speed not in chatPayload");
    assert(!payloadBlock.includes("metadata:"), "metadata not in chatPayload");
    assert(!payloadBlock.includes("text:"), "text not in chatPayload");
  }
}

// ── 7. MiMo parse choices[0].message.audio.data ─────────────────────────

console.log("\n── MiMo parse: choices[0].message.audio.data ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(
    content.includes("choices[0]?.message?.audio?.data") || content.includes("choices?.[0]?.message?.audio?.data"),
    "parses choices[0].message.audio.data"
  );
}

// ── 8. MiniMax endpoint = /v1/t2a_v2 ────────────────────────────────────

console.log("\n── MiniMax endpoint = /v1/t2a_v2 ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("async function handleMiniMaxTts")[1]?.split("\n// ── MiMo TTS")[0] ?? "";
  assert(
    fn.includes("t2a_v2") && fn.includes("api.minimaxi.com"),
    "MiniMax uses https://api.minimaxi.com/v1/t2a_v2"
  );
}

// ── 9. MiniMax uses Authorization Bearer ─────────────────────────────────

console.log("\n── MiniMax uses Authorization Bearer ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("async function handleMiniMaxTts")[1]?.split("\n// ── MiMo TTS")[0] ?? "";
  assert(
    fn.includes("Authorization:") && fn.includes("Bearer"),
    "MiniMax uses Authorization: Bearer"
  );
}

// ── 10. MiniMax data.audio as hex ────────────────────────────────────────

console.log("\n── MiniMax data.audio as hex ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("async function handleMiniMaxTts")[1]?.split("\n// ── MiMo TTS")[0] ?? "";
  assert(fn.includes('Buffer.from(audioHex, "hex")'), "MiniMax hex audio decoded via Buffer.from(hex)");
  assert(fn.includes("data:audio/"), "MiniMax audioUrl constructed as data:audio/");
}

// ── 11. MiniMax success: onGenerateTts catch uses serverDebugCode first ─

console.log("\n── MiniMax success: catch uses serverDebugCode before REQUEST_FAILED ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  // Find the onGenerateTts catch block: it contains "serverDebugCode" and ends
  // just before "onPlayTts:". Use CRLF-safe pattern matching.
  const catchMarker = "// Categorize MiniMax TTS errors for dev debugging";
  const catchMarkerIdx = content.indexOf(catchMarker);
  const onGenerateTtsStart = content.lastIndexOf("} catch (error) {", catchMarkerIdx);
  const onPlayTtsIdx = content.indexOf("onPlayTts:", onGenerateTtsStart);
  const catchBlock = onGenerateTtsStart > 0 && onPlayTtsIdx > 0
    ? content.slice(onGenerateTtsStart, onPlayTtsIdx)
    : "";
  assert(catchBlock.length > 0, "onGenerateTts catch block found");
  assert(catchBlock.includes("serverDebugCode"), "catch block extracts serverDebugCode from error message");
  assert(
    catchBlock.includes("MINIMAX_TTS_REQUEST_FAILED"),
    "MINIMAX_TTS_REQUEST_FAILED still used for true network errors"
  );
  const reqFailedIdx = catchBlock.indexOf('"MINIMAX_TTS_REQUEST_FAILED"');
  const serverIdx = catchBlock.indexOf("serverDebugCode");
  if (reqFailedIdx > 0 && serverIdx > 0) {
    assert(serverIdx < reqFailedIdx, "serverDebugCode checked before falling through to REQUEST_FAILED");
  }
}

// ── 12. No API Key / base64 in TTS responses ───────────────────────────

console.log("\n── No API Key / base64 in TTS responses ──");
{
  // MiniMax TTS — check no full sk-cp- key
  const { json: mmJson } = await api("/api/minimax/tts", { text: "小镇广播测试。" });
  const mmRaw = JSON.stringify(mmJson);
  assert(
    !mmRaw.includes("sk-cp-31q"),
    "MiniMax response has no full sk-cp- key prefix"
  );
  assert(
    !mmRaw.includes("sk-cp-31qlf5SGB3w5ZPHbn"),
    "MiniMax response has no full API key"
  );

  // MiMo dry-run — check no full tp- key
  const { json: mimoJson } = await api("/api/mimo/tts?dryRun=1", { text: "测试。" });
  const mimoRaw = JSON.stringify(mimoJson);
  assert(
    !mimoRaw.includes("tp-ca63efflojsb8ogx37"),
    "MiMo dry-run response has no full tp- key"
  );
  assert(
    !mimoRaw.includes("data:audio"),
    "MiMo dry-run response has no data:audio"
  );
}

// ── 13. MiniMax audio hex→base64→data:audio conversion ───────────────────

console.log("\n── MiniMax audio hex→base64→data:audio conversion ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("async function handleMiniMaxTts")[1]?.split("\n// ── MiMo TTS")[0] ?? "";
  assert(fn.includes("Buffer.from(audioHex, "), "hex audio decoded via Buffer.from");
  assert(fn.includes('.toString("base64")'), "audio converted to base64");
  assert(fn.includes("data:audio/"), "audioUrl constructed as data:audio/");
}

// ── 14. MiMo upstream uses api-key header (not Bearer) ────────────────

console.log("\n── MiMo upstream uses api-key header ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("async function handleMimoTts")[1]?.split("\nfunction resolvePath")[0] ?? "";
  assert(
    fn.includes('"api-key"') || fn.includes("'api-key'"),
    "MiMo upstream uses 'api-key' header"
  );
  assert(!fn.includes("Bearer"), "MiMo upstream does NOT use Bearer");
}

// ── 15. MiniMax play: onerror = AUDIO_PLAY_FAILED, autoplay = AUTOPLAY_FAILED ──

console.log("\n── MiniMax play: debugCode on error / blocked ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");

  assert(
    content.includes("MINIMAX_TTS_AUDIO_PLAY_FAILED"),
    "MINIMAX_TTS_AUDIO_PLAY_FAILED is defined in app.js"
  );

  // onerror block
  const onerrorIdx = content.indexOf("activeAudio.onerror = () => {");
  assert(onerrorIdx > 0, "activeAudio.onerror callback found in onPlayTts");
  const nextPlayCatch = content.indexOf("activeAudio.play().catch(", onerrorIdx);
  assert(nextPlayCatch > onerrorIdx, "play().catch found after onerror");
  const onerrorBlock = content.slice(onerrorIdx, nextPlayCatch);
  assert(
    onerrorBlock.includes("MINIMAX_TTS_AUDIO_PLAY_FAILED"),
    "onerror sets MINIMAX_TTS_AUDIO_PLAY_FAILED"
  );

  // play().catch() block
  const playCatchIdx = content.indexOf("activeAudio.play().catch(");
  assert(playCatchIdx > 0, "play().catch found");
  const afterCatch = content.slice(playCatchIdx);
  const renderIdx = afterCatch.indexOf("render();");
  assert(renderIdx > 0, "render(); found after play().catch(");
  const playCatchBlock = afterCatch.slice(0, renderIdx + "render();".length);
  assert(
    playCatchBlock.includes("MINIMAX_TTS_AUTOPLAY_FAILED"),
    "autoplay blocked sets MINIMAX_TTS_AUTOPLAY_FAILED"
  );
  assert(
    playCatchBlock.includes('status: "paused"'),
    "autoplay blocked status is 'paused' (not 'error')"
  );
}

// ── Results ────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll TTS official contract checks passed!");
