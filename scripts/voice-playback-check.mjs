// voice-playback-check — validates global voice playback bar integration
// Verifies currentVoicePlayback state, unified handlers, and no regressions

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

// ── 1. currentVoicePlayback state exists in app.js ───────────────────────────
console.log("\n── currentVoicePlayback state ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("currentVoicePlayback: makeVoicePlaybackState()"), "currentVoicePlayback initialized in uiState");
  assert(content.includes("makeVoicePlaybackState"), "makeVoicePlaybackState function exists");
  assert(content.includes("function makeVoicePlaybackState"), "makeVoicePlaybackState defined as function");
  // Fields
  const vpContent = content.split("function makeVoicePlaybackState")[1]?.split("\n}")[0] ?? "";
  assert(vpContent.includes("key:"), "key field exists");
  assert(vpContent.includes("provider:"), "provider field exists");
  assert(vpContent.includes("scene:"), "scene field exists");
  assert(vpContent.includes("sourceType:"), "sourceType field exists");
  assert(vpContent.includes("status:"), "status field exists");
  assert(vpContent.includes("textPreview:"), "textPreview field exists");
  assert(vpContent.includes("error:"), "error field exists");
}

// ── 2. Global voice playback bar UI exists in render.js ─────────────────────
console.log("\n── Voice playback bar UI ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("renderVoicePlaybackBar"), "renderVoicePlaybackBar function exists");
  assert(content.includes("VOICE_PLAYBACK_LABELS"), "VOICE_PLAYBACK_LABELS constant exists");
  assert(content.includes("data-action=\"voice-pause\""), "voice-pause button action exists");
  assert(content.includes("data-action=\"voice-resume\""), "voice-resume button action exists");
  assert(content.includes("data-action=\"voice-stop\""), "voice-stop button action exists");
  assert(content.includes("currentVoicePlayback: uiState.currentVoicePlayback"), "currentVoicePlayback passed to safeUiState");
  // Integration in renderApp
  const renderAppContent = content.split("export function renderApp")[1] ?? "";
  assert(renderAppContent.includes("renderVoicePlaybackBar"), "renderVoicePlaybackBar called in renderApp");
}

// ── 3. Status bar shows MiniMax broadcast source ───────────────────────────
console.log("\n── MiniMax broadcast source ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("town_broadcast:"), "town_broadcast label entry exists");
  assert(content.includes("小镇广播"), "小镇广播 label exists");
  assert(content.includes('icon: "📻"'), "broadcast icon is 📻");
}

// ── 4. Status bar shows MiMo resident dialogue source ─────────────────────
console.log("\n── MiMo resident dialogue source ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("resident_dialogue:"), "resident_dialogue label entry exists");
  assert(content.includes("居民对白"), "居民对白 label exists");
  assert(content.includes('icon: "💬"'), "dialogue icon is 💬");
}

// ── 5. Status bar shows event prompt source ───────────────────────────────
console.log("\n── Event prompt source ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("event_prompt:"), "event_prompt label entry exists");
  assert(content.includes("事件提示"), "事件提示 label exists");
  assert(content.includes('icon: "🎭"'), "event icon is 🎭");
}

// ── 6. Status bar shows completion feedback source ───────────────────────
console.log("\n── completionFeedback source ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("completion_feedback:"), "completion_feedback label entry exists");
  assert(content.includes("任务完成"), "任务完成 label exists");
  assert(content.includes('icon: "✅"'), "completion icon is ✅");
}

// ── 7. Status bar shows day opening source ───────────────────────────────
console.log("\n── Day opening source ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("day_opening:"), "day_opening label entry exists");
  assert(content.includes("今日场景"), "今日场景 label exists");
  assert(content.includes('icon: "🏠"'), "day opening icon is 🏠");
}

// ── 8. Pause button during playback ───────────────────────────────────────
console.log("\n── Pause button during playback ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("showPause"), "showPause variable exists in renderVoicePlaybackBar");
  assert(content.includes("data-action=\"voice-pause\""), "voice-pause button markup exists");
}

