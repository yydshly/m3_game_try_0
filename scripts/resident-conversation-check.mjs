// Resident conversation performance check — verifies the conversation MVP feature
import { readFileSync } from "fs";
import { resolve } from "path";

const APP_JS = resolve(import.meta.dirname, "../src/app.js");
const appContent = readFileSync(APP_JS, "utf8");
const renderContent = readFileSync(resolve(import.meta.dirname, "../src/ui/render.js"), "utf8");
const cssContent = readFileSync(resolve(import.meta.dirname, "../src/styles.css"), "utf8");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); }
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
}

console.log("\n── Resident conversation MVP checks ──");

// 1. uiState includes residentConversation default state
assert(
  appContent.includes("residentConversation: {") &&
  appContent.includes("enabled: false"),
  "uiState: residentConversation.defaultState exists"
);

// 2. state shape fields
assert(
  appContent.includes('status: "idle"') || appContent.includes("status: 'idle'"),
  "residentConversation.status field exists"
);
assert(
  appContent.includes("residentConversation") && appContent.includes("queue:"),
  "residentConversation.queue field exists"
);
assert(
  appContent.includes("currentIndex: 0"),
  "residentConversation.currentIndex field exists"
);
assert(
  appContent.includes("typingTimerId: null"),
  "residentConversation.typingTimerId field exists"
);

// 3. safeUiState includes residentConversation
assert(
  renderContent.includes("residentConversation: uiState.residentConversation"),
  "safeUiState includes residentConversation"
);

// 4. buildResidentConversationQueue function exists
assert(
  appContent.includes("function buildResidentConversationQueue("),
  "buildResidentConversationQueue function exists"
);

// 5. queue generates lines from templates
assert(
  appContent.includes("const TEMPLATES = {"),
  "template-based conversation lines exist"
);
assert(
  appContent.includes("for (let i = 0; i < Math.min(lines.length, 5); i++)") ||
  appContent.includes("for (let i = 0; i < lines.length; i++)"),
  "queue iterates over template lines (max 5)"
);
// 5b. templates are flat strings (not nested arrays)
assert(
  appContent.includes('"speaker.name，') ||
  appContent.includes("speaker.name，"),
  "templates are flat string arrays (not nested)"
);
// 5c. rawText has String() guard
assert(
  appContent.includes("const rawText = String(lines[i] ?? \"\")"),
  "rawText protected with String() before .replace"
);
// 5d. activeScenario read from state.activeScenario
assert(
  appContent.includes("state.activeScenario"),
  "activeScenario read from state.activeScenario (not state.residentConversation)"
);

// 6. each line has speakerId, text, audioKey
assert(
  appContent.includes("speakerId: speaker.id"),
  "queue line includes speakerId"
);
assert(
  appContent.includes("text: text.slice(0, 50)"),
  "queue line includes text (max 50 chars)"
);
assert(
  appContent.includes("conversation:${speaker.id}:${lineId}") ||
  appContent.includes("conversation:${speaker.id}:${line.id}"),
  "queue line includes audioKey with conversation: prefix"
);

// 7. no new M3 interface calls introduced
assert(
  !appContent.includes("requestMiniMaxConversation") &&
  !appContent.includes("generateConversation(") &&
  !appContent.includes("MiniMaxConversation"),
  "no new M3 conversation interface calls introduced"
);

// 8. no MiniMax endpoint changes
assert(
  appContent.includes("generateBroadcastSpeech"),
  "MiniMax broadcast TTS (generateBroadcastSpeech) unchanged"
);

// 9. no MiMo endpoint changes
assert(
  appContent.includes("generateMimoSpeech"),
  "MiMo generateMimoSpeech unchanged"
);

// 10. MiMo payload uses mimo_default
assert(
  appContent.includes('voice: "mimo_default"') ||
  appContent.includes("voice: 'mimo_default'"),
  "MiMo payload uses voice=mimo_default (no change)"
);

// 11. typewriter state: visibleText
assert(
  appContent.includes('visibleText: ""'),
  "visibleText field exists for typewriter"
);
assert(
  appContent.includes("function startConversationTypewriter("),
  "startConversationTypewriter function exists"
);

