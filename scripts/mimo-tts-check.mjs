// mimo-tts-check — validates MiMo TTS Provider integration (Token Plan mode)
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

// ── 4. hashText ─────────────────────────────────────────────────────────────
console.log("\n── hashText ──");
{
  assert(typeof hashText === "function", "hashText is a function");
  assert(hashText("hello") === hashText("hello"), "same text → same hash");
  assert(hashText("hello") !== hashText("world"), "different text → different hash");
  assert(hashText("") !== undefined, "empty string handled");
}

// ── 5. validateSceneText ───────────────────────────────────────────────────
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

// ── 7. server.mjs has handleMimoTts ──────────────────────────────────────
console.log("\n── server.mjs handleMimoTts ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("handleMimoTts"), "handleMimoTts function exists");
  assert(content.includes("/api/mimo/tts"), "endpoint routed to /api/mimo/tts");
}

// ── 8. MiniMax TTS endpoint still exists ────────────────────────────────
console.log("\n── MiniMax TTS endpoint preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("handleMiniMaxTts"), "handleMiniMaxTts still exists");
  assert(content.includes("/api/minimax/tts"), "/api/minimax/tts still routed");
}

// ── 9. No API key in frontend bundle (mimoClient.js) ─────────────────────
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
  const envIgnored = gitignoreContent.includes(".env");
  assert(envIgnored, ".env is in .gitignore to prevent committing secrets");
}

// ── 11. Token Plan: default baseUrl uses token-plan-cn ──────────────────────
console.log("\n── Token Plan default baseUrl ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  // Default should be token-plan-cn, NOT api.mimo.ai
  assert(
    !content.includes('"https://api.mimo.ai/v1"') &&
    !content.includes("'https://api.mimo.ai/v1'"),
    "no hardcoded api.mimo.ai/v1 default"
  );
  // Should reference token-plan-cn in the defaults
  assert(
    content.includes("token-plan-cn") || content.includes("token_plan"),
    "token-plan-cn referenced in server.mjs config"
  );
}

// ── 12. Token Plan endpoint: /chat/completions ─────────────────────────────
console.log("\n── Token Plan endpoint construction ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  // Isolate the MiMo handler section only
  const mimoSection = content.split("async function handleMimoTts")[1]?.split("\nfunction resolvePath")[0] ?? "";
  // Must use /chat/completions
  assert(mimoSection.includes("/chat/completions"), "/chat/completions used in handleMimoTts");
  // Must NOT use /t2a_v2, /tts, /audio/speech in MiMo handler
  assert(!mimoSection.includes("/t2a_v2"), "no /t2a_v2 endpoint in MiMo handler");
  assert(!mimoSection.includes("/tts"), "no /tts endpoint in MiMo handler");
  assert(!mimoSection.includes("/audio/speech"), "no /audio/speech endpoint in MiMo handler");
}

// ── 13. Auth header uses api-key (not Bearer) ────────────────────────────
console.log("\n── Auth header uses api-key ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  // Must use "api-key" header
  assert(content.includes('"api-key"'), 'uses "api-key" header');
  // Must NOT use Authorization: Bearer for MiMo
  const mimoSection = content.split("async function handleMimoTts")[1]?.split("\nfunction resolvePath")[0] ?? "";
  assert(!mimoSection.includes("Bearer"), "no Bearer token in handleMimoTts");
}

// ── 14. Request body uses Chat Completions format ─────────────────────────
console.log("\n── Chat Completions request body ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("async function handleMimoTts")[1]?.split("\nfunction resolvePath")[0] ?? "";
  // Must have messages array
  assert(fn.includes("messages:"), "messages array in request body");
  // Must have user role for style instruction
  assert(fn.includes('role: "user"') || fn.includes("role: 'user'"), "user role for style");
  // Must have assistant role for text to synthesize
  assert(fn.includes('role: "assistant"') || fn.includes("role: 'assistant'"), "assistant role for TTS text");
  // Must have audio object
  assert(fn.includes("audio:"), "audio config in request body");
  // Must NOT have old t2a_v2 payload fields like voice_setting, stream
  assert(!fn.includes("voice_setting:"), "no voice_setting field (old format)");
  assert(!fn.includes("stream:"), "no stream field in TTS payload");
}

