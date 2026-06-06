// day-reflection-check — validates next-day memory reflection feature
// Checks: dayOpeningReflection state, buildDayOpeningReflection, UI rendering,
// context wiring to AI Director/resident dialogue/broadcast/event, no regressions

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

// ── 1. dayOpeningReflection state exists in app.js ────────────────────────────
console.log("\n── dayOpeningReflection state ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("dayOpeningReflection: null"), "dayOpeningReflection initialized in uiState");
  assert(content.includes("dayOpeningReflection: null, // { id, sourceType"), "dayOpeningReflection has expected comment");
}

// ── 2. buildDayOpeningReflection function exists ──────────────────────────────
console.log("\n── buildDayOpeningReflection function ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("function buildDayOpeningReflection"), "buildDayOpeningReflection defined as function");
  const fn = content.split("function buildDayOpeningReflection")[1]?.split("\n}\n")[0] ?? "";
  assert(fn.includes("sourceType"), "reads sourceType priority");
  assert(fn.includes("choiceAftermath"), "reads choiceAftermath (priority 1)");
  assert(fn.includes("townMemory"), "reads townMemory (priority 2)");
  assert(fn.includes("residentMemory") || fn.includes("r.memory"), "reads residentMemory (priority 3)");
  assert(fn.includes("fallback"), "has fallback for no memory");
}

// ── 3. dayOpeningReflection reads choiceAftermath ────────────────────────────
console.log("\n── dayOpeningReflection reads choiceAftermath ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const fn = content.split("function buildDayOpeningReflection")[1]?.split("\n}\n")[0] ?? "";
  assert(fn.includes("uiState.choiceAftermath") || fn.includes("choiceAftermath"), "reads choiceAftermath");
  assert(fn.includes("choiceAftermath.choiceLabel") || fn.includes("ca.choiceLabel"), "uses choiceLabel from aftermath");
  assert(fn.includes("choiceAftermath.summary") || fn.includes("ca.summary"), "uses summary from aftermath");
}

// ── 4. dayOpeningReflection reads townMemory player-choice ───────────────────
console.log("\n── dayOpeningReflection reads townMemory ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const fn = content.split("function buildDayOpeningReflection")[1]?.split("\n}\n")[0] ?? "";
  assert(fn.includes("player-choice") || fn.includes("choice-memory"), "filters townMemory by player-choice type");
  assert(fn.includes("last.text") || fn.includes("text:"), "uses memory text");
}

// ── 5. dayOpeningReflection reads residentMemory ─────────────────────────────
console.log("\n── dayOpeningReflection reads residentMemory ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const fn = content.split("function buildDayOpeningReflection")[1]?.split("\n}\n")[0] ?? "";
  assert(fn.includes("resident.memory") || fn.includes("r.memory"), "reads resident.memory");
}

// ── 6. dayOpeningReflection has fallback ────────────────────────────────────
console.log("\n── dayOpeningReflection fallback ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const fn = content.split("function buildDayOpeningReflection")[1]?.split("\n}\n")[0] ?? "";
  assert(fn.includes('"fallback"') || fn.includes("fallback"), "has fallback sourceType");
  assert(fn.includes("新的一天") || fn.includes("又开始"), "fallback summary is gentle");
}

// ── 7. runTownDayCycle generates openingReflection ───────────────────────────
console.log("\n── runTownDayCycle generates openingReflection ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const cycleFn = content.split("async function runTownDayCycle")[1]?.split("\n}\n")[0] ?? "";
  assert(cycleFn.includes("buildDayOpeningReflection"), "runTownDayCycle calls buildDayOpeningReflection");
  assert(cycleFn.includes("dayOpeningReflection:") || cycleFn.includes("openingReflection"), "sets dayOpeningReflection in uiState");
}

// ── 8. Left panel UI renders dayOpeningReflection ────────────────────────────
console.log("\n── Left panel UI for dayOpeningReflection ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("renderDayOpeningReflection"), "renderDayOpeningReflection function exists");
  assert(content.includes("day-opening-reflection"), "day-opening-reflection CSS class used");
  assert(content.includes("dayOpeningReflection") && content.includes("safeUiState.dayOpeningReflection"), "dayOpeningReflection passed to render");
}

// ── 9. Stage map UI renders openingReflection indicator ──────────────────────
console.log("\n── Stage map openingReflection indicator ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("stage-opening-reflection"), "stage-opening-reflection CSS class used");
  assert(content.includes("stage-opening-reflection__icon"), "stage-opening-reflection icon element");
  assert(content.includes("stage-opening-reflection__text"), "stage-opening-reflection text element");
}

// ── 10. buildAiDirectorContext accepts openingReflection ────────────────────
console.log("\n── AI Director reads openingReflection ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/domain/aiDirector.js", "utf8");
  assert(content.includes("openingReflection = null") || content.includes("openingReflection=null"), "openingReflection parameter accepted");
  assert(content.includes("openingReflectionText = openingReflection?.summary"), "uses openingReflection.summary");
  assert(content.includes("openingReflection:"), "openingReflection field returned in context");
}

