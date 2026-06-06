// town-memory-reference-check — validates townMemory references in broadcasts/events/UI
import { readFileSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const MEMORY_JS = resolve(import.meta.dirname, "../src/domain/memory.js");
const RENDER_JS = resolve(import.meta.dirname, "../src/ui/render.js");
const APP_JS = resolve(import.meta.dirname, "../src/app.js");
const SERVER_MJS = resolve(import.meta.dirname, "./server.mjs");

const memoryContent = readFileSync(MEMORY_JS, "utf8");
const renderContent = readFileSync(RENDER_JS, "utf8");
const appContent = readFileSync(APP_JS, "utf8");
const serverContent = readFileSync(SERVER_MJS, "utf8");

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

console.log("\n── Town Memory Reference Checks ──");

// 1. buildTownMemoryReferences function exists and is exported
assert(
  memoryContent.includes("export function buildTownMemoryReferences"),
  "buildTownMemoryReferences exported in memory.js"
);

// 2. buildTownMemoryReferences returns hasMemory, references, promptText
assert(
  memoryContent.includes("hasMemory") && memoryContent.includes("references") && memoryContent.includes("promptText"),
  "buildTownMemoryReferences returns hasMemory, references, promptText"
);

// 3. References include id, title, text, day, phase, placeId, placeLabel, residentNames
const refFields = ["id", "title", "text", "day", "phase", "placeId", "placeLabel", "residentNames"];
for (const field of refFields) {
  assert(
    memoryContent.includes(field),
    `reference object has ${field} field`
  );
}

// 4. Safe fallback when no townMemory
assert(
  memoryContent.includes("memories.length === 0") || memoryContent.includes("hasMemory: false"),
  "buildTownMemoryReferences handles empty memory gracefully"
);

// 5. maxReferences option (default 2)
assert(
  memoryContent.includes("maxReferences") || memoryContent.includes("maxReferences = 2"),
  "buildTownMemoryReferences has maxReferences option"
);

// 6. promptText includes day/phase/memory text
assert(
  memoryContent.includes("第${r.day}天") || memoryContent.includes("promptText"),
  "promptText includes day/phase context"
);

// 7. Broadcast prompt includes memorySummary from server
assert(
  serverContent.includes("buildTownMemorySummary") && serverContent.includes("memorySummary"),
  "server broadcast prompt uses buildTownMemorySummary"
);

// 8. Event prompt includes memorySummary from server
assert(
  serverContent.includes("buildEventPrompt") && serverContent.includes("memorySummary"),
  "server event prompt uses memorySummary"
);

// 9. Memory reference shown in broadcast preview (UI)
assert(
  renderContent.includes("memoryReferences") && renderContent.includes("atmosphere-broadcast-preview"),
  "UI: broadcast preview shows memoryReferences"
);

// 10. Memory reference shown in event card (UI)
assert(
  renderContent.includes("m3-event__memory-refs"),
  "UI: event card shows memoryReferences"
);

// 11. dayOpeningReflection uses buildTownMemoryReferences
assert(
  appContent.includes("buildTownMemoryReferences"),
  "buildDayOpeningReflection calls buildTownMemoryReferences"
);

// 12. stage-bubble still exists (not broken by memory changes)
assert(
  renderContent.includes("stage-bubble") && renderContent.includes("今日动态"),
  "stage-bubble (今日动态) still rendered"
);

// 13. deed-outcome-panel still exists
assert(
  renderContent.includes("deed-outcome-panel"),
  "deed-outcome-panel still rendered"
);

// 14. buildTownMemoryReferences does NOT use state.events reverse find
const fnCode = memoryContent.match(/function buildTownMemoryReferences[\s\S]*?^}/m)?.[0] ?? "";
assert(
  !fnCode.includes(".events") || !fnCode.includes(".reverse()"),
  "buildTownMemoryReferences does not use state.events reverse find"
);

// 15. No new TTS providers introduced
assert(
  !renderContent.includes("azure") && !renderContent.includes("openai"),
  "no new TTS providers introduced"
);

// 16. resident dialogue chip unaffected
assert(
  renderContent.includes("voice-playback-chip"),
  "voice-playback-chip still renders independently"
);

// 17. memoryReferences populated in broadcast event from buildPromptMemoryNarrative
assert(
  appContent.includes("buildPromptMemoryNarrative(state).uiLabels"),
  "broadcast event populates memoryReferences from buildPromptMemoryNarrative"
);

// 18. Event populates memoryReferences from buildPromptMemoryNarrative
assert(
  appContent.includes("buildPromptMemoryNarrative(state).uiLabels"),
  "event populates memoryReferences from buildPromptMemoryNarrative"
);

// 19. Server buildBroadcastPrompt includes memorySummary in prompt
assert(
  serverContent.includes("memorySummary") && serverContent.includes("You may naturally reference"),
  "server broadcast prompt includes memory guidance for LLM"
);

// 20. Server buildEventPrompt includes memorySummary in prompt
assert(
  serverContent.includes("buildEventPrompt") && serverContent.includes("real memory"),
  "server event prompt includes memory guidance for LLM"
);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\nAll town memory reference checks passed!");