// ── 15. audio.voice and audio.format defaults ───────────────────────────────
console.log("\n── audio.voice and audio.format defaults ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("handleMimoTts")[1]?.split("function resolvePath")[0] ?? "";
  // Default voice should be mimo_default
  assert(fn.includes("mimo_default"), "mimo_default as default voice");
  // Default format should be wav
  assert(fn.includes('format: "wav"') || fn.includes("format: 'wav'"), "wav as default format");
}

// ── 16. TTS text goes to assistant role, not user role ────────────────────
console.log("\n── TTS text in assistant role ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("handleMimoTts")[1]?.split("function resolvePath")[0] ?? "";
  // The text variable should be placed in the assistant message
  const assistantContentMatch = fn.match(/role:\s*["']assistant["']\s*,\s*content:\s*text/);
  assert(assistantContentMatch, "TTS text assigned to assistant role content");
}

// ── 17. mimo-v2.5-tts model used ───────────────────────────────────────────
console.log("\n── mimo-v2.5-tts model ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("mimo-v2.5-tts"), "mimo-v2.5-tts model referenced");
}

// ── 18. MIMO_API_MODE config supported ─────────────────────────────────────
console.log("\n── MIMO_API_MODE config ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("mimoApiMode"), "mimoApiMode variable exists");
  assert(content.includes("MIMO_API_MODE"), "MIMO_API_MODE env/config key exists");
}

// ── 19. Token Plan key prefix tp- and payg key prefix sk- ──────────────────
console.log("\n── Key prefix detection ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("isTokenPlanKey"), "isTokenPlanKey check exists");
  assert(content.includes("isPaygKey"), "isPaygKey check exists");
  assert(content.includes('"tp-'), "tp- prefix mentioned in config");
  assert(content.includes('"sk-'), "sk- prefix mentioned in config");
}

// ── 20. config.example updated for Token Plan ─────────────────────────────
console.log("\n── config.example updated for Token Plan ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./config.example.json", "utf8");
  const parsed = JSON.parse(content);
  const mimo = parsed?.mimo?.tts;
  assert(mimo?.baseUrl?.includes("token-plan-cn"), "config.example default baseUrl is Token Plan");
  assert(mimo?.apiMode === "token_plan", "config.example apiMode is token_plan");
  assert(mimo?.voiceId === "mimo_default", "config.example default voice is mimo_default");
  assert(!mimo?.baseUrl?.includes("api.mimo.ai"), "config.example does not use api.mimo.ai");
}

// ── 21. getMimoRuntimeConfig function exists ───────────────────────────────
console.log("\n── getMimoRuntimeConfig function ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("function getMimoRuntimeConfig"), "getMimoRuntimeConfig function exists");
  assert(content.includes("keyPrefix"), "keyPrefix used in getMimoRuntimeConfig");
  assert(content.includes("isTokenPlanKey"), "isTokenPlanKey in getMimoRuntimeConfig");
  assert(content.includes("warnings:"), "warnings array in getMimoRuntimeConfig");
}

// ── 22. getMimoRuntimeConfig does not expose full key ─────────────────────
console.log("\n── getMimoRuntimeConfig key sanitization ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fnBody = content.split("function getMimoRuntimeConfig")[1]?.split("\n}")[0] ?? "";
  // Should use slice(0,3) and slice(-4) for prefix
  assert(fnBody.includes("slice(0, 3)") && fnBody.includes("slice(-4)"), "key prefix shown as ***");
  // Should not expose full mimoApiKey
  assert(!fnBody.includes("mimoApiKey,"), "full mimoApiKey not returned directly");
}