// ── 11. buildResidentDialogueContext accepts openingReflection ───────────────
console.log("\n── Resident dialogue reads openingReflection ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/services/residentDialogue.js", "utf8");
  assert(content.includes("openingReflection = null") || content.includes("openingReflection=null"), "openingReflection parameter accepted");
  assert(content.includes("openingReflectionText = openingReflection?.summary"), "uses openingReflection.summary");
  assert(content.includes("openingReflection:"), "openingReflection field returned in context");
}

// ── 12. Broadcast prompt reads openingReflection ────────────────────────────
console.log("\n── Broadcast prompt reads openingReflection ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/domain/aiDirector.js", "utf8");
  const fn = content.split("function buildDirectorPromptText")[1]?.split("\n}")[0] ?? "";
  assert(fn.includes("openingReflectionText"), "director prompt includes openingReflectionText");
  assert(fn.includes("昨日回响"), "prompt text includes 昨日回响 label");
}

// ── 13. Event prompt reads openingReflection ──────────────────────────────────
console.log("\n── Event prompt reads openingReflection ──");
{
  const fs = await import("fs");
  // AI Director context is reused for events, so same check as broadcast
  const directorContent = fs.readFileSync("./src/domain/aiDirector.js", "utf8");
  assert(directorContent.includes("openingReflectionText"), "director prompt (used for events) includes openingReflectionText");
}

// ── 14. choiceAftermath still works ─────────────────────────────────────────
console.log("\n── choiceAftermath still works ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("buildChoiceAftermath"), "buildChoiceAftermath still exists");
  assert(content.includes("choiceAftermath:") && content.includes("aftermath"), "choiceAftermath still set in onChooseEvent");
}

// ── 15. choice memory still written ─────────────────────────────────────────
console.log("\n── choice memory still written ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const memoryContent = fs.readFileSync("./src/domain/memory.js", "utf8");
  assert(content.includes("applyChoiceMemory"), "applyChoiceMemory still called from app.js");
  assert(memoryContent.includes("createChoiceMemoryEntry"), "createChoiceMemoryEntry still in memory.js");
}

// ── 16. townMemory / residentMemory still written ────────────────────────────
console.log("\n── townMemory / residentMemory still written ──");
{
  const fs = await import("fs");
  const memoryContent = fs.readFileSync("./src/domain/memory.js", "utf8");
  assert(memoryContent.includes("applyChoiceMemory"), "applyChoiceMemory still in memory.js");
  assert(memoryContent.includes("createChoiceMemoryEntry"), "createChoiceMemoryEntry still in memory.js");
}

// ── 17. completionFeedback still works ──────────────────────────────────────
console.log("\n── completionFeedback preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("completionFeedback:") && content.includes("buildCompletionFeedback"), "completionFeedback still set");
}

// ── 18. activeTaskAnimations still works ────────────────────────────────────
console.log("\n── activeTaskAnimations preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("activeTaskAnimations: []"), "activeTaskAnimations still initialized");
  assert(content.includes("showTaskAnimations"), "showTaskAnimations still exists");
}

// ── 19. global voice playback bar still works ───────────────────────────────
console.log("\n── Global voice playback bar preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("currentVoicePlayback:") && content.includes("makeVoicePlaybackState"), "voice playback state preserved");
}

// ── 20. MiniMax broadcast TTS still works ───────────────────────────────────
console.log("\n── MiniMax broadcast TTS preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("onPlayTts:") && content.includes("onPauseTts:"), "MiniMax play/pause handlers preserved");
  assert(content.includes("generateBroadcastSpeech"), "generateBroadcastSpeech still used");
}

// ── 21. MiMo TTS still works ────────────────────────────────────────────────
console.log("\n── MiMo TTS preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("onPlayMimoTts:"), "onPlayMimoTts still exists");
  assert(content.includes("generateMimoSpeech"), "generateMimoSpeech still imported");
}

// ── 22. dayCycle state machine not broken ───────────────────────────────────
console.log("\n── dayCycle state machine preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("DAY_CYCLE_DEFAULT"), "DAY_CYCLE_DEFAULT still defined");
  assert(content.includes("runTownDayCycle") && content.includes("onRunTownDayCycle:"), "dayCycle handlers preserved");
  assert(content.includes("status:") && content.includes("running") && content.includes("waiting_choice"), "dayCycle status states preserved");
}

// ── 23. MiniMax speech-t2a-http not modified ────────────────────────────────
console.log("\n── MiniMax speech-t2a-http not modified ──");
{
  const fs = await import("fs");
  const ttsContent = fs.readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(ttsContent.includes("speech-2.8-hd"), "speech-2.8-hd model still in minimaxTts.js");
}