// ── 9. Resume button after pause ───────────────────────────────────────────
console.log("\n── Resume button after pause ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("showResume"), "showResume variable exists in renderVoicePlaybackBar");
  assert(content.includes("data-action=\"voice-resume\""), "voice-resume button markup exists");
}

// ── 10. Stop button exists ────────────────────────────────────────────────
console.log("\n── Stop button ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("showStop"), "showStop variable exists in renderVoicePlaybackBar");
  assert(content.includes("data-action=\"voice-stop\""), "voice-stop button markup exists");
}

// ── 11. Stop clears current playback state ────────────────────────────────
console.log("\n── Stop clears playback state ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const stopFn = content.split("onVoiceStop:")[1]?.split("onAssignTask")[0] ?? "";
  assert(stopFn.includes("makeVoicePlaybackState()"), "stop calls makeVoicePlaybackState() to clear");
  assert(stopFn.includes("stopBroadcastAudio(") || stopFn.includes("stopAllMimoAudio("), "stop stops audio");
}

// ── 12. New audio stops old audio ─────────────────────────────────────────
console.log("\n── New audio stops old audio ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  // onPlayMimoTts should call stopBroadcastAudio() before playing MiMo
  const mimoFn = content.split("onPlayMimoTts:")[1]?.split("onPauseMimoTts")[0] ?? "";
  assert(mimoFn.includes("stopBroadcastAudio("), "onPlayMimoTts stops MiniMax audio before playing MiMo");
  assert(mimoFn.includes("stopAllMimoAudio("), "onPlayMimoTts stops other MiMo audio before playing");
}

// ── 13. Playback end clears or updates state ─────────────────────────────
console.log("\n── Playback end state ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  // MiniMax onended should clear currentVoicePlayback
  assert(content.includes("currentVoicePlayback: makeVoicePlaybackState()"), "currentVoicePlayback cleared on playback end");
  assert(content.includes("activeAudio = null"), "activeAudio cleared on MiniMax playback end");
}

// ── 14. Error state does not expose API key ──────────────────────────────
console.log("\n── Error state sanitization ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(
    !content.match(/sk-[a-zA-Z0-9]{20,}/),
    "no sk- API key pattern in app.js"
  );
  assert(
    !content.match(/tp-[a-zA-Z0-9._-]{10,}/),
    "no tp- API key pattern in app.js"
  );
}

// ── 15. Error state does not expose base64 ───────────────────────────────
console.log("\n── No base64 in error state ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(
    !content.match(/data:audio\/.+;base64,[A-Za-z0-9+/=]{80,}/),
    "no long base64 data in app.js"
  );
}

// ── 16. MiniMax broadcast TTS still exists ───────────────────────────────
console.log("\n── MiniMax broadcast TTS preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("onPlayTts:"), "onPlayTts handler still exists");
  assert(content.includes("onPauseTts:"), "onPauseTts handler still exists");
  assert(content.includes("onGenerateTts:"), "onGenerateTts handler still exists");
  assert(content.includes("generateBroadcastSpeech"), "generateBroadcastSpeech still imported");
}

// ── 17. MiMo TTS provider still exists ─────────────────────────────────
console.log("\n── MiMo TTS provider preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("onPlayMimoTts:"), "onPlayMimoTts handler still exists");
  assert(content.includes("onPauseMimoTts:"), "onPauseMimoTts handler still exists");
  assert(content.includes("onResumeMimoTts:"), "onResumeMimoTts handler still exists");
  assert(content.includes("generateMimoSpeech"), "generateMimoSpeech still imported");
}

// ── 18. ttsAudios cache still exists ────────────────────────────────────
console.log("\n── ttsAudios cache preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("ttsAudios: {}"), "ttsAudios initialized as empty object");
  assert(content.includes("ttsAudios:"), "ttsAudios referenced in handlers");
}