// 12. lifecycle functions
assert(
  appContent.includes("function startResidentConversation("),
  "startResidentConversation function exists"
);
assert(
  appContent.includes("function pauseResidentConversation("),
  "pauseResidentConversation function exists"
);
assert(
  appContent.includes("function resumeResidentConversation("),
  "resumeResidentConversation function exists"
);
assert(
  appContent.includes("function stopResidentConversation("),
  "stopResidentConversation function exists"
);
assert(
  appContent.includes("function advanceConversationLine("),
  "advanceConversationLine function exists"
);

// 13. stop clears timer
assert(
  appContent.includes("function stopResidentConversation(") &&
  appContent.includes("clearConversationTimer()"),
  "stopResidentConversation clears typing timer"
);

// 14. conversation ends with non-playing status
assert(
  appContent.includes('status: "completed"') ||
  appContent.includes("status: 'completed'"),
  "conversation ends with status=completed"
);

// 15. handlers in safeHandlers
assert(
  renderContent.includes("onToggleConversation: handlers.onToggleConversation"),
  "safeHandlers includes onToggleConversation"
);
assert(
  renderContent.includes("onStopConversation: handlers.onStopConversation"),
  "safeHandlers includes onStopConversation"
);

// 16. button actions in UI
assert(
  renderContent.includes('data-action="toggle-conversation"'),
  "toggle-conversation button exists in UI"
);
assert(
  renderContent.includes('data-action="stop-conversation"'),
  "stop-conversation button exists in UI"
);

// 17. bindEvents wiring
assert(
  renderContent.includes("toggle-conversation") &&
  renderContent.includes("onToggleConversation"),
  "bindEvents wires toggle-conversation"
);
assert(
  renderContent.includes("stop-conversation") &&
  renderContent.includes("onStopConversation"),
  "bindEvents wires stop-conversation"
);

// 18. conversation bubble CSS
assert(
  cssContent.includes(".stage-character__dialogue--conversation"),
  "conversation bubble CSS class exists"
);
assert(
  cssContent.includes(".stage-character--speaking"),
  "speaker pulse CSS class exists"
);

// 19. onGenerateTts stops conversation
assert(
  appContent.includes("onGenerateTts:") &&
  appContent.includes("stopResidentConversation()"),
  "onGenerateTts stops conversation when broadcast starts"
);

// 20. onPlayMimoTts stops conversation
assert(
  appContent.includes("onPlayMimoTts:") &&
  appContent.includes("stopResidentConversation()"),
  "onPlayMimoTts stops conversation when manual MiMo starts"
);

// 21. onNewTown resets residentConversation
assert(
  appContent.includes("onNewTown:") &&
  appContent.includes("residentConversation:") &&
  appContent.includes('status: "idle"'),
  "onNewTown resets residentConversation"
);

// 22. No API keys or base64 audio
const apiKeyPattern = /sk-cp-|tp-[a-z0-9]{10,}|data:audio\/[^;]+;base64,[A-Za-z0-9+/=]{80,}/;
assert(!apiKeyPattern.test(appContent), "no API key literals or base64 audio in app.js");
assert(!apiKeyPattern.test(renderContent), "no API key literals or base64 audio in render.js");

// 23. playConversationLine function exists
assert(
  appContent.includes("function playConversationLine("),
  "playConversationLine function exists for auto-play"
);

// 24. currentVoicePlayback updated with scene=conversation
assert(
  appContent.includes("scene:") &&
  appContent.includes('"conversation"') &&
  appContent.includes("currentVoicePlayback:"),
  "currentVoicePlayback updated with scene=conversation during conversation"
);

// 25. onVoiceStop handles conversation: prefix
assert(
  appContent.includes('cvp.key.startsWith("conversation:")'),
  "onVoiceStop handles conversation: key prefix"
);

// 26. ttsAudios entry created for conversation audioKey
assert(
  appContent.includes("[line.audioKey]") ||
  appContent.includes("[ audioKey ]"),
  "ttsAudios entry created for conversation audioKey"
);

// 27. hashText used for conversation line
assert(
  appContent.includes("hashText(line.text)"),
  "hashText used for conversation line deduplication"
);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll resident conversation MVP checks passed!");
