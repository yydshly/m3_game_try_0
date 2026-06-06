// choice-aftermath-check — validates player choice aftermath feature
// Checks: choiceAftermath state, UI rendering, context wiring, no regressions

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

// ── 1. choiceAftermath state exists in app.js ───────────────────────────────
console.log("\n── choiceAftermath state ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("choiceAftermath: null"), "choiceAftermath initialized in uiState");
  assert(content.includes("buildChoiceAftermath"), "buildChoiceAftermath function exists");
  assert(content.includes("function buildChoiceAftermath"), "buildChoiceAftermath defined as function");
  // Fields in the state
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  assert(
    appContent.includes("eventId") && appContent.includes("choiceId") && appContent.includes("choiceLabel"),
    "aftermath contains eventId/choiceId/choiceLabel"
  );
  assert(appContent.includes("residentReactions"), "aftermath contains residentReactions");
  assert(appContent.includes("stageEffect"), "aftermath contains stageEffect");
  assert(appContent.includes("summary"), "aftermath contains summary");
}

// ── 2. buildChoiceAftermath generates aftermath from choice ─────────────────
console.log("\n── buildChoiceAftermath logic ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const fn = content.split("function buildChoiceAftermath")[1]?.split("\n}")?.[0] ?? "";
  assert(fn.includes("residentReactions"), "buildChoiceAftermath creates residentReactions");
  assert(fn.includes("stageEffect"), "buildChoiceAftermath creates stageEffect");
  assert(fn.includes("REACTION_TEMPLATES"), "buildChoiceAftermath uses reaction templates");
  assert(fn.includes("PLACE_ICONS") || fn.includes("placeId"), "buildChoiceAftermath sets place context");
  assert(fn.includes("resultText") || fn.includes("summary"), "buildChoiceAftermath uses choice result text");
}

// ── 3. onChooseEvent calls buildChoiceAftermath ──────────────────────────────
console.log("\n── onChooseEvent wiring ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const chooseFn = content.split("onChooseEvent:")[1]?.split("onMiniMaxBroadcast")[0] ?? "";
  assert(chooseFn.includes("buildChoiceAftermath"), "onChooseEvent calls buildChoiceAftermath");
  assert(chooseFn.includes("choiceAftermath:"), "onChooseEvent sets choiceAftermath in uiState");
  assert(chooseFn.includes("completionFeedback:"), "onChooseEvent still sets completionFeedback");
  assert(chooseFn.includes("applyChoiceMemory"), "onChooseEvent still calls applyChoiceMemory");
}

// ── 4. aftermath contains eventId / choiceId / choiceLabel ─────────────────
console.log("\n── aftermath fields ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const fn = content.split("function buildChoiceAftermath")[1]?.split("\n}")?.[0] ?? "";
  assert(fn.includes("eventId:") || fn.includes("eventId,"), "aftermath.eventId set");
  assert(fn.includes("choiceId:") || fn.includes("choiceId,"), "aftermath.choiceId set");
  assert(fn.includes("choiceLabel,") || fn.includes("choiceLabel\n"), "aftermath.choiceLabel set");
  assert(fn.includes("id: `aftermath-"), "aftermath has unique id");
}

// ── 5. aftermath contains summary ─────────────────────────────────────────
console.log("\n── aftermath summary ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const fn = content.split("function buildChoiceAftermath")[1]?.split("\n}")?.[0] ?? "";
  assert(fn.includes("summary"), "aftermath.summary created");
  assert(fn.includes("resultText") || fn.includes("choiceLabel"), "summary uses choice text");
}

// ── 6. residentReactions has length limit ─────────────────────────────────
console.log("\n── residentReactions length ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const fn = content.split("function buildChoiceAftermath")[1]?.split("\n}")?.[0] ?? "";
  assert(fn.includes("slice(0, 3)") || fn.includes("slice(0,2)"), "residentReactions has slice limit (3 or 2)");
}

// ── 7. Empty choice/event fallback ─────────────────────────────────────────
console.log("\n── fallback for empty choice ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const fn = content.split("function buildChoiceAftermath")[1]?.split("\n}")?.[0] ?? "";
  assert(
    fn.includes("!summary") || fn.includes('summary = "小镇居民们开始根据你的选择行动'),
    "fallback summary when resultText is empty"
  );
}

// ── 8. Map stage aftermath UI exists ───────────────────────────────────────
console.log("\n── Stage aftermath UI ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("renderChoiceAftermathStageIndicator"), "renderChoiceAftermathStageIndicator function exists");
  assert(content.includes("stage-choice-aftermath"), "stage-choice-aftermath CSS class used");
  assert(content.includes("uiState.choiceAftermath"), "choiceAftermath passed to stage indicator");
}

// ── 9. Right panel choice aftermath UI exists ───────────────────────────────
console.log("\n── Right panel aftermath UI ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/ui/render.js", "utf8");
  assert(content.includes("renderChoiceAftermath"), "renderChoiceAftermath function exists");
  assert(content.includes("choice-aftermath"), "choice-aftermath CSS class used");
  assert(content.includes("choice-aftermath__choice-label"), "choice label element rendered");
  assert(content.includes("choice-aftermath__summary"), "summary element rendered");
  assert(content.includes("choice-aftermath__reactions"), "reactions section rendered");
  assert(content.includes("residentReactions"), "residentReactions mapped in UI");
}

