// Voice handler self-call check — verifies no handlers.xxx self-calls in app.js
import { readFileSync } from "fs";
import { resolve } from "path";

const APP_JS = resolve(import.meta.dirname, "../src/app.js");
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

console.log("\n── Voice handler self-call checks ──");

// 1-4: No handlers.xxx self-calls in app.js
assert(
  !appContent.includes("handlers.onPlayTts("),
  "app.js: no handlers.onPlayTts() call"
);
assert(
  !appContent.includes("handlers.onPauseTts("),
  "app.js: no handlers.onPauseTts() call"
);
assert(
  !appContent.includes("handlers.onPauseMimoTts("),
  "app.js: no handlers.onPauseMimoTts() call"
);
assert(
  !appContent.includes("handlers.onResumeMimoTts("),
  "app.js: no handlers.onResumeMimoTts() call"
);

// 5: onGenerateTts success calls playBroadcastAudio()
const onGenerateMatch = appContent.match(/onGenerateTts:[^{]*\{[\s\S]*?render\(\)[\s\S]*?\}\s*catch/g);
const hasPlayBroadcastAfterSuccess = /render\(\)[^}]*playBroadcastAudio\(\)/.test(
  appContent.slice(appContent.indexOf("onGenerateTts:"), appContent.indexOf("onGenerateTts:") + 3000)
);
assert(hasPlayBroadcastAfterSuccess, "onGenerateTts success calls playBroadcastAudio()");

// 6: onPlayTts calls playBroadcastAudio()
const onPlayTtsBody = appContent.match(/onPlayTts:\s*\([^)]*\)\s*=>\s*\{([^}]+)\}/)?.[1] ?? "";
assert(
  onPlayTtsBody.trim() === "playBroadcastAudio();" || onPlayTtsBody.includes("playBroadcastAudio()"),
  "onPlayTts calls playBroadcastAudio()"
);

// 7: onPauseTts calls pauseBroadcastAudio()
const onPauseTtsBody = appContent.match(/onPauseTts:\s*\([^)]*\)\s*=>\s*\{([^}]+)\}/)?.[1] ?? "";
assert(
  onPauseTtsBody.trim() === "pauseBroadcastAudio();" || onPauseTtsBody.includes("pauseBroadcastAudio()"),
  "onPauseTts calls pauseBroadcastAudio()"
);

// 8: onPlayMimoTts does not pass voice="default"
assert(
  !appContent.includes('voice: "default"') && !appContent.includes("voice: 'default'"),
  "onPlayMimoTts: no voice='default' parameter"
);

// 9: playMimoAudio catch reads currentEntry from uiState (not stale closure)
const playMimoCatchRegion = appContent.slice(
  appContent.indexOf("audio.play().catch"),
  appContent.indexOf("audio.play().catch") + 400
);
assert(
  playMimoCatchRegion.includes("currentEntry") || playMimoCatchRegion.includes("uiState.ttsAudios[audioKey]"),
  "playMimoAudio catch reads entry from uiState (not closure variable)"
);

// 10: generateMimoSpeech call exists
assert(
  appContent.includes("generateMimoSpeech({"),
  "generateMimoSpeech call present"
);

// 11: MiniMax endpoint not changed
assert(
  appContent.includes("/api/minimax/tts") || appContent.includes("MINIMAX_TTS"),
  "MiniMax TTS endpoint/reference unchanged"
);

// 12: MiMo endpoint not changed
assert(
  appContent.includes("/api/mimo/tts") || appContent.includes("MIMO_TTS"),
  "MiMo TTS endpoint/reference unchanged"
);

// 13: No API key leakage
const apiKeyPattern = /sk-cp-|apiKey.*sk-|MIMO_API_KEY=|Bearer [A-Za-z0-9._-]{20,}|tp-[A-Za-z0-9._-]{10,}|sk-[A-Za-z0-9._-]{10,}/;
assert(
  !apiKeyPattern.test(appContent),
  "app.js: no API key literals"
);

// 14: No base64 audio
assert(
  !/data:audio\/[^;]+;base64,[A-Za-z0-9+/=]{80,}/.test(appContent),
  "app.js: no base64 audio data"
);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\nAll voice handler self-call checks passed!");