// ── 24. MiMo Token Plan endpoint not modified ────────────────────────────────
console.log("\n── MiMo Token Plan endpoint not modified ──");
{
  const fs = await import("fs");
  const serverContent = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(serverContent.includes("token-plan-cn") && serverContent.includes("mimo-v2.5-tts"), "MiMo Token Plan endpoint preserved");
}

// ── 25. music_generation not modified ──────────────────────────────────────
console.log("\n── music_generation not modified ──");
{
  const fs = await import("fs");
  const clientContent = fs.readFileSync("./src/services/minimaxClient.js", "utf8");
  assert(!clientContent.includes("music_generation"), "music_generation not in minimaxClient.js");
}

// ── 26. MiniMax M3 task plan not modified ──────────────────────────────────
console.log("\n── MiniMax M3 task plan not modified ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("MiniMax-M3"), "MiniMax-M3 still referenced");
}

// ── 27. Game values not modified ───────────────────────────────────────────
console.log("\n── Game values not modified ──");
{
  const fs = await import("fs");
  const simContent = fs.readFileSync("./src/domain/simulation.js", "utf8");
  assert(simContent.includes("mood") && simContent.includes("energy"), "mood and energy still in simulation.js");
}

// ── 28. No API keys committed ───────────────────────────────────────────────
console.log("\n── No API keys committed ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  const renderContent = fs.readFileSync("./src/ui/render.js", "utf8");
  const aiDirectorContent = fs.readFileSync("./src/domain/aiDirector.js", "utf8");
  const dialogueContent = fs.readFileSync("./src/services/residentDialogue.js", "utf8");
  const combined = appContent + renderContent + aiDirectorContent + dialogueContent;
  assert(!combined.match(/sk-[a-zA-Z0-9]{20,}/), "no sk- API key in modified files");
  assert(!combined.match(/tp-[a-zA-Z0-9._-]{10,}/), "no tp- API key in modified files");
}

// ── 29. No base64 audio committed ──────────────────────────────────────────
console.log("\n── No base64 audio committed ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(!appContent.includes("data:audio/"), "no data:audio/;base64 in app.js");
  assert(!appContent.includes("base64,"), "no base64 audio data in app.js");
}

// ── 30. dayOpeningReflection CSS exists ──────────────────────────────────────
console.log("\n── dayOpeningReflection CSS ──");
{
  const fs = await import("fs");
  const css = fs.readFileSync("./src/styles.css", "utf8");
  assert(css.includes(".day-opening-reflection"), "day-opening-reflection CSS class exists");
  assert(css.includes("day-opening-reflection__header"), "day-opening-reflection header CSS exists");
  assert(css.includes("day-opening-reflection__summary"), "day-opening-reflection summary CSS exists");
}

// ── 31. stage-opening-reflection CSS exists ────────────────────────────────
console.log("\n── stage-opening-reflection CSS ──");
{
  const fs = await import("fs");
  const css = fs.readFileSync("./src/styles.css", "utf8");
  assert(css.includes(".stage-opening-reflection"), "stage-opening-reflection CSS class exists");
  assert(css.includes("stage-opening-reflection__icon"), "stage-opening-reflection icon CSS exists");
  assert(css.includes("stage-opening-reflection__text"), "stage-opening-reflection text CSS exists");
}

// ── 32. prefers-reduced-motion covered for stage indicator ─────────────────
console.log("\n── prefers-reduced-motion ──");
{
  const fs = await import("fs");
  const css = fs.readFileSync("./src/styles.css", "utf8");
  assert(css.includes("prefers-reduced-motion"), "prefers-reduced-motion rule exists in CSS");
}

// ── 33. dayOpeningReflection reset in onNewTown ─────────────────────────────
console.log("\n── dayOpeningReflection reset in onNewTown ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const newTownFn = content.split("onNewTown:")[1]?.split("onRunTownDayCycle")[0] ?? "";
  assert(newTownFn.includes("dayOpeningReflection: null"), "onNewTown resets dayOpeningReflection");
}

// ── 34. openingReflection passed to requestMiniMaxResidentDialogues ──────────
console.log("\n── openingReflection passed to resident dialogues ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("requestMiniMaxResidentDialogues(next, directorCtx, uiState.choiceAftermath, openingReflection)"), "openingReflection passed to resident dialogues");
}

// ── 35. openingReflection field returned from buildResidentDialogueContext ──
console.log("\n── openingReflection in resident dialogue context ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/services/residentDialogue.js", "utf8");
  const fn = content.split("function buildResidentDialoguePromptText")[1]?.split("\n}")[0] ?? "";
  assert(fn.includes("openingReflectionText"), "resident dialogue prompt text includes openingReflectionText");
}

// ── Results ─────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll day reflection checks passed!");