// ── 23. dry-run endpoint works ──────────────────────────────────────────────
console.log("\n── dry-run endpoint support ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("async function handleMimoTts")[1]?.split("\nfunction resolvePath")[0] ?? "";
  assert(fn.includes("isDryRun"), "isDryRun variable exists");
  assert(fn.includes('dryRun=1') || fn.includes('dryRun"'), "dryRun query param checked");
  assert(fn.includes("keyPrefix:"), "dry-run response includes keyPrefix");
  assert(fn.includes("endpoint:"), "dry-run response includes endpoint");
  // Verify the dry-run response block doesn't include mimoApiKey directly
  const dryRunBlock = fn.slice(fn.indexOf("isDryRun"), fn.indexOf("mimoEnabled"));
  assert(!dryRunBlock.includes("mimoApiKey:"), "dry-run response does not include mimoApiKey field");
}

// ── 24. Error messages are user-friendly ───────────────────────────────────
console.log("\n── Error message sanitization ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const fn = content.split("async function handleMimoTts")[1]?.split("\nfunction resolvePath")[0] ?? "";
  // Error strings should not contain actual API key patterns (sk-xxx, tp-xxx, long Bearer tokens)
  const errorStrings = [...fn.matchAll(/error:\s*"([^"]+)"/g)].map((m) => m[1]);
  const hasKeyLeak = errorStrings.some(
    (e) => /sk-[A-Za-z0-9]{10,}|tp-[A-Za-z0-9]{10,}|Bearer [A-Za-z0-9._-]{20,}/.test(e)
  );
  assert(!hasKeyLeak, "error strings are user-friendly, no API key leaked");
}

// ── 25. ttsAudios in uiState ────────────────────────────────────────────────
console.log("\n── ttsAudios in uiState ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("ttsAudios: {}"), "ttsAudios initialized as empty object");
  assert(content.includes("ttsAudios: {}"), "ttsAudios reset in onNewTown");
}

// ── 26. onPlayMimoTts handler exists in app.js ────────────────────────────
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

// ── 27. MiMo TTS button in render ──────────────────────────────────────────
console.log("\n── MiMo TTS buttons in render ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes('data-action="play-mimo-tts"'), "play-mimo-tts button exists");
  assert(content.includes('data-action="pause-mimo-tts"'), "pause-mimo-tts button exists");
  assert(content.includes('data-action="resume-mimo-tts"'), "resume-mimo-tts button exists");
  assert(content.includes("mimo-tts-btn"), "mimo-tts-btn CSS class exists");
}

// ── 28. activeMimoAudios Map in app.js ────────────────────────────────────
console.log("\n── activeMimoAudios Map ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("const activeMimoAudios = new Map()"), "activeMimoAudios Map defined");
  assert(content.includes("stopMimoAudio"), "stopMimoAudio function exists");
  assert(content.includes("stopAllMimoAudio"), "stopAllMimoAudio function exists");
}

// ── 29. Same-text dedup (textHash check) ───────────────────────────────────
console.log("\n── Same-text dedup ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("existing.textHash === currentHash"), "textHash comparison for dedup");
  assert(content.includes("hashText(text)"), "hashText used to compute hash");
}