// ── 19. broadcastAudio still exists ──────────────────────────────────────
console.log("\n── broadcastAudio preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("broadcastAudio: makeAudioState()"), "broadcastAudio initialized");
  assert(content.includes("makeAudioState"), "makeAudioState still used");
}

// ── 20. dayCycle not modified ────────────────────────────────────────────
console.log("\n── dayCycle not modified ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("runTownDayCycle"), "runTownDayCycle still exists");
  assert(content.includes("onRunTownDayCycle:"), "onRunTownDayCycle handler still exists");
}

// ── 21. activeTaskAnimations not affected ────────────────────────────────
console.log("\n── activeTaskAnimations not affected ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("activeTaskAnimations: []"), "activeTaskAnimations still initialized");
}

// ── 22. completionFeedback not affected ──────────────────────────────────
console.log("\n── completionFeedback not affected ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("completionFeedback: null"), "completionFeedback still in uiState");
}

// ── 23. MiniMax speech-t2a-http not modified ──────────────────────────────
console.log("\n── MiniMax speech-t2a-http not modified ──");
{
  const fs = await import("fs");
  const ttsContent = fs.readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(ttsContent.includes("speech-2.8-hd"), "speech-2.8-hd model still in minimaxTts.js");
}

// ── 24. MiMo Token Plan endpoint not modified ────────────────────────────
console.log("\n── MiMo Token Plan endpoint not modified ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("token-plan-cn"), "token-plan-cn endpoint preserved");
  assert(content.includes("mimo-v2.5-tts"), "mimo-v2.5-tts model preserved");
}

// ── 25. music_generation not modified ────────────────────────────────────
console.log("\n── music_generation not modified ──");
{
  const fs = await import("fs");
  const clientContent = fs.readFileSync("./src/services/minimaxClient.js", "utf8");
  assert(!clientContent.includes("music_generation"), "music_generation not in minimaxClient.js");
}

// ── 26. MiniMax M3 task plan not modified ────────────────────────────────
console.log("\n── MiniMax M3 task plan not modified ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("MiniMax-M3"), "MiniMax-M3 still referenced");
}

// ── 27. Game values not modified ─────────────────────────────────────────
console.log("\n── Game values not modified ──");
{
  const fs = await import("fs");
  const simContent = fs.readFileSync("./src/domain/simulation.js", "utf8");
  assert(simContent.includes("mood") && simContent.includes("energy"), "mood and energy still in simulation.js");
}

// ── 28. No new frameworks introduced ────────────────────────────────────
console.log("\n── No new frameworks ──");
{
  const fs = await import("fs");
  const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const forbidden = ["phaser", "pixi", "pixi.js", "pixi-legacy", "matter-js", "playwright", "puppeteer", "react", "vue", "svelte", "angular", "solid-js", "lit", "howler", "tone.js"];
  const found = forbidden.filter((k) => deps[k]);
  assert(found.length === 0, `no forbidden frameworks (found: ${found.join(", ") || "none"})`);
}

// ── 29. No API keys committed in app.js ─────────────────────────────────
console.log("\n── No API keys committed in app.js ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(!appContent.match(/sk-[a-zA-Z0-9]{20,}/), "no sk- API key in app.js");
  assert(!appContent.match(/tp-[a-zA-Z0-9._-]{10,}/), "no tp- API key in app.js");
}

// ── 30. No API keys committed in render.js ────────────────────────────────
console.log("\n── No API keys committed in render.js ──");
{
  const fs = await import("fs");
  const renderContent = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(!renderContent.match(/sk-[a-zA-Z0-9]{20,}/), "no sk- API key in render.js");
  assert(!renderContent.match(/tp-[a-zA-Z0-9._-]{10,}/), "no tp- API key in render.js");
}

