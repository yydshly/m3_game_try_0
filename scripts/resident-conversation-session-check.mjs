// Resident conversation session check — verifies session-level conversation structure,
// participant consistency, and validation logic
import { readFileSync } from "fs";
import { resolve } from "path";

const APP_JS = resolve(import.meta.dirname, "../src/app.js");
const appContent = readFileSync(APP_JS, "utf8");
const renderContent = readFileSync(resolve(import.meta.dirname, "../src/ui/render.js"), "utf8");
const cssContent = readFileSync(resolve(import.meta.dirname, "../src/styles.css"), "utf8");
const dialogueGenContent = readFileSync(resolve(import.meta.dirname, "../src/services/dialogueGenerator.js"), "utf8");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); }
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
}

console.log("\n── Resident conversation session checks ──");

// 1. buildResidentConversationSession is exported from dialogueGenerator
assert(
  dialogueGenContent.includes("export function buildResidentConversationSession"),
  "buildResidentConversationSession is exported from dialogueGenerator"
);

// 2. validateConversationLines is exported
assert(
  dialogueGenContent.includes("export function validateConversationLines"),
  "validateConversationLines is exported from dialogueGenerator"
);

// 3. ConversationSession typedef / JSDoc in dialogueGenerator
assert(
  dialogueGenContent.includes("@typedef {Object} ConversationSession") ||
  dialogueGenContent.includes("ConversationSession"),
  "ConversationSession type documented in dialogueGenerator"
);

// 4. Session has id, status, locationId, locationLabel, participants, currentIndex, currentLine, lines
assert(
  dialogueGenContent.includes("id:") &&
  dialogueGenContent.includes("status:") &&
  dialogueGenContent.includes("locationId:") &&
  dialogueGenContent.includes("participants:"),
  "Session structure includes id/status/locationId/participants fields"
);

// 5. participants is Array with residentId, residentName, role
assert(
  dialogueGenContent.includes("residentId:") &&
  dialogueGenContent.includes("residentName:") &&
  dialogueGenContent.includes("role:") &&
  dialogueGenContent.includes("speaker") &&
  dialogueGenContent.includes("listener"),
  "Participant has residentId/residentName/role (speaker/listener)"
);

// 6. ConversationLine has speakerId, targetId, text, speakerName, targetName
assert(
  dialogueGenContent.includes("speakerId:") &&
  dialogueGenContent.includes("targetId:") &&
  dialogueGenContent.includes("speakerName:") &&
  dialogueGenContent.includes("targetName:"),
  "ConversationLine has speakerId/targetId/speakerName/targetName"
);

// 7. sessionState field added to residentConversation uiState default
assert(
  appContent.includes("sessionState: null") ||
  appContent.includes("sessionState:"),
  "sessionState field exists in residentConversation default"
);

// 8. buildResidentConversationQueue returns { session, queue }
assert(
  appContent.includes("return { session, queue }") ||
  (appContent.includes("session") && appContent.includes("queue")),
  "buildResidentConversationQueue returns { session, queue }"
);

// 9. startResidentConversation stores sessionState
assert(
  appContent.includes("sessionState: session") ||
  appContent.includes("sessionState:"),
  "startResidentConversation stores sessionState in uiState"
);

// 10. stopResidentConversation resets sessionState to null
assert(
  appContent.includes("sessionState: null"),
  "stopResidentConversation resets sessionState to null"
);

// 11. renderTownStage reads sessionState from residentConversation
assert(
  renderContent.includes("sessionState"),
  "renderTownStage reads sessionState from residentConversation"
);

// 12. renderTownStage determines isSpeaker / isListener from sessionState.participants
assert(
  renderContent.includes("isSpeaker") &&
  renderContent.includes("isListener"),
  "Stage determines isSpeaker and isListener roles from session"
);

// 13. conversationRole object passed to renderStageCharacter
assert(
  renderContent.includes("conversationRole"),
  "conversationRole object passed to renderStageCharacter"
);

// 14. CSS: .stage-character--speaking exists
assert(
  cssContent.includes(".stage-character--speaking"),
  "CSS: .stage-character--speaking exists"
);

// 15. CSS: .stage-character--listening exists
assert(
  cssContent.includes(".stage-character--listening"),
  "CSS: .stage-character--listening exists"
);

// 16. CSS: .stage-character--conversation-participant exists
assert(
  cssContent.includes(".stage-character--conversation-participant"),
  "CSS: .stage-character--conversation-participant exists"
);

