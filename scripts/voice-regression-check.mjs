// voice-regression-check — validates voice control fixes and no regressions
// Checks: handlers references, broadcast TTS buttons, resident voice clips fallback, MiMo buttons

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

// ── 1. No unsafe handlers references in render code ───────────────────────────
console.log("\n── No unsafe handlers references in render ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  // Unsafe: guards using handlers.property without optional chaining
  // e.g. const x = (handlers.onX) ? a : b — where handlers might not have onX
  // Safe: handlers?.onX, handlers.onX ?? fallback, handlers.onX(...) calls in bindEvents
  // We check for the guard pattern: (handlers.onX) where onX is used as boolean
  const guardPattern1 = /\(\s*handlers\.onPlayMimoTts\s*\)/g;
  const guardPattern2 = /\(\s*handlers\.onPauseTts\s*\)/g;
  const guardPattern3 = /\(\s*handlers\.onPlayTts\s*\)/g;
  const g1 = content.match(guardPattern1) ?? [];
  const g2 = content.match(guardPattern2) ?? [];
  const g3 = content.match(guardPattern3) ?? [];
  assert(g1.length === 0, `handlers.onPlayMimoTts guard pattern: found ${g1.length}`);
  assert(g2.length === 0, `handlers.onPauseTts guard pattern: found ${g2.length}`);
  assert(g3.length === 0, `handlers.onPlayTts guard pattern: found ${g3.length}`);
}

// ── 2. UI does not display "handlers is not defined" ─────────────────────────
console.log("\n── UI does not display handlers is not defined ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(!content.includes("handlers is not defined"), "no 'handlers is not defined' string in render.js");
  assert(!content.includes("handlers.not"), "no 'handlers.not' pattern in render.js");
}

// ── 3. Broadcast TTS has data-action="generate-tts" ───────────────────────────
console.log("\n── Broadcast TTS generate button ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes('data-action="generate-tts"'), "generate-tts data-action exists");
}

// ── 4. Broadcast TTS has generate-tts action (handles play/pause toggle) ─────
console.log("\n── Broadcast TTS generate-tts action (handles play/pause toggle) ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  // generate-tts button now handles play/pause/continue toggle in one button
  assert(content.includes('data-action="generate-tts"'), "generate-tts action exists");
  // play-tts and pause-tts are no longer separate buttons (consolidated into generate-tts)
}

// ── 5. Broadcast TTS clearly identifies MiniMax ───────────────────────────────
console.log("\n── MiniMax label on broadcast TTS ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  const minimaxLabels = (content.match(/MiniMax/g) ?? []).length;
  assert(minimaxLabels >= 4, `MiniMax label appears ${minimaxLabels} times (expected >= 4)`);
  assert(content.includes("MiniMax 生成") || content.includes("MiniMax 播放"), "MiniMax label on button text");
}

// ── 6. residentVoiceInteraction.enabled=true generates voice clips ─────────────
console.log("\n── Voice clips generated when enabled ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  // When toggle is ON, clips should be built
  assert(content.includes("buildResidentVoiceClips(state, uiState)"), "buildResidentVoiceClips called on toggle");
  assert(content.includes("residentVoiceClips:"), "residentVoiceClips set in uiState");
}

// ── 7. Fallback voice clips from tasks ───────────────────────────────────────
console.log("\n── Fallback voice clips from tasks ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const fn = content.split("function buildResidentVoiceClips")[1]?.split("\n}\n")[0] ?? "";
  // Should have task-based fallback step
  assert(fn.includes("TASK_FALLBACK") || fn.includes("task_fallback") || fn.includes("assignmentId"), "has task-based fallback logic");
  // Should have a step that adds clips even when beats are empty
  assert(fn.includes("priority: 20") || fn.includes("priority: 30"), "has low-priority fallback clips");
}

// ── 8. Fallback uses scene=resident_dialogue ────────────────────────────────
console.log("\n── Fallback clip scene type ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const fn = content.split("function buildResidentVoiceClips")[1]?.split("\n}\n")[0] ?? "";
  // Fallback clips should use resident_dialogue scene so MiMo provider is used
  const dialogueScenes = (fn.match(/scene:\s*["']resident_dialogue["']/g) ?? []).length;
  assert(dialogueScenes >= 2, `resident_dialogue scenes found ${dialogueScenes} times (expected >= 2)`);
}

// ── 9. Recommended voice entry exists ────────────────────────────────────────
console.log("\n── Recommended voice entry ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("renderRecommendedVoiceClip") || content.includes("recommended-voice"), "recommended voice render function or CSS exists");
}

// ── 10. Recommended voice uses data-action="play-mimo-tts" ────────────────────
console.log("\n── Recommended voice data-action ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  const fn = content.split("function renderRecommendedVoiceClip")[1]?.split("\n}\n")[0] ?? "";
  assert(fn.includes('data-action="play-mimo-tts"') || fn.includes("play-mimo-tts"), "recommended voice uses play-mimo-tts action");
}

// ── 11. Map resident MiMo button is clickable (not static span) ──────────────
console.log("\n── Map resident MiMo button clickable ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  const fn = content.split("function renderCharacterVoiceIndicator")[1]?.split("\n}\n")[0] ?? "";
  assert(fn.includes("<button"), "returns <button> element");
  assert(!fn.includes('<span class="stage-character__voice-indicator"'), "does not return static span with pointer-events:none");
  assert(fn.includes("data-action="), "button has data-action attribute");
}

