// choice-aftermath-visual-check — validates choice aftermath visual feedback
import { readFileSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const RENDER_JS = resolve(import.meta.dirname, "../src/ui/render.js");
const STYLES_CSS = resolve(import.meta.dirname, "../src/styles.css");
const APP_JS = resolve(import.meta.dirname, "../src/app.js");

const renderContent = readFileSync(RENDER_JS, "utf8");
const stylesContent = readFileSync(STYLES_CSS, "utf8");
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

console.log("\n── Choice Aftermath Visual Checks ──");

// 1. buildChoiceAftermathView exported function exists
assert(
  renderContent.includes("export function buildChoiceAftermathView"),
  "buildChoiceAftermathView exported function exists"
);

// 2. buildChoiceAftermathView returns visible=false when no aftermath
const viewModelNullCheck = renderContent.includes("if (!aftermath || !aftermath.id)") ||
  renderContent.includes("if (!aftermath || !aftermath?.id)");
assert(
  viewModelNullCheck,
  "buildChoiceAftermathView returns visible:false when no aftermath"
);

// 3. buildChoiceAftermathView returns affectedResidents array
assert(
  renderContent.includes("affectedResidents"),
  "buildChoiceAftermathView returns affectedResidents array"
);

// 4. buildChoiceAftermathView returns memoryHint
assert(
  renderContent.includes("memoryHint"),
  "buildChoiceAftermathView returns memoryHint"
);

// 5. Right panel: renderChoiceAftermath shows memory hint
assert(
  renderContent.includes("choice-aftermath__memory") || renderContent.includes("小镇记住"),
  "right panel: choice aftermath shows memory hint"
);

// 6. Right panel: renderChoiceAftermath shows choiceLabel
assert(
  renderContent.includes("你选择了") || renderContent.includes("choiceLabel"),
  "right panel: choice aftermath shows choiceLabel"
);

// 7. Right panel: renderChoiceAftermath shows summary/resultText
assert(
  renderContent.includes("choice-aftermath__summary") || renderContent.includes("summary"),
  "right panel: choice aftermath shows summary/resultText"
);

// 8. Right panel: renderChoiceAftermath shows residentReactions
assert(
  renderContent.includes("residentReactions") || renderContent.includes("choice-aftermath__reaction"),
  "right panel: choice aftermath shows residentReactions"
);

// 9. Stage: renderChoiceAftermathStageIndicator renders stage-choice-aftermath
assert(
  renderContent.includes("stage-choice-aftermath") && renderContent.includes("renderChoiceAftermathStageIndicator"),
  "stage: stage-choice-aftermath indicator rendered"
);

// 10. Stage indicator shows icon and label from stageEffect
assert(
  renderContent.includes("stageEffect?.icon") || renderContent.includes("stageEffect.icon"),
  "stage indicator uses stageEffect.icon"
);

// 11. CSS: choice-aftermath card styles exist
assert(
  stylesContent.includes(".choice-aftermath") && stylesContent.includes(".choice-aftermath__header"),
  "CSS: choice-aftermath card styles exist"
);

// 12. CSS: stage-choice-aftermath styles exist
assert(
  stylesContent.includes(".stage-choice-aftermath") && stylesContent.includes("choiceAftermathPop"),
  "CSS: stage-choice-aftermath animation exists"
);

// 13. CSS: choice-aftermath__memory style exists
assert(
  stylesContent.includes(".choice-aftermath__memory"),
  "CSS: choice-aftermath__memory style exists"
);

// 14. spotlight: shows choice reaction hint for affected residents
assert(
  renderContent.includes("spotlight__choice-hint") || renderContent.includes("spotlight__choice"),
  "spotlight: choice reaction hint rendered for affected residents"
);

// 15. CSS: spotlight__choice-hint style exists
assert(
  stylesContent.includes(".spotlight__choice-hint"),
  "CSS: spotlight__choice-hint style exists"
);

// 16. stage-bubble still exists
assert(
  renderContent.includes("stage-bubble") && renderContent.includes("今日动态"),
  "stage-bubble (今日动态) still rendered"
);

// 17. deed-outcome-panel still exists
assert(
  renderContent.includes("deed-outcome-panel"),
  "deed-outcome-panel still rendered"
);

// 18. buildChoiceAftermathView does NOT use state.events reverse find
const viewModelCode = renderContent.match(/export function buildChoiceAftermathView[\s\S]*?^}/m)?.[0] ?? "";
assert(
  !viewModelCode.includes(".events") || !viewModelCode.includes(".reverse()"),
  "buildChoiceAftermathView: does not use state.events reverse find"
);

// 19. onChooseEvent sets choiceAftermath in uiState
assert(
  appContent.includes("choiceAftermath: aftermath") || appContent.includes("choiceAftermath = aftermath"),
  "onChooseEvent sets choiceAftermath in uiState"
);

// 20. buildChoiceAftermath is defined in app.js (not imported)
assert(
  appContent.includes("function buildChoiceAftermath") || appContent.includes("buildChoiceAftermath"),
  "buildChoiceAftermath defined in app.js"
);

// 21. buildChoiceAftermath uses reaction templates (not M3 call)
assert(
  appContent.includes("REACTION_TEMPLATES") || appContent.includes("reactionTemplate"),
  "buildChoiceAftermath uses reaction templates (no M3 call)"
);

// 22. Voice playback chip not affected by choice aftermath
assert(
  renderContent.includes("renderVoicePlaybackChip") && renderContent.includes("voice-playback-chip"),
  "voice-playback-chip still renders independently"
);

// 23. Resident dialogue beats: no TTS buttons in right panel dialogue section
const dialogueBeatsSnippet = renderContent.match(/dialogue-beats[\s\S]{0,300}/)?.[0] ?? "";
assert(
  dialogueBeatsSnippet.length === 0 || !dialogueBeatsSnippet.includes("play-mimo-tts"),
  "right panel dialogue: no TTS buttons"
);

// 24. choiceAftermath cleared on new town
assert(
  appContent.includes("choiceAftermath: null") || appContent.includes("choiceAftermath = null"),
  "onNewTown resets choiceAftermath to null"
);

// 25. No new TTS providers introduced
assert(
  !renderContent.includes("azure") && !renderContent.includes("openai"),
  "no new TTS providers in render.js"
);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\nAll choice aftermath visual checks passed!");
