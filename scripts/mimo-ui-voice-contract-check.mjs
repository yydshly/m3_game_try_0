// MiMo UI voice contract check — verifies MiMo TTS UI requests use valid voice params
import { readFileSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const MIMO_CLIENT = resolve(import.meta.dirname, "../src/services/mimoClient.js");
const SERVER_MJS = resolve(import.meta.dirname, "./server.mjs");
const RENDER_JS = resolve(import.meta.dirname, "../src/ui/render.js");
const APP_JS = resolve(import.meta.dirname, "../src/app.js");

const mimoClientContent = readFileSync(MIMO_CLIENT, "utf8");
const serverContent = readFileSync(SERVER_MJS, "utf8");
const renderContent = readFileSync(RENDER_JS, "utf8");
const appContent = readFileSync(APP_JS, "utf8");

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

console.log("\n── MiMo UI voice contract checks ──");

// 1. mimoClient.js: no voice: "default"
assert(
  !mimoClientContent.includes('voice: "default"') && !mimoClientContent.includes("voice: 'default'"),
  "mimoClient.js: no voice='default' in request body"
);

// 2. mimoClient.js: voice is optional in the request body
// When voice is falsy/empty, it should NOT be added to requestBody
const hasVoiceOptionalLogic =
  mimoClientContent.includes("if (voice && String(voice).trim())") ||
  mimoClientContent.includes("if (voice)");
assert(hasVoiceOptionalLogic, "mimoClient.js: voice is optional (only added when provided)");

// 3. Server-side normalization: voice=default → mimoVoiceId
const fn = serverContent.split("handleMimoTts")[1]?.split("function resolvePath")[0] ?? "";
assert(
  fn.includes('rawVoice === "default"') || fn.includes("rawVoice === 'default'"),
  "server: normalizes voice='default' to server default"
);
assert(
  fn.includes("mimoVoiceId") && fn.includes("rawVoice === \"default\""),
  "server: fallback to mimoVoiceId when voice='default'"
);

// 4. mimo_default / wav probe params still in server
assert(
  serverContent.includes("mimo_default") || serverContent.includes("mimo-v2.5-tts"),
  "server: mimo_default / model probe params preserved"
);
assert(
  serverContent.includes('format: "wav"') || serverContent.includes("format: 'wav'") || serverContent.includes('"wav"'),
  "server: wav format preserved"
);

// 5. Playback chip error rendering: uses cvp.error not '正在播放'
// The chip uses: status === "error" ? (cvp.error || "播放失败") : ""
// The old bug was showing "正在播放" even when status === "error"
const chipErrorPattern = renderContent.includes("cvp.error || \"播放失败\"") ||
  renderContent.includes("cvp.error || '播放失败'");
assert(
  chipErrorPattern,
  "render.js: chip uses cvp.error for error status (not '正在播放')"
);
assert(
  !renderContent.match(/正在播放[：:]/)?.[0] || renderContent.includes("paused:"),
  "render.js: '正在播放' only shown for playing/paused status, not error"
);

// 6. MiMo endpoint unchanged
assert(
  serverContent.includes("/chat/completions"),
  "server: MiMo endpoint still /chat/completions (Token Plan)"
);

// 7. MiniMax endpoint unchanged
assert(
  serverContent.includes("/v1/t2a_v2") || serverContent.includes("MINIMAX_TTS"),
  "server: MiniMax TTS endpoint reference unchanged"
);

// 8. No API key leakage in mimoClient.js
const apiKeyPattern = /sk-cp-|tp-[a-z0-9]{10,}|mimoApiKey\s*=/;
assert(
  !apiKeyPattern.test(mimoClientContent),
  "mimoClient.js: no API key literals"
);

// 9. No base64 audio in mimoClient.js
assert(
  !/data:audio\/[^;]+;base64,[A-Za-z0-9+/=]{80,}/.test(mimoClientContent),
  "mimoClient.js: no base64 audio data"
);

// 10. generateMimoSpeech call in app.js still uses emotion/speed (not voice=default)
const onPlayMimoSection = appContent.match(/onPlayMimoTts:\s*\([\s\S]*?\n\s{6}\}/)?.[0] ?? "";
assert(
  !onPlayMimoSection.includes('voice: "default"') && !onPlayMimoSection.includes("voice: 'default'"),
  "app.js onPlayMimoTts: no voice='default' parameter passed to generateMimoSpeech"
);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\nAll MiMo UI voice contract checks passed!");