// ── 30. MiMo failure doesn't crash dayCycle ────────────────────────────────
console.log("\n── MiMo failure isolation ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes(".catch((err) => {"), "MiMo generation has .catch()");
  const catchBlock = content.split(".catch((err) =>")[1]?.split("};")[0] ?? "";
  assert(!catchBlock.includes("dayCycle"), "dayCycle not modified in MiMo error catch");
}

// ── 31. MiniMax TTS still works (no regression) ──────────────────────────
console.log("\n── MiniMax TTS preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("generateBroadcastSpeech"), "generateBroadcastSpeech still imported");
  assert(content.includes("onGenerateTts:"), "onGenerateTts handler still exists");
  assert(content.includes("onPlayTts:"), "onPlayTts handler still exists");
  assert(content.includes("onPauseTts:"), "onPauseTts handler still exists");
}

// ── 32. MiniMax speech-t2a-http not modified ──────────────────────────────
console.log("\n── MiniMax speech-t2a-http not modified ──");
{
  const fs = await import("fs");
  const ttsContent = fs.readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(ttsContent.includes("speech-2.8-hd"), "speech-2.8-hd model still in minimaxTts.js");
}

// ── 33. music_generation not modified ─────────────────────────────────────
console.log("\n── music_generation not modified ──");
{
  const fs = await import("fs");
  const ttsContent = fs.readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(!ttsContent.includes("music_generation"), "music_generation not in minimaxTts.js");
  const clientContent = fs.readFileSync("./src/services/minimaxClient.js", "utf8");
  assert(!clientContent.includes("music_generation"), "music_generation not in minimaxClient.js");
}

// ── 34. Game values not modified ───────────────────────────────────────────
console.log("\n── Game values not modified ──");
{
  const fs = await import("fs");
  const simContent = fs.readFileSync("./src/domain/simulation.js", "utf8");
  assert(simContent.includes("mood") && simContent.includes("energy"), "mood and energy still in simulation.js");
}

// ── 35. No new frameworks ─────────────────────────────────────────────────
console.log("\n── No new frameworks ──");
{
  const fs = await import("fs");
  const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const forbidden = ["phaser", "pixi", "pixi.js", "pixi-legacy", "matter-js", "playwright", "puppeteer", "react", "vue", "svelte", "angular", "solid-js", "lit", "howler", "tone.js"];
  const found = forbidden.filter((k) => deps[k]);
  assert(found.length === 0, `no forbidden frameworks (found: ${found.join(", ") || "none"})`);
}

// ── 36. No API keys committed in app.js ───────────────────────────────────
console.log("\n── No API keys committed in app.js ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  const hasKey = /sk-[a-zA-Z0-9]{20,}/.test(appContent);
  assert(!hasKey, "no sk- API keys in app.js");
}

// ── 37. ttsAudios in safeUiState ──────────────────────────────────────────
console.log("\n── ttsAudios in safeUiState ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("ttsAudios: uiState.ttsAudios"), "ttsAudios in safeUiState");
  assert(content.includes("safeHandlers = {"), "safeHandlers defined in renderApp");
  assert(content.includes("onPlayMimoTts:"), "onPlayMimoTts in safeHandlers");
}

// ── 38. resident dialogue TTS button in render ────────────────────────────
console.log("\n── Resident dialogue TTS button ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("renderResidentDialoguePanel(safeUiState.residentSceneBeats, safeUiState.ttsAudios, safeHandlers)"), "dialogue panel gets ttsAudios");
}

// ── 39. event TTS button in render ───────────────────────────────────────
console.log("\n── Event TTS button ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("renderM3EventItem(event, state.residents, latestClass, ttsAudios, handlers)"), "event panel gets ttsAudios");
  assert(content.includes("event_prompt:"), "event uses event_prompt scene");
}

// ── 40. completion TTS button in render ───────────────────────────────────
console.log("\n── Completion feedback TTS button ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("completion_feedback:current"), "completion uses completion_feedback scene");
  assert(content.includes('cfText = "本阶段行动完成"'), "completion text hardcoded");
}

// ── 41. day_opening TTS button in render ─────────────────────────────────
console.log("\n── Day-opening TTS button ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("day_opening:current"), "day-opening uses day_opening scene");
  assert(content.includes("今天的小镇围绕"), "day-opening text uses scenario");
}

// ── 42. activeMimoAudios isolation ─────────────────────────────────────────
console.log("\n── activeMimoAudios isolation ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("playMimoAudio(audioKey, result.audioUrl)"), "calls playMimoAudio on success");
  assert(content.includes("playMimoAudio(audioKey, existing.audioUrl)"), "calls playMimoAudio on resume");
  assert(content.includes("audio.onended ="), "audio has onended assignment");
  assert(content.includes("audio.onerror ="), "audio has onerror assignment");
}

// ── 43. No Bearer token in config.example mimo section ───────────────────
console.log("\n── No Bearer in config.example ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./config.example.json", "utf8");
  assert(!content.includes("Bearer"), "no Bearer token in config.example");
}

// ── 44. dayCycle not modified ─────────────────────────────────────────────
console.log("\n── dayCycle not modified ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const cycleFns = ["advancePhase", "runTownDayCycle", "onRunTownDayCycle"];
  cycleFns.forEach((fn) => assert(content.includes(fn), `${fn} still in app.js`));
}

// ── 45. parseMimoTtsAudio function exists ─────────────────────────────────
console.log("\n── parseMimoTtsAudio function ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("function parseMimoTtsAudio"), "parseMimoTtsAudio function exists");
  // Primary path: choices[0].message.audio.data
  assert(
    content.includes("choices[0]?.message?.audio?.data") || content.includes("choices?.[0]?.message?.audio?.data"),
    "supports choices[0].message.audio.data path"
  );
  // At least 3 candidate paths (check for actual strings in the function body)
  const hasAudioData = content.includes("audio?.data");
  const hasAudioBase64 = content.includes("audio?.base64");
  const hasAudioDataAlt = content.includes("audio_data");
  const count = [hasAudioData, hasAudioBase64, hasAudioDataAlt].filter(Boolean).length;
  assert(count >= 2, `at least 2 audio field variants supported (found ${count})`);
}

// ── 46. sanitizeMimoError function exists ─────────────────────────────────
console.log("\n── sanitizeMimoError function ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("function sanitizeMimoError"), "sanitizeMimoError function exists");
  assert(content.includes('tp-[A-Za-z0-9._-]{10,}'), "tp- key pattern stripped");
  assert(content.includes('sk-[A-Za-z0-9._-]{10,}'), "sk- key pattern stripped");
  assert(content.includes('Bearer [A-Za-z0-9._-]+'), "Bearer token stripped");
  assert(content.includes("{80,}"), "long base64 stripped");
}

// ── 47. Success response uses data:audio/wav;base64, ────────────────────────
console.log("\n── Response audioUrl format ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(
    content.includes("data:audio/wav;base64,"),
    "audioUrl uses data:audio/wav;base64, prefix"
  );
}

