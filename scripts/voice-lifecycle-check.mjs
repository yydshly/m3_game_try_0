// Voice lifecycle check — verifies audio state machine correctness
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

console.log("\n── Voice lifecycle checks ──");

// Helper: extract function body by name
function getFnBody(name) {
  const fnStart = appContent.indexOf(`function ${name}(`);
  if (fnStart === -1) return "";
  // Skip to after the opening parenthesis
  let i = fnStart + `function ${name}(`.length;
  // Track depth through parentheses (handles default params like options = {})
  let parenDepth = 0;
  for (; i < appContent.length; i++) {
    if (appContent[i] === "(") parenDepth++;
    else if (appContent[i] === ")") {
      parenDepth--;
      if (parenDepth === 0) { i++; break; }
    }
  }
  // Now count braces from the position after the closing )
  let braceDepth = 0;
  let bodyStart = i;
  for (; i < appContent.length; i++) {
    if (appContent[i] === "{") {
      if (braceDepth === 0) bodyStart = i + 1;
      braceDepth++;
    } else if (appContent[i] === "}") {
      braceDepth--;
      if (braceDepth === 0) {
        return appContent.slice(fnStart, i + 1);
      }
    }
  }
  return appContent.slice(fnStart, bodyStart + 400);
}

// Helper: extract handler body by name (arrow function in handlers object)
function getHandlerBody(name) {
  const marker = `${name}: (`;
  const start = appContent.indexOf(marker);
  if (start === -1) return "";
  // Find the opening brace of the arrow function body
  let braceStart = -1;
  let depth = 0;
  for (let i = start + marker.length; i < appContent.length; i++) {
    if (appContent[i] === "{") { braceStart = i + 1; break; }
  }
  if (braceStart === -1) return "";
  let end = braceStart;
  for (let i = braceStart; i < appContent.length; i++) {
    if (appContent[i] === "{") depth++;
    else if (appContent[i] === "}") {
      if (depth === 0) { end = i; break; }
      depth--;
    }
  }
  return appContent.slice(braceStart, end);
}

// 1-3. stopAllMimoAudio updates ttsAudios
const stopAllFn = getFnBody("stopAllMimoAudio");
assert(stopAllFn.includes("ttsAudios"), "stopAllMimoAudio: updates ttsAudios status");
assert(stopAllFn.includes("nextTtsAudios"), "stopAllMimoAudio: builds nextTtsAudios");
assert(stopAllFn.includes("exceptKey"), "stopAllMimoAudio: supports exceptKey option");
assert(stopAllFn.includes("if (exceptKey && key === exceptKey)"), "stopAllMimoAudio: skips exceptKey in loop");
assert(stopAllFn.includes("render()"), "stopAllMimoAudio: calls render() after state sync");

// 4. stopBroadcastAudio exists and syncs state
const stopBroadcastFn = getFnBody("stopBroadcastAudio");
assert(stopBroadcastFn.length > 0, "stopBroadcastAudio: function exists");
assert(stopBroadcastFn.includes("broadcastAudio:"), "stopBroadcastAudio: updates broadcastAudio state");
assert(stopBroadcastFn.includes("render()"), "stopBroadcastAudio: calls render()");

// 5. stopActiveAudio no longer exists
assert(
  !appContent.includes("function stopActiveAudio("),
  "stopActiveAudio: function removed (replaced by stopBroadcastAudio)"
);
assert(
  !appContent.match(/stopActiveAudio\(\)/),
  "stopActiveAudio: no calls remain"
);

// 6. onPlayMimoTts reads existing BEFORE stopping other audio
const onPlayMimoBody = getHandlerBody("onPlayMimoTts");
assert(onPlayMimoBody.length > 0, "onPlayMimoTts: handler found");
const existingIdx = onPlayMimoBody.indexOf("existing = uiState.ttsAudios[audioKey]");
const stopAllIdx = onPlayMimoBody.indexOf("stopAllMimoAudio(");
assert(existingIdx !== -1, "onPlayMimoTts: reads existing from ttsAudios");
if (existingIdx !== -1 && stopAllIdx !== -1) {
  assert(existingIdx < stopAllIdx, "onPlayMimoTts: reads existing BEFORE calling stopAllMimoAudio");
}

// 7. existing.status === "playing" → pause, not skip
assert(
  onPlayMimoBody.includes('existing?.status === "playing"') ||
  onPlayMimoBody.includes("existing?.status === 'playing'"),
  "onPlayMimoTts: checks existing status === playing"
);
assert(
  onPlayMimoBody.includes("pauseMimoAudio") && !onPlayMimoBody.includes('"already-loading-or-playing"'),
  "onPlayMimoTts: playing status triggers pauseMimoAudio (not skip)"
);

