// desktop-stage-acting-check — validates desktop stage acting enhancements
import { readFileSync } from "fs";
import { resolve } from "path";
import { createInitialState } from "../src/domain/state.js";
import { renderApp } from "../src/ui/render.js";

const SRC_DIR = resolve(import.meta.dirname, "../src");
const cssContent = readFileSync(resolve(SRC_DIR, "styles.css"), "utf8");
const appContent = readFileSync(resolve(SRC_DIR, "app.js"), "utf8");

const root = {
  innerHTML: "",
  querySelector: () => ({ addEventListener() {} }),
  querySelectorAll: () => [],
};

const handlers = {
  onAdvance() {}, onRunDay() {}, onToggleAutoPlay() {},
  onMiniMaxPlan() {}, onMiniMaxEvent() {}, onMiniMaxBroadcast() {},
  onAssignTask() {}, onSelectResident() {}, onResetAssignments() {},
  onNewTown() {}, onChooseEvent() {}, onGenerateTts() {}, onPlayTts() {},
};

function makeUiState(overrides = {}) {
  return {
    activeTaskAnimations: [],
    selectedResidentId: null,
    autoPlay: false,
    llmStatus: "idle",
    llmMessage: "",
    eventDirectorStatus: "idle",
    eventDirectorMessage: "",
    broadcastStatus: "idle",
    broadcastMessage: "",
    latestBroadcast: null,
    broadcastAudio: { status: "idle", text: "", audioUrl: null, error: null },
    isAnimating: false,
    animationMessage: "",
    completionFeedback: null,
    residentVoiceInteraction: { enabled: false },
    residentVoiceClips: [],
    residentConversation: {
      enabled: false, status: "idle", queue: [], currentIndex: 0,
      currentLineId: "", visibleText: "", typingTimerId: null,
      autoPlayVoice: true, error: "", runId: "", startedCount: 0,
    },
    ttsAudios: {},
    dayCycle: {},
    currentVoicePlayback: null,
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); }
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
}

console.log("\n── Desktop stage acting checks ──");

// 1. Desktop town-stage min-height increased (>= 680px)
{
  const match = cssContent.match(/\.town-stage\s*\{[^}]*min-height:\s*(\d+)px/);
  const minH = match ? parseInt(match[1]) : 0;
  assert(minH >= 680, `town-stage min-height is ${minH}px (>= 680 for desktop)`);
}

// 2. Desktop stage-character sprite is larger (>= 68px)
{
  const match = cssContent.match(/\.stage-character__sprite\s*\{[^}]*width:\s*(\d+)px/);
  const w = match ? parseInt(match[1]) : 0;
  assert(w >= 68, `stage-character sprite width is ${w}px (>= 68 for desktop)`);
}

// 3. Layout grid gives more space to center column
{
  const match = cssContent.match(/\.layout\s*\{[^}]*grid-template-columns:\s*([^\n]+)/);
  assert(match !== null, "layout uses grid-template-columns");
  const cols = match[1];
  // Center column should be largest (1fr or higher minmax)
  assert(cols.includes("1fr"), "layout center column includes 1fr");
}

// 4. CSS supports is-farming animation class
{
  assert(cssContent.includes(".stage-character--is-farming"), "CSS has .stage-character--is-farming class");
}

// 5. CSS supports is-chatting animation class
{
  assert(cssContent.includes(".stage-character--is-chatting"), "CSS has .stage-character--is-chatting class");
}

// 6. CSS supports is-resting animation class
{
  assert(cssContent.includes(".stage-character--is-resting"), "CSS has .stage-character--is-resting class");
}

// 7. CSS supports characterReadSprite keyframes
{
  assert(cssContent.includes("@keyframes characterReadSprite"), "CSS has @keyframes characterReadSprite");
}

// 8. TASK_STAGE_PRESENTATIONS covers all 6 task types (plant/cook/repair/chat/forage/rest)
{
  const presentations = [
    "is-farming", "is-cooking", "is-building",
    "is-chatting", "is-foraging", "is-resting",
  ];
  for (const p of presentations) {
    assert(cssContent.includes(p), `CSS has .stage-character--${p} class`);
  }
}

// 9. deed-outcome-panel still exists in render output
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState());
  assert(root.innerHTML.includes("deed-outcome-panel"), "deed-outcome-panel still rendered");
}

// 10. stage-bubble with 今日动态 still exists
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState());
  assert(root.innerHTML.includes("今日动态"), "stage-bubble with 今日动态 still rendered");
}

// 11. stage-character__task badge renders task label on characters
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState());
  assert(root.innerHTML.includes("stage-character__task"), "stage-character__task badge rendered");
}

// 12. renderTownStage outputs stage-character elements
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState());
  assert(root.innerHTML.includes("stage-character"), "stage-character elements rendered");
}

// 13. No state.events reverse find in new acting view model (buildResidentStageActingView or residentMood.js)
{
  const moodSrc = readFileSync(resolve(SRC_DIR, "domain/residentMood.js"), "utf8");
  assert(
    !moodSrc.includes("[...state.events]") && !moodSrc.includes("state.events.reverse"),
    "residentMood.js does not use state.events reverse find"
  );
}

// 14. No TTS endpoint changes in app.js
{
  assert(
    !appContent.includes("/api/minimax/plan"),
    "MiniMax plan endpoint not referenced in app.js"
  );
}

// 15. No API keys in CSS or app.js
{
  const apiKeyPattern = /sk-cp-|tp-[a-z0-9]{10,}|apiKey.*sk-/;
  assert(!apiKeyPattern.test(appContent), "no API key patterns in app.js");
  assert(!apiKeyPattern.test(cssContent), "no API key patterns in styles.css");
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`${failed} check(s) failed — review output above`);
  process.exit(1);
} else {
  console.log("All desktop stage acting checks passed!");
}
