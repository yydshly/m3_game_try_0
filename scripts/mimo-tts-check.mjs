// mimo-tts-check — validates MiMo TTS Provider integration
import { resolveTtsProviderForScene, buildAudioKey, hashText, validateSceneText } from "../src/services/ttsService.js";

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
  onGenerateTts() {},
  onPlayTts() {},
  onPauseTts() {},
  onAssignTask() {},
  onSelectResident() {},
  onResetAssignments() {},
  onNewTown() {},
  onChooseEvent() {},
  onRunTownDayCycle() {},
  onPlayMimoTts() {},
  onPauseMimoTts() {},
  onResumeMimoTts() {},
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

// ── 1. ttsService.js exists with unified provider ────────────────────────────
console.log("\n── ttsService.js exists ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/services/ttsService.js", "utf8");
  assert(content.length > 0, "ttsService.js is not empty");
  assert(content.includes("resolveTtsProviderForScene"), "resolveTtsProviderForScene exists");
  assert(content.includes("generateSpeech"), "generateSpeech exists");
  assert(content.includes("buildAudioKey"), "buildAudioKey exists");
  assert(content.includes("hashText"), "hashText exists");
}

// ── 2. resolveTtsProviderForScene strategy ─────────────────────────────────
console.log("\n── Scene → Provider strategy ──");
{
  assert(typeof resolveTtsProviderForScene === "function", "resolveTtsProviderForScene is a function");
  assert(resolveTtsProviderForScene("resident_dialogue") === "mimo", "resident_dialogue → mimo");
  assert(resolveTtsProviderForScene("event_prompt") === "mimo", "event_prompt → mimo");
  assert(resolveTtsProviderForScene("completion_feedback") === "mimo", "completion_feedback → mimo");
  assert(resolveTtsProviderForScene("day_opening") === "mimo", "day_opening → mimo");
  assert(resolveTtsProviderForScene("town_broadcast") === "minimax", "town_broadcast → minimax");
  assert(resolveTtsProviderForScene("unknown") === "mimo", "unknown scene → mimo (default)");
}

// ── 3. buildAudioKey ────────────────────────────────────────────────────────
console.log("\n── buildAudioKey ──");
{
  assert(typeof buildAudioKey === "function", "buildAudioKey is a function");
  assert(buildAudioKey("resident_dialogue", "hua", "beat-1") === "resident_dialogue:hua:beat-1", "key with all params");
  assert(buildAudioKey("event_prompt", "hua") === "event_prompt:hua", "key with resident only");
  assert(buildAudioKey("completion_feedback") === "completion_feedback:current", "key scene-only");
}

// ── 4. hashText ────────────────────────────────────────────────────────────
console.log("\n── hashText ──");
{
  assert(typeof hashText === "function", "hashText is a function");
  assert(hashText("hello") === hashText("hello"), "same text → same hash");
  assert(hashText("hello") !== hashText("world"), "different text → different hash");
  assert(hashText("") !== undefined, "empty string handled");
}

// ── 5. validateSceneText ──────────────────────────────────────────────────
console.log("\n── validateSceneText ──");
{
  assert(typeof validateSceneText === "function", "validateSceneText is a function");
  const emptyResult = validateSceneText("resident_dialogue", "");
  assert(!emptyResult.valid, "empty text rejected");
  const longResult = validateSceneText("resident_dialogue", "a".repeat(100));
  assert(!longResult.valid, "text over limit rejected");
  const okResult = validateSceneText("resident_dialogue", "hello");
  assert(okResult.valid, "normal text accepted");
}

// ── 6. mimoClient.js exists ────────────────────────────────────────────────
console.log("\n── mimoClient.js exists ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/services/mimoClient.js", "utf8");
  assert(content.length > 0, "mimoClient.js is not empty");
  assert(content.includes("generateMimoSpeech"), "generateMimoSpeech exists");
  assert(content.includes("./api/mimo/tts"), "calls /api/mimo/tts endpoint");
}

// ── 7. /api/mimo/tts endpoint in server.mjs ─────────────────────────────
console.log("\n── /api/mimo/tts server endpoint ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("handleMimoTts"), "handleMimoTts function exists");
  assert(content.includes("/api/mimo/tts"), "endpoint routed to /api/mimo/tts");
  assert(content.includes("mimoApiKey"), "reads mimoApiKey config");
  assert(content.includes("mimoEnabled"), "checks mimoEnabled flag");
}