// 8. existing.status === "paused" → resumeMimoAudio
assert(
  onPlayMimoBody.includes('existing?.status === "paused"') ||
  onPlayMimoBody.includes("existing?.status === 'paused'"),
  "onPlayMimoTts: checks existing status === paused"
);
assert(
  onPlayMimoBody.includes("resumeMimoAudio"),
  "onPlayMimoTts: paused status calls resumeMimoAudio"
);

// 9. existing.status === "ready" with same hash → playMimoAudio direct
assert(
  onPlayMimoBody.includes('existing?.status === "ready"') ||
  onPlayMimoBody.includes("existing?.status === 'ready'"),
  "onPlayMimoTts: checks existing status === ready"
);
assert(
  onPlayMimoBody.includes("playMimoAudio") && onPlayMimoBody.includes("existing.audioUrl"),
  "onPlayMimoTts: ready+same hash calls playMimoAudio directly (no API)"
);

// 10. playMimoAudio uses exceptKey when stopping others
const playMimoFn = getFnBody("playMimoAudio");
if (playMimoFn.includes("stopAllMimoAudio")) {
  assert(
    playMimoFn.includes("exceptKey"),
    "playMimoAudio: stopAllMimoAudio uses exceptKey (not unconditional)"
  );
} else {
  assert(true, "playMimoAudio: does not call unconditional stopAllMimoAudio");
}

// 11. pauseMimoAudio handles missing Audio
const pauseMimoFn = getFnBody("pauseMimoAudio");
assert(pauseMimoFn.includes("existing.status") || pauseMimoFn.includes("existing?.status"), "pauseMimoAudio: reads existing status");
assert(
  pauseMimoFn.includes('status: "paused"') || pauseMimoFn.includes("status: 'paused'"),
  "pauseMimoAudio: sets status to paused"
);

// 12. resumeMimoAudio recreates Audio if needed
const resumeMimoFn = getFnBody("resumeMimoAudio");
assert(resumeMimoFn.includes("playMimoAudio"), "resumeMimoAudio: calls playMimoAudio to recreate");
assert(
  resumeMimoFn.includes("activeMimoAudios.has") || resumeMimoFn.includes("!activeMimoAudios.has"),
  "resumeMimoAudio: checks if Audio instance exists before recreating"
);

// 13. MiniMax playBroadcastAudio stops MiMo
const playBroadcastFn = getFnBody("playBroadcastAudio");
assert(playBroadcastFn.includes("stopAllMimoAudio"), "playBroadcastAudio: stops all MiMo audio");
assert(playBroadcastFn.includes("stopBroadcastAudio"), "playBroadcastAudio: uses stopBroadcastAudio (not stopActiveAudio)");

// 14. onVoiceStop uses stopBroadcastAudio
const onVoiceStopBody = getHandlerBody("onVoiceStop");
assert(
  onVoiceStopBody.includes("stopBroadcastAudio") || onVoiceStopBody.includes("stopAllMimoAudio"),
  "onVoiceStop: uses stopBroadcastAudio/stopAllMimoAudio"
);

// 15. onVoicePause uses internal functions (not handlers.xxx)
const onVoicePauseBody = getHandlerBody("onVoicePause");
assert(
  !onVoicePauseBody.includes("handlers."),
  "onVoicePause: no handler self-calls"
);
const onVoiceResumeBody = getHandlerBody("onVoiceResume");
assert(
  !onVoiceResumeBody.includes("handlers."),
  "onVoiceResume: no handler self-calls"
);

// 16. No API key / base64 leakage
const apiKeyPattern = /sk-cp-|tp-[a-z0-9]{10,}|data:audio\/[^;]+;base64,[A-Za-z0-9+/=]{80,}/;
assert(!apiKeyPattern.test(appContent), "app.js: no API key literals or base64 audio");

// 17. MiMo endpoint unchanged (generateMimoSpeech still imported and called)
assert(
  appContent.includes("generateMimoSpeech"),
  "MiMo generateMimoSpeech still used (endpoint unchanged)"
);

// 18. MiniMax endpoint unchanged (generateBroadcastSpeech still imported)
assert(
  appContent.includes("generateBroadcastSpeech"),
  "MiniMax generateBroadcastSpeech still used (endpoint unchanged)"
);

// 19. playBroadcastAudio sets currentVoicePlayback to minimax provider
assert(
  playBroadcastFn.includes('provider: "minimax"') || playBroadcastFn.includes("provider: 'minimax'"),
  "playBroadcastAudio: currentVoicePlayback provider = minimax"
);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\nAll voice lifecycle checks passed!");
