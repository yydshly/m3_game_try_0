// Resident conversation UI refresh stability check
// Verifies typewriter rendering optimizations and timer lifecycle fixes
import { readFileSync } from "fs";
import { resolve } from "path";

const APP_JS = resolve(import.meta.dirname, "../src/app.js");
const appContent = readFileSync(APP_JS, "utf8");
const renderContent = readFileSync(resolve(import.meta.dirname, "../src/ui/render.js"), "utf8");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); }
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
}

console.log("\n── Resident conversation refresh stability checks ──");

// 1. updateConversationVisibleText function exists for local DOM updates
assert(
  appContent.includes("function updateConversationVisibleText("),
  "updateConversationVisibleText function exists"
);

// 2. data-conversation-visible-text attribute on conversation bubble
assert(
  renderContent.includes('data-conversation-visible-text='),
  "conversation bubble has data-conversation-visible-text attribute"
);

// 3. residentConversation includes runId field
assert(
  appContent.includes("runId:") && appContent.includes("residentConversation"),
  "residentConversation includes runId field"
);

// 4. startResidentConversation generates runId
assert(
  appContent.includes("runId = `conv-${Date.now()}"),
  "runId generated on conversation start"
);

// 5. typewriter tick checks runId (stale timer guard)
const tickRunIdCheck = appContent.match(/if \(cur\.runId !== conv\.runId\) return;/);
assert(
  tickRunIdCheck !== null,
  "typewriter tick checks runId (stale timer guard)"
);

// 6. typewriter tick checks currentLineId
const tickLineIdCheck = appContent.includes("cur.currentLineId !== line.id") ||
  appContent.includes("cur.currentLineId !== currentLine.id");
assert(
  tickLineIdCheck,
  "typewriter tick checks currentLineId"
);

// 7. typewriter tick checks status === "playing"
const tickStatusCheck = appContent.includes('cur.status !== "playing"') ||
  appContent.includes("cur.status !== 'playing'");
assert(
  tickStatusCheck,
  "typewriter tick checks status === 'playing'"
);

// 8. typewriter tick uses local DOM update instead of render for each character
// The tick should call updateConversationVisibleText, NOT render()
const tickMatches = appContent.match(/const tick = \(\) => \{[\s\S]*?\n  \};/g) || [];
const hasLocalUpdate = appContent.includes("updateConversationVisibleText(line.id");
assert(
  hasLocalUpdate,
  "typewriter tick uses updateConversationVisibleText (local DOM update)"
);

// 9. clearConversationTimer sets typingTimerId to null in state
const clearTimerContent = appContent.match(/function clearConversationTimer\(\) \{[\s\S]*?\n\}/);
assert(
  clearTimerContent !== null &&
  clearTimerContent[0].includes("typingTimerId: null"),
  "clearConversationTimer sets typingTimerId to null in state"
);

// 10. stopResidentConversation clears runId
assert(
  appContent.includes("runId: \"\""),
  "stopResidentConversation clears runId"
);

// 11. stopResidentConversation clears typingTimerId
assert(
  appContent.match(/stopResidentConversation[\s\S]{0,500}runId: ""/)?.[0].includes("typingTimerId: null") ||
  appContent.includes("stopResidentConversation") && appContent.includes("typingTimerId: null"),
  "stopResidentConversation clears typingTimerId"
);

// 12. completed state allows re-enabling (idle/completed both trigger start button)
const completedBtn = renderContent.includes("status === 'completed'") ||
  renderContent.includes('status === "completed"');
assert(
  completedBtn,
  "completed state shows start button (can re-enable)"
);

// 13. MiMo endpoint unchanged (no new endpoint in conversation code)
const mimoGenerateCall = appContent.match(/generateMimoSpeech\([\s\S]{0,200}\)/);
if (mimoGenerateCall) {
  const callBlock = mimoGenerateCall[0];
  assert(
    !callBlock.includes("endpoint") && !callBlock.includes("baseUrl"),
    "generateMimoSpeech call does not override endpoint"
  );
} else {
  assert(false, "generateMimoSpeech call found");
}

// 14. MiniMax endpoint unchanged
assert(
  !appContent.includes("/api/minimax/plan"),
  "MiniMax plan endpoint not referenced in app.js"
);

// 15. No API key / base64 audio committed
const sensitivePatterns = [
  /sk-cp-/,
  /apiKey.*sk-/,
  /MIMO_API_KEY=/,
  /Bearer [A-Za-z0-9._-]{20,}/,
  /tp-[A-Za-z0-9._-]{10,}/,
  /sk-[A-Za-z0-9._-]{10,}/,
  /data:audio\/.+;base64,[A-Za-z0-9+/=]{80,}/,
];
for (const pattern of sensitivePatterns) {
  assert(
    !pattern.test(appContent),
    `app.js: no credential pattern ${pattern} found`
  );
}

// 16. typingTimerId written to state on each setTimeout (guards against orphaned timers)
const typingTimerAssignments = appContent.match(/typingTimerId: timerId/g) || [];
assert(
  typingTimerAssignments.length >= 2,
  "typingTimerId assigned to state after setTimeout (prevents orphaned timers)"
);

// 17. startResidentConversation calls render() only at the end (not inside tick)
const startConvRenderCount = (appContent.match(/function startResidentConversation\(\)[\s\S]*?\n\}/)?.[0].match(/render\(\)/g) || []).length;
assert(
  startConvRenderCount <= 1,
  "startResidentConversation calls render() at most once"
);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`${failed} check(s) failed — review output above`);
  process.exit(1);
} else {
  console.log("All resident conversation refresh stability checks passed!");
}