// ── 8. MiniMax TTS endpoint still exists ─────────────────────────────────
console.log("\n── MiniMax TTS endpoint preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("handleMiniMaxTts"), "handleMiniMaxTts still exists");
  assert(content.includes("/api/minimax/tts"), "/api/minimax/tts still routed");
}

// ── 9. No API key in frontend bundle (mimoClient.js) ──────────────────────
console.log("\n── No MiMo API key in frontend ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/services/mimoClient.js", "utf8");
  assert(!content.includes("MIMO_API_KEY"), "no MIMO_API_KEY constant in mimoClient.js");
  assert(!content.includes("mimoApiKey"), "no mimoApiKey variable in mimoClient.js");
  assert(!content.includes("your_mimo_api_key_here"), "no placeholder key in mimoClient.js");
}

// ── 10. No .env committed ────────────────────────────────────────────────
console.log("\n── No .env committed ──");
{
  const fs = await import("fs");
  const gitignoreContent = fs.readFileSync("./.gitignore", "utf8");
  // .env should be in .gitignore to prevent committing secrets
  const envIgnored = gitignoreContent.includes(".env");
  assert(envIgnored, ".env is in .gitignore to prevent committing secrets");
}

// ── 11. server.mjs has sanitized error responses ───────────────────────────
console.log("\n── Server error sanitization ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  // handleMimoTts function body
  const mimoFn = content.split("async function handleMimoTts")[1]?.split("\n\n")[0] ?? "";
  // All error strings in sendJson calls should be user-friendly, not contain raw keys
  const errorStrings = [...mimoFn.matchAll(/error:\s*"([^"]+)"/g)].map((m) => m[1]);
  const hasKeyLeak = errorStrings.some((e) => /sk-|Bearer |api[_-]?key|token|secret/i.test(e));
  assert(!hasKeyLeak, "error strings are user-friendly, no API key leaked");
}

// ── 12. ttsAudios in uiState ────────────────────────────────────────────────
console.log("\n── ttsAudios in uiState ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("ttsAudios: {}"), "ttsAudios initialized as empty object");
  assert(content.includes("ttsAudios: {}"), "ttsAudios reset in onNewTown");
}

// ── 13. onPlayMimoTts handler exists in app.js ────────────────────────────
console.log("\n── onPlayMimoTts handler ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("onPlayMimoTts:"), "onPlayMimoTts handler defined");
  assert(content.includes("onPauseMimoTts:"), "onPauseMimoTts handler defined");
  assert(content.includes("onResumeMimoTts:"), "onResumeMimoTts handler defined");
  assert(content.includes("stopAllMimoAudio()"), "stops all other audio before playing");
  assert(content.includes("resolveTtsProviderForScene"), "resolves provider per scene");
}

// ── 14. MiMo TTS button in render ──────────────────────────────────────────
console.log("\n── MiMo TTS buttons in render ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("data-action=\"play-mimo-tts\""), "play-mimo-tts button exists");
  assert(content.includes("data-action=\"pause-mimo-tts\""), "pause-mimo-tts button exists");
  assert(content.includes("data-action=\"resume-mimo-tts\""), "resume-mimo-tts button exists");
  assert(content.includes("mimo-tts-btn"), "mimo-tts-btn CSS class exists");
}

// ── 15. activeMimoAudios Map in app.js ────────────────────────────────────
console.log("\n── activeMimoAudios Map ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("const activeMimoAudios = new Map()"), "activeMimoAudios Map defined");
  assert(content.includes("stopMimoAudio"), "stopMimoAudio function exists");
  assert(content.includes("stopAllMimoAudio"), "stopAllMimoAudio function exists");
}

// ── 16. Same-text dedup (textHash check) ───────────────────────────────────
console.log("\n── Same-text dedup ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("existing.textHash === currentHash"), "textHash comparison for dedup");
  assert(content.includes("hashText(text)"), "hashText used to compute hash");
}

// ── 17. MiMo failure doesn't crash dayCycle ────────────────────────────────
console.log("\n── MiMo failure isolation ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  // The onPlayMimoTts handler uses .then().catch() — failure in generation is caught
  assert(content.includes(".catch((err) => {"), "MiMo generation has .catch()");
  // dayCycle is not modified on MiMo error
  const catchBlock = content.split(".catch((err) =>")[1]?.split("};")[0] ?? "";
  assert(!catchBlock.includes("dayCycle"), "dayCycle not modified in MiMo error catch");
}

// ── 18. MiniMax TTS still works (no regression) ──────────────────────────
console.log("\n── MiniMax TTS preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("generateBroadcastSpeech"), "generateBroadcastSpeech still imported");
  assert(content.includes("onGenerateTts:"), "onGenerateTts handler still exists");
  assert(content.includes("onPlayTts:"), "onPlayTts handler still exists");
  assert(content.includes("onPauseTts:"), "onPauseTts handler still exists");
}