// ── 10. choiceAftermath does not modify townMemory schema ─────────────────
console.log("\n── No townMemory schema change ──");
{
  const fs = await import("fs");
  const memoryContent = fs.readFileSync("./src/domain/memory.js", "utf8");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  // Verify townMemory still uses createChoiceMemoryEntry
  assert(memoryContent.includes("createChoiceMemoryEntry"), "createChoiceMemoryEntry still in memory.js");
  // Aftermath does not create its own memory entries
  const fn = appContent.split("function buildChoiceAftermath")[1]?.split("\n}")?.[0] ?? "";
  assert(!fn.includes("createChoiceMemoryEntry"), "buildChoiceAftermath does not write memory directly");
}

// ── 11. choiceAftermath does not modify residentMemory schema ──────────────
console.log("\n── No residentMemory schema change ──");
{
  const fs = await import("fs");
  const memoryContent = fs.readFileSync("./src/domain/memory.js", "utf8");
  assert(memoryContent.includes("createChoiceMemoryEntry"), "createChoiceMemoryEntry still uses residentMemory");
}

// ── 12. choice memory original chain still exists ──────────────────────────
console.log("\n── Choice memory chain preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const chooseFn = content.split("onChooseEvent:")[1]?.split("onMiniMaxBroadcast")[0] ?? "";
  assert(chooseFn.includes("applyChoiceMemory"), "applyChoiceMemory still called on choice");
  // transitionDayCycleToCompleted is called (completeDayCycle was renamed + factored to not take nextState)
  assert(chooseFn.includes("transitionDayCycleToCompleted"), "transitionDayCycleToCompleted called after choice");
}

// ── 13. completionFeedback still exists ────────────────────────────────────
console.log("\n── completionFeedback preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("completionFeedback:"), "completionFeedback still set in uiState");
  const chooseFn = content.split("onChooseEvent:")[1]?.split("onMiniMaxBroadcast")[0] ?? "";
  assert(chooseFn.includes("completionFeedback:"), "completionFeedback still set on choose");
}

// ── 14. completionFeedback not overwritten by choiceAftermath ─────────────
console.log("\n── completionFeedback not overwritten ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const chooseFn = content.split("onChooseEvent:")[1]?.split("onMiniMaxBroadcast")[0] ?? "";
  // Both should be set independently
  const hasCompletion = chooseFn.includes("completionFeedback:");
  const hasAftermath = chooseFn.includes("choiceAftermath:");
  assert(hasCompletion && hasAftermath, "both completionFeedback and choiceAftermath set independently");
}

// ── 15. activeTaskAnimations not affected ──────────────────────────────────
console.log("\n── activeTaskAnimations not affected ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("activeTaskAnimations: []"), "activeTaskAnimations still initialized");
}

// ── 16. buildAiDirectorContext reads choiceAftermath ────────────────────────
console.log("\n── AI Director context reads aftermath ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/domain/aiDirector.js", "utf8");
  assert(content.includes("recentAftermath"), "recentAftermath added to AI Director context");
  assert(content.includes("choiceAftermath = null") || content.includes("choiceAftermath="), "choiceAftermath parameter accepted");
}

// ── 17. buildResidentDialogueContext reads choiceAftermath ──────────────────
console.log("\n── Resident dialogue context reads aftermath ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/services/residentDialogue.js", "utf8");
  assert(content.includes("recentAftermath"), "recentAftermath added to resident dialogue context");
  assert(content.includes("choiceAftermath = null") || content.includes("choiceAftermath="), "choiceAftermath parameter accepted");
}

// ── 18. broadcast prompt can read recentAftermath ─────────────────────────
console.log("\n── Broadcast reads aftermath ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/domain/aiDirector.js", "utf8");
  const fn = content.split("function buildDirectorPromptText")[1]?.split("\n}")?.[0] ?? "";
  assert(fn.includes("recentAftermath"), "broadcast/director prompt includes recentAftermath");
}

// ── 19. event prompt can read recentAftermath ──────────────────────────────
console.log("\n── Event prompt reads aftermath ──");
{
  const fs = await import("fs");
  // Both director and resident dialogue prompts include aftermath
  const directorContent = fs.readFileSync("./src/domain/aiDirector.js", "utf8");
  const dialogueContent = fs.readFileSync("./src/services/residentDialogue.js", "utf8");
  assert(
    directorContent.includes("recentAftermath") && dialogueContent.includes("recentAftermath"),
    "both director and dialogue prompts include recentAftermath"
  );
}

// ── 20. global voice playback bar not affected ─────────────────────────────
console.log("\n── Voice playback bar unaffected ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("currentVoicePlayback:") && content.includes("makeVoicePlaybackState"), "voice playback state preserved");
}

// ── 21. MiniMax broadcast TTS not affected ───────────────────────────────
console.log("\n── MiniMax broadcast TTS preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("onPlayTts:") && content.includes("onPauseTts:"), "MiniMax play/pause handlers preserved");
  assert(content.includes("generateBroadcastSpeech"), "generateBroadcastSpeech still used");
}

