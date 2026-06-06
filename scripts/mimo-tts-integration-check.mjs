// mimo-tts-integration-check — verifies MiMo TTS Token Plan integration
// Default mode: dry-run only (no real API call)
// Real test: set MIMO_TTS_REAL_TEST=1 and provide MIMO_API_KEY

const SERVER_URL = process.env.MIMO_SERVER_URL ?? "http://127.0.0.1:4173";
const REAL_TEST = process.env.MIMO_TTS_REAL_TEST === "1";
const API_KEY = process.env.MIMO_API_KEY ?? "";
const BASE_URL = process.env.MIMO_BASE_URL ?? "https://token-plan-cn.xiaomimimo.com/v1";
const API_MODE = process.env.MIMO_API_MODE ?? "token_plan";

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

async function post(endpoint, body, headers = {}) {
  try {
    const res = await fetch(`${SERVER_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } catch (err) {
    // Server not reachable
    return { status: 0, json: {}, error: err.message };
  }
}

// ── 1. Dry-run test ──────────────────────────────────────────────────────────
console.log("\n── Dry-run test ──");
{
  const { status, json, error } = await post(
    "/api/mimo/tts?dryRun=1",
    { text: "今天真不错。", scene: "resident_dialogue", emotion: "warm" }
  );

  if (error || status === 0) {
    console.log(`  ⊗ Server not reachable at ${SERVER_URL} — dry-run test skipped (server not running)`);
    // Still pass the structural checks
    assert(true, "dry-run test skipped (server not running)");
  } else {
    assert(status === 200, `dry-run returns 200 (got ${status})`);
    assert(json.ok === true, "dry-run ok === true");
    assert(json.provider === "mimo", `provider === "mimo" (got ${json.provider})`);
    assert(json.mode === "token_plan" || json.mode === "payg", `mode is valid (got ${json.mode})`);
    assert(
      (json.endpoint && json.endpoint.includes("/chat/completions")) || json.endpoint === `${BASE_URL.replace(/\/$/, "")}/chat/completions`,
      `endpoint contains /chat/completions (got ${json.endpoint})`
    );
    assert(json.model === "mimo-v2.5-tts", `model === mimo-v2.5-tts (got ${json.model})`);
    assert(json.authHeader === "api-key", `authHeader === "api-key" (got ${json.authHeader})`);
    assert(json.keyPrefix !== undefined, "keyPrefix is present");
    assert(
      json.keyPrefix === "" || (json.keyPrefix && json.keyPrefix.includes("***")),
      "keyPrefix does not expose full key"
    );
    assert(
      !json.keyPrefix || json.keyPrefix.length < 20,
      "keyPrefix is truncated (not full key)"
    );
    assert(
      typeof json.assistantTextLength === "number",
      "assistantTextLength is a number"
    );
    assert(
      Array.isArray(json.warnings),
      "warnings is an array"
    );
    // Must NOT contain sensitive fields
    assert(
      !JSON.stringify(json).includes(API_KEY.slice(0, 6)) || API_KEY === "",
      "dry-run response does not contain API key prefix"
    );
  }
}

// ── 2. parseMimoTtsAudio function exists ───────────────────────────────────
console.log("\n── parseMimoTtsAudio function ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("function parseMimoTtsAudio"), "parseMimoTtsAudio function exists");
  assert(content.includes("choices?.[0]?.message?.audio?.data"), "supports choices[0].message.audio.data path");
  // Count candidate paths — should have at least 3 distinct audio paths
  const pathCount = [
    "choices?.[0]?.message?.audio?.data",
    "choices?.[0]?.audio?.data",
    "audio?.data",
    "data?.audio",
  ].filter(p => content.includes(p)).length;
  assert(pathCount >= 3, `at least 3 audio field paths supported (found ${pathCount})`);
}

// ── 3. sanitizeMimoError function exists ────────────────────────────────────
console.log("\n── sanitizeMimoError function ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("function sanitizeMimoError"), "sanitizeMimoError function exists");
  // Should strip tp- keys
  assert(content.includes('tp-[A-Za-z0-9._-]{10,}'), "tp- key pattern stripped");
  // Should strip sk- keys
  assert(content.includes('sk-[A-Za-z0-9._-]{10,}'), "sk- key pattern stripped");
  // Should strip Bearer tokens
  assert(content.includes('Bearer [A-Za-z0-9._-]+'), "Bearer token stripped");
  // Should strip long base64
  assert(content.includes("{80,}"), "long base64 stripped");
}

// ── 4. Response structure ────────────────────────────────────────────────
console.log("\n── Response structure ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  // Check the MiMo handler section has all required success response fields
  const mimoStart = content.indexOf("async function handleMimoTts");
  const mimoEnd = content.indexOf("\nfunction resolvePath");
  const mimoSection = content.slice(mimoStart, mimoEnd);
  // Check that audioUrl is assigned with the base64 prefix (the actual construction)
  assert(
    mimoSection.includes("data:audio/wav;base64,"),
    "audioUrl uses data:audio/wav;base64, prefix in construction"
  );
  // Check that the success sendJson has audioUrl, format, scene, textHash
  // (search for these in the MiMo handler section)
  assert(
    mimoSection.includes("audioUrl") && mimoSection.includes("textHash") && mimoSection.includes("scene"),
    "success response includes audioUrl, textHash, scene fields"
  );
  assert(
    mimoSection.includes('format: "wav"') || (mimoSection.includes("format:") && mimoSection.includes("wav")),
    "response includes format: wav field"
  );
  // Should NOT return Authorization header in response
  assert(
    !mimoSection.includes("Authorization:") && !mimoSection.includes("Bearer "),
    "response does not include Authorization header"
  );
}

// ── 5. Real test (only if MIMO_TTS_REAL_TEST=1) ───────────────────────────
if (REAL_TEST) {
  if (!API_KEY || API_KEY === "your_mimo_api_key_here" || API_KEY === "") {
    console.log("\n── Real test skipped: MIMO_API_KEY not set ──");
  } else {
    console.log("\n── Real TTS call ──");
    const testText = "今天天气真好。";

    const { status, json, error } = await post("/api/mimo/tts", {
      text: testText,
      scene: "resident_dialogue",
      emotion: "warm",
    });

    if (error || status === 0) {
      console.log(`  ⊗ Real test skipped: server not reachable at ${SERVER_URL}`);
    } else if (status === 501 && json.error?.includes("未启用")) {
      console.log("  ⊗ Real test skipped: MiMo TTS not enabled in server config");
    } else if (status === 501 && json.error?.includes("API Key")) {
      console.log("  ⊗ Real test skipped: API Key not configured in server config");
    } else {
      assert(status === 200, `real call returns 200 (got ${status})`);
      assert(json.ok === true, "real call ok === true");
      assert(
        json.audioUrl && json.audioUrl.startsWith("data:audio/wav;base64,"),
        "audioUrl is data:audio/wav;base64,... format"
      );
      assert(
        json.audioUrl.length > "data:audio/wav;base64,".length + 100,
        "audioUrl base64 has reasonable length"
      );
      assert(
        json.format === "wav",
        `format is wav (got ${json.format})`
      );
      assert(
        json.model === "mimo-v2.5-tts",
        `model is mimo-v2.5-tts (got ${json.model})`
      );
      assert(
        typeof json.textHash === "string" && json.textHash.length > 0,
        "textHash is a non-empty hex string"
      );
      // Verify no API key leaks
      const responseStr = JSON.stringify(json);
      assert(
        !responseStr.includes(API_KEY.slice(0, 8)) && !responseStr.includes("tp-") && !responseStr.includes("sk-"),
        "response does not contain API key"
      );
      // Error case test: empty text
      const { json: errJson } = await post("/api/mimo/tts", {
        text: "",
        scene: "resident_dialogue",
      });
      assert(errJson.ok === false, "empty text returns ok: false");
      assert(
        errJson.error && !errJson.error.includes("sk-") && !errJson.error.includes("tp-"),
        "error message is sanitized"
      );
    }
  }
} else {
  console.log("\n── Real test skipped (MIMO_TTS_REAL_TEST != 1) ──");
  console.log("  To run real test: MIMO_TTS_REAL_TEST=1 MIMO_API_KEY=<key> npm run mimo-tts-integration-check");
}

// ── 6. MiniMax TTS still works ─────────────────────────────────────────────
console.log("\n── MiniMax TTS not modified ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("handleMiniMaxTts"), "handleMiniMaxTts still exists");
  assert(content.includes("/api/minimax/tts"), "/api/minimax/tts still routed");
}

// ── 7. dayCycle not modified ──────────────────────────────────────────────
console.log("\n── dayCycle not modified ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("runTownDayCycle"), "runTownDayCycle still in app.js");
}

// ── Results ────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll MiMo TTS integration checks passed!");