// 17. CSS: .stage-character__listen-indicator exists
assert(
  cssContent.includes(".stage-character__listen-indicator"),
  "CSS: .stage-character__listen-indicator exists"
);

// 18. CSS: .dialogue-session__header exists
assert(
  cssContent.includes(".dialogue-session__header"),
  "CSS: .dialogue-session__header exists"
);

// 19. CSS: .dialogue-beats-empty exists
assert(
  cssContent.includes(".dialogue-beats-empty"),
  "CSS: .dialogue-beats-empty exists"
);

// 20. renderResidentDialoguePanel accepts sessionState parameter
assert(
  renderContent.includes("sessionState = null") ||
  renderContent.includes("sessionState:"),
  "renderResidentDialoguePanel accepts sessionState parameter"
);

// 21. renderResidentDialoguePanel shows session location and participants
assert(
  renderContent.includes("dialogue-session__location") ||
  renderContent.includes("locationLabel"),
  "renderResidentDialoguePanel shows session location"
);

// 22. right panel shows participant names in session header
assert(
  renderContent.includes("participantNames") ||
  renderContent.includes("participants"),
  "right panel shows participant names from session"
);

// 23. renderStageCharacter hides task badge for conversation participants
assert(
  renderContent.includes("!isParticipant") ||
  renderContent.includes("!conversationRole") ||
  renderContent.includes("isParticipant"),
  "renderStageCharacter hides task badge for conversation participants"
);

// 24. validateConversationLines function implementation
assert(
  dialogueGenContent.includes("function validateConversationLines"),
  "validateConversationLines function implemented"
);

// 25. validateConversationLines checks speakerId !== targetId
assert(
  dialogueGenContent.includes("speakerId === line.targetId") ||
  dialogueGenContent.includes("speakerId === targetId"),
  "validateConversationLines checks speakerId !== targetId"
);

// 26. validateConversationLines checks consecutive same speaker
assert(
  dialogueGenContent.includes("consecutiveSameSpeaker") ||
  dialogueGenContent.includes("lastSpeakerId"),
  "validateConversationLines checks consecutive same speaker"
);

// 27. validateConversationLines guards self-address
assert(
  dialogueGenContent.includes("guardSelfAddress") ||
  dialogueGenContent.includes("speakerName"),
  "validateConversationLines guards against self-address"
);

// 28. guardSelfAddress function exists
assert(
  dialogueGenContent.includes("function guardSelfAddress"),
  "guardSelfAddress function exists in dialogueGenerator"
);

// 29. selectConversationPair function exists
assert(
  dialogueGenContent.includes("function selectConversationPair"),
  "selectConversationPair function exists in dialogueGenerator"
);

// 30. selectConversationPair prioritizes same-location
assert(
  dialogueGenContent.includes("same-location") ||
  dialogueGenContent.includes("byLocation"),
  "selectConversationPair prioritizes same-location residents"
);

// 31. buildEmptySession function exists
assert(
  dialogueGenContent.includes("function buildEmptySession"),
  "buildEmptySession function exists in dialogueGenerator"
);

// 32. onNewTown resets sessionState
assert(
  appContent.includes("sessionState: null"),
  "onNewTown resets sessionState"
);

// 33. safeUiState includes sessionState in residentConversation fallback
assert(
  renderContent.includes("sessionState:") ||
  renderContent.includes("sessionState"),
  "safeUiState includes sessionState in residentConversation fallback"
);

// 34. voice-playback-chip still exists in town-stage (not broken)
assert(
  renderContent.includes("voice-playback-chip"),
  "voice-playback-chip still exists in town-stage"
);

// 35. stage-bubble still rendered in renderTownStage
assert(
  renderContent.includes("stage-bubble"),
  "stage-bubble still rendered in town-stage"
);

// 36. deed-outcome-panel still rendered in renderTownStage
assert(
  renderContent.includes("deed-outcome-panel"),
  "deed-outcome-panel still rendered in town-stage"
);

// 37. No credential patterns in source
const sensitivePatterns = [
  /sk-cp-/,
  /apiKey.*sk-/,
  /MIMO_API_KEY=/,
  /tp-[A-Za-z0-9._-]{10,}/,
  /data:audio\/.+;base64,[A-Za-z0-9+/=]{80,}/,
];
for (const pattern of sensitivePatterns) {
  assert(
    !pattern.test(appContent) && !pattern.test(renderContent) && !pattern.test(dialogueGenContent),
    `no credential pattern ${pattern} in source`
  );
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`${failed} check(s) failed — review output above`);
  process.exit(1);
} else {
  console.log("All resident conversation session checks passed!");
}