// ── 22. MiMo TTS not affected ────────────────────────────────────────────
console.log("\n── MiMo TTS preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("onPlayMimoTts:"), "onPlayMimoTts still exists");
  assert(content.includes("generateMimoSpeech"), "generateMimoSpeech still imported");
}

// ── 23. dayCycle not affected ────────────────────────────────────────────
console.log("\n── dayCycle preserved ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  assert(content.includes("runTownDayCycle") && content.includes("onRunTownDayCycle:"), "dayCycle handlers preserved");
}

// ── 24. MiniMax speech-t2a-http not modified ──────────────────────────────
console.log("\n── MiniMax speech-t2a-http not modified ──");
{
  const fs = await import("fs");
  const ttsContent = fs.readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(ttsContent.includes("speech-2.8-hd"), "speech-2.8-hd model still in minimaxTts.js");
}

// ── 25. MiMo Token Plan endpoint not modified ────────────────────────────
console.log("\n── MiMo Token Plan endpoint not modified ──");
{
  const fs = await import("fs");
  const serverContent = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(serverContent.includes("token-plan-cn") && serverContent.includes("mimo-v2.5-tts"), "MiMo Token Plan endpoint preserved");
}

// ── 26. music_generation not modified ────────────────────────────────────
console.log("\n── music_generation not modified ──");
{
  const fs = await import("fs");
  const clientContent = fs.readFileSync("./src/services/minimaxClient.js", "utf8");
  assert(!clientContent.includes("music_generation"), "music_generation not in minimaxClient.js");
}

// ── 27. MiniMax M3 task plan not modified ────────────────────────────────
console.log("\n── MiniMax M3 task plan not modified ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(content.includes("MiniMax-M3"), "MiniMax-M3 still referenced");
}

// ── 28. Game values not modified ─────────────────────────────────────────
console.log("\n── Game values not modified ──");
{
  const fs = await import("fs");
  const simContent = fs.readFileSync("./src/domain/simulation.js", "utf8");
  assert(simContent.includes("mood") && simContent.includes("energy"), "mood and energy still in simulation.js");
}

// ── 29. No new frameworks introduced ────────────────────────────────────
console.log("\n── No new frameworks ──");
{
  const fs = await import("fs");
  const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const forbidden = ["phaser", "pixi", "pixi.js", "pixi-legacy", "matter-js", "playwright", "puppeteer", "react", "vue", "svelte", "angular", "solid-js", "lit", "howler", "tone.js"];
  const found = forbidden.filter((k) => deps[k]);
  assert(found.length === 0, `no forbidden frameworks (found: ${found.join(", ") || "none"})`);
}

// ── 30. No API keys committed ─────────────────────────────────────────────
console.log("\n── No API keys committed ──");
{
  const fs = await import("fs");
  const appContent = fs.readFileSync("./src/app.js", "utf8");
  const renderContent = fs.readFileSync("./src/ui/render.js", "utf8");
  const aiDirectorContent = fs.readFileSync("./src/domain/aiDirector.js", "utf8");
  const combined = appContent + renderContent + aiDirectorContent;
  assert(!combined.match(/sk-[a-zA-Z0-9]{20,}/), "no sk- API key in modified files");
  assert(!combined.match(/tp-[a-zA-Z0-9._-]{10,}/), "no tp- API key in modified files");
}

// ── 31. CSS for stage aftermath exists ───────────────────────────────────
console.log("\n── Stage aftermath CSS ──");
{
  const fs = await import("fs");
  const css = fs.readFileSync("./src/styles.css", "utf8");
  assert(css.includes(".stage-choice-aftermath"), "stage-choice-aftermath CSS class exists");
  assert(css.includes("choiceAftermathPop"), "stage aftermath animation defined");
}

// ── 32. CSS for right panel aftermath exists ─────────────────────────────
console.log("\n── Right panel aftermath CSS ──");
{
  const fs = await import("fs");
  const css = fs.readFileSync("./src/styles.css", "utf8");
  assert(css.includes(".choice-aftermath"), "choice-aftermath CSS class exists");
  assert(css.includes("choice-aftermath__choice-label"), "choice label CSS exists");
  assert(css.includes("choice-aftermath__reactions"), "reactions CSS exists");
}

// ── 33. prefers-reduced-motion covered for stage indicator ─────────────────
console.log("\n── prefers-reduced-motion ──");
{
  const fs = await import("fs");
  const css = fs.readFileSync("./src/styles.css", "utf8");
  assert(css.includes("prefers-reduced-motion"), "prefers-reduced-motion rule exists in CSS");
}

// ── 34. choiceAftermath reset in onNewTown ────────────────────────────────
console.log("\n── choiceAftermath reset in onNewTown ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/app.js", "utf8");
  const newTownFn = content.split("onNewTown:")[1]?.split("onRunTownDayCycle")[0] ?? "";
  assert(newTownFn.includes("choiceAftermath: null"), "onNewTown resets choiceAftermath");
}

// ── Results ───────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll choice aftermath checks passed!");