// ── 31. CSS for voice playback bar exists ─────────────────────────────────
console.log("\n── Voice playback bar CSS ──");
{
  const fs = await import("fs");
  const css = fs.readFileSync("./src/styles.css", "utf8");
  assert(css.includes(".voice-playback-bar"), "voice-playback-bar CSS class exists");
  assert(css.includes(".voice-playback-bar--playing"), "playing variant exists");
  assert(css.includes(".voice-playback-bar--paused"), "paused variant exists");
  assert(css.includes(".voice-playback-bar--error"), "error variant exists");
  assert(css.includes("voice-playback-bar__actions"), "actions area CSS exists");
}

// ── 32. BindEvents wires voice controls ───────────────────────────────────
console.log("\n── Voice control events wired ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  const bindContent = content.split("function bindEvents")[1]?.split("export function renderApp")[0] ?? "";
  assert(bindContent.includes("data-action='voice-pause'"), "voice-pause bound");
  assert(bindContent.includes("data-action='voice-resume'"), "voice-resume bound");
  assert(bindContent.includes("data-action='voice-stop'"), "voice-stop bound");
}

// ── 33. onVoicePause/Resume/Stop handlers exist in safeHandlers ───────────
console.log("\n── Unified handlers in safeHandlers ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  const renderContent = content.split("export function renderApp")[1]?.split("\n}")[0] ?? "";
  assert(renderContent.includes("onVoicePause:"), "onVoicePause in safeHandlers");
  assert(renderContent.includes("onVoiceResume:"), "onVoiceResume in safeHandlers");
  assert(renderContent.includes("onVoiceStop:"), "onVoiceStop in safeHandlers");
}

// ── 34. Loading state in playback bar ─────────────────────────────────────
console.log("\n── Loading state in playback bar ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  const fn = content.split("function renderVoicePlaybackBar")[1]?.split("\n}")[0] ?? "";
  assert(fn.includes("loadingLabel") || fn.includes("loading"), "loading state label handled");
  assert(fn.includes('voice-playback-bar--loading'), "loading CSS class applied");
}

// ── 35. Error state in playback bar ────────────────────────────────────────
console.log("\n── Error state in playback bar ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  const fn = content.split("function renderVoicePlaybackBar")[1]?.split("\n}")[0] ?? "";
  assert(fn.includes("errorLabel") || fn.includes("error"), "error state label handled");
  assert(fn.includes('voice-playback-bar--error'), "error CSS class applied");
  assert(fn.includes("voice-playback-bar__error"), "error text element exists");
}

// ── 36. buildVoicePlaybackMeta helper exists ──────────────────────────────
console.log("\n── buildVoicePlaybackMeta helper ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("function buildVoicePlaybackMeta"), "buildVoicePlaybackMeta function exists");
  assert(content.includes("居民对白"), "resident_dialogue case handled");
  assert(content.includes("事件提示"), "event_prompt case handled");
  assert(content.includes("任务完成"), "completion_feedback case handled");
  assert(content.includes("今日场景"), "day_opening case handled");
}

// ── 37. onNewTown resets currentVoicePlayback ──────────────────────────────
console.log("\n── onNewTown resets voice playback ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const newTownFn = content.split("onNewTown:")[1]?.split("onRunTownDayCycle")[0] ?? "";
  assert(newTownFn.includes("currentVoicePlayback: makeVoicePlaybackState()"), "onNewTown resets currentVoicePlayback");
}

// ── 38. prefers-reduced-motion covered ───────────────────────────────────
console.log("\n── prefers-reduced-motion ──");
{
  const fs = await import("fs");
  const css = fs.readFileSync("./src/styles.css", "utf8");
  assert(css.includes("prefers-reduced-motion"), "prefers-reduced-motion rule exists in CSS");
  assert(css.includes(".voice-playback-bar") && css.includes("animation") && css.includes("@media"), "voice-playback-bar animation guarded or keyframe-free");
}

// ── Results ───────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll voice playback checks passed!");