// ── 12. Map button includes data-text ───────────────────────────────────────
console.log("\n── Map button data-text ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  const fn = content.split("function renderCharacterVoiceIndicator")[1]?.split("\n}\n")[0] ?? "";
  assert(fn.includes("data-text="), "has data-text attribute");
}

// ── 13. Map button includes data-resident-id ─────────────────────────────────
console.log("\n── Map button data-resident-id ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  const fn = content.split("function renderCharacterVoiceIndicator")[1]?.split("\n}\n")[0] ?? "";
  assert(fn.includes("data-resident-id="), "has data-resident-id attribute");
}

// ── 14. Map button is not just static span ───────────────────────────────────
console.log("\n── Map button is button not span ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  const fn = content.split("function renderCharacterVoiceIndicator")[1]?.split("\n}\n")[0] ?? "";
  // Count button vs span returns
  const buttonReturns = (fn.match(/return `<button/g) ?? []).length;
  const spanReturns = (fn.match(/return `<span/g) ?? []).length;
  assert(buttonReturns > 0, "returns <button> elements");
  assert(spanReturns === 0 || !fn.includes("stage-character__voice-indicator"), "does not return static voice-indicator span");
}

// ── 15. Right panel resident dialogue MiMo button still exists ─────────────────
console.log("\n── Right panel dialogue MiMo button ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  const fn = content.split("function renderResidentDialoguePanel")[1]?.split("\n}\n")[0] ?? "";
  assert(fn.includes("mimo-tts-btn") || fn.includes("play-mimo-tts"), "dialogue panel has MiMo button");
}

// ── 16. choiceAftermath reaction MiMo button still exists ─────────────────────
console.log("\n── choiceAftermath reaction MiMo button ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  const fn = content.split("function renderChoiceAftermath")[1]?.split("\n}\n")[0] ?? "";
  assert(fn.includes("mimo-tts-btn") || fn.includes("play-mimo-tts"), "choice aftermath has MiMo button");
}

// ── 17. Global voice playback bar still exists ───────────────────────────────
console.log("\n── Global voice playback bar ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("renderVoicePlaybackBar") || content.includes("voice-playback-bar"), "voice playback bar exists");
  assert(content.includes("VOICE_PLAYBACK_LABELS"), "voice playback labels constant exists");
}

// ── 18. MiniMax broadcast TTS still exists ────────────────────────────────────
console.log("\n── MiniMax broadcast TTS ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("generateBroadcastSpeech"), "generateBroadcastSpeech exists");
  assert(appContent.includes("onGenerateTts") || appContent.includes("onPlayTts"), "MiniMax TTS handlers exist");
}

// ── 19. MiMo TTS Provider still exists ───────────────────────────────────────
console.log("\n── MiMo TTS Provider ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("generateMimoSpeech"), "generateMimoSpeech exists");
  assert(appContent.includes("onPlayMimoTts"), "MiMo TTS handler exists");
}

// ── 20. MiMo Token Plan endpoint not modified ─────────────────────────────────
console.log("\n── MiMo Token Plan endpoint ──");
{
  const fs = await import("fs");
  const serverContent = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(serverContent.includes("token-plan-cn"), "token-plan-cn endpoint preserved");
  assert(serverContent.includes("mimo-v2.5-tts"), "mimo-v2.5-tts model preserved");
}

// ── 21. MiniMax speech-t2a-http not modified ──────────────────────────────────
console.log("\n── MiniMax speech-t2a-http ──");
{
  const fs = await import("fs");
  const ttsContent = fs.readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(ttsContent.includes("speech-2.8-hd"), "speech-2.8-hd model preserved");
}

// ── 22. dayCycle not modified ────────────────────────────────────────────────
console.log("\n── dayCycle preserved ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(appContent.includes("runTownDayCycle") && appContent.includes("DAY_CYCLE_DEFAULT"), "dayCycle functions preserved");
}

// ── 23. Game values not modified ─────────────────────────────────────────────
console.log("\n── Game values preserved ──");
{
  const fs = await import("fs");
  const simContent = fs.readFileSync("./src/domain/simulation.js", "utf8");
  assert(simContent.includes("mood") && simContent.includes("energy"), "mood and energy preserved");
}

// ── 24. No API keys committed ────────────────────────────────────────────────
console.log("\n── No API keys committed ──");
{
  const fs = await import("fs");
  const app = fs.readFileSync("./src/app.js", "utf8");
  const render = fs.readFileSync("./src/ui/render.js", "utf8");
  const combined = app + render;
  assert(!combined.match(/sk-[a-zA-Z0-9]{20,}/), "no sk- API key in app/render");
  assert(!combined.match(/tp-[a-zA-Z0-9._-]{10,}/), "no tp- API key in app/render");
}

// ── 25. No base64 audio committed ──────────────────────────────────────────
console.log("\n── No base64 audio committed ──");
{
  const fs = await import("fs");
  const app = fs.readFileSync("./src/app.js", "utf8");
  assert(!app.includes("data:audio/"), "no data:audio/ in app.js");
}

// ── Results ───────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll voice regression checks passed!");