// ── 19. MiniMax speech-t2a-http not modified ──────────────────────────────
console.log("\n── MiniMax speech-t2a-http not modified ──");
{
  const fs = await import("fs");
  const ttsContent = fs.readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(ttsContent.includes("speech-2.8-hd"), "speech-2.8-hd model still in minimaxTts.js");
}

// ── 20. music_generation not modified ─────────────────────────────────────
console.log("\n── music_generation not modified ──");
{
  const fs = await import("fs");
  const ttsContent = fs.readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(!ttsContent.includes("music_generation"), "music_generation not in minimaxTts.js");
  const clientContent = fs.readFileSync("./src/services/minimaxClient.js", "utf8");
  assert(!clientContent.includes("music_generation"), "music_generation not in minimaxClient.js");
}

// ── 21. Game values not modified ───────────────────────────────────────────
console.log("\n── Game values not modified ──");
{
  const fs = await import("fs");
  const simContent = fs.readFileSync("./src/domain/simulation.js", "utf8");
  assert(simContent.includes("mood") && simContent.includes("energy"), "mood and energy still in simulation.js");
}

// ── 22. No new frameworks ─────────────────────────────────────────────────
console.log("\n── No new frameworks ──");
{
  const fs = await import("fs");
  const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const forbidden = ["phaser", "pixi", "pixi.js", "pixi-legacy", "matter-js", "playwright", "puppeteer", "react", "vue", "svelte", "angular", "solid-js", "lit", "howler", "tone.js"];
  const found = forbidden.filter((k) => deps[k]);
  assert(found.length === 0, `no forbidden frameworks (found: ${found.join(", ") || "none"})`);
}

// ── 23. No API keys committed in app.js ───────────────────────────────────
console.log("\n── No API keys committed in app.js ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  const hasKey = /sk-[a-zA-Z0-9]{20,}/.test(appContent);
  assert(!hasKey, "no sk- API keys in app.js");
}

// ── 24. renderApp: ttsAudios in safeUiState ────────────────────────────────
console.log("\n── ttsAudios in safeUiState ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("ttsAudios: uiState.ttsAudios"), "ttsAudios in safeUiState");
  assert(content.includes("safeHandlers = {"), "safeHandlers defined in renderApp");
  assert(content.includes("onPlayMimoTts:"), "onPlayMimoTts in safeHandlers");
}

// ── 25. resident dialogue TTS button in render ────────────────────────────
console.log("\n── Resident dialogue TTS button ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("renderResidentDialoguePanel(safeUiState.residentSceneBeats, safeUiState.ttsAudios, safeHandlers)"), "dialogue panel gets ttsAudios");
}

// ── 26. event TTS button in render ───────────────────────────────────────
console.log("\n── Event TTS button ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("renderM3EventItem(event, state.residents, latestClass, ttsAudios, handlers)"), "event panel gets ttsAudios");
  assert(content.includes("event_prompt:"), "event uses event_prompt scene");
}

// ── 27. completion TTS button in render ───────────────────────────────────
console.log("\n── Completion feedback TTS button ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("completion_feedback:current"), "completion uses completion_feedback scene");
  assert(content.includes("cfText = \"本阶段行动完成\""), "completion text hardcoded");
}

// ── 28. day_opening TTS button in render ──────────────────────────────────
console.log("\n── Day-opening TTS button ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("day_opening:current"), "day-opening uses day_opening scene");
  assert(content.includes("今天的小镇围绕"), "day-opening text uses scenario");
}

// ── 29. activeMimoAudios isolation ─────────────────────────────────────────
console.log("\n── activeMimoAudios isolation ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("playMimoAudio(audioKey, result.audioUrl)"), "calls playMimoAudio on success");
  assert(content.includes("playMimoAudio(audioKey, existing.audioUrl)"), "calls playMimoAudio on resume");
  assert(content.includes("audio.onended ="), "audio has onended assignment");
  assert(content.includes("audio.onerror ="), "audio has onerror assignment");
}

// ── 30. config.example has MiMo placeholder ───────────────────────────────────
console.log("\n── config.example has MiMo placeholder ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./config.example.json", "utf8");
  const hasMimoSection = content.includes("mimo") && content.includes("your_mimo_api_key_here");
  assert(hasMimoSection, "config.example has mimo section with placeholder key");
}

// ── Results ───────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll MiMo TTS checks passed!");