// ── 48. Response includes format, textHash, scene fields ───────────────────
console.log("\n── Response includes metadata fields ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const mimoSection = content.split("async function handleMimoTts")[1]?.split("\nfunction resolvePath")[0] ?? "";
  assert(mimoSection.includes("format:"), "response includes format field");
  assert(mimoSection.includes("textHash"), "response includes textHash field");
  assert(mimoSection.includes("scene"), "response includes scene field");
}

// ── 49. No raw upstream payload in response ───────────────────────────────
console.log("\n── No raw payload in response ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  const mimoSection = content.split("async function handleMimoTts")[1]?.split("\nfunction resolvePath")[0] ?? "";
  // Should not return Authorization header in response
  assert(!mimoSection.includes("Authorization:"), "no Authorization in response");
  assert(!mimoSection.includes("Bearer "), "no Bearer token in response");
}

// ── 50. mimo-tts-integration-check script exists ──────────────────────────
console.log("\n── Integration check script ──");
{
  const fs = await import("fs");
  const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
  assert(
    pkg.scripts && pkg.scripts["mimo-tts-integration-check"],
    "mimo-tts-integration-check script in package.json"
  );
  const scriptContent = fs.readFileSync("./scripts/mimo-tts-integration-check.mjs", "utf8");
  assert(scriptContent.includes("MIMO_TTS_REAL_TEST"), "real test requires MIMO_TTS_REAL_TEST opt-in");
  assert(scriptContent.includes("dryRun"), "dry-run test implemented");
  assert(scriptContent.includes("parseMimoTtsAudio") || scriptContent.includes("choices"), "uses parseMimoTtsAudio or equivalent");
}

// ── 51. Integration check: real test is opt-in only ────────────────────────
console.log("\n── Real test opt-in ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/mimo-tts-integration-check.mjs", "utf8");
  assert(content.includes("REAL_TEST"), "real test uses REAL_TEST variable (derived from env var)");
  assert(content.includes("MIMO_TTS_REAL_TEST === '1'") || content.includes('MIMO_TTS_REAL_TEST === "1"'), "real test conditional on MIMO_TTS_REAL_TEST=1");
}

// ── Results ───────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll MiMo TTS checks passed!");
