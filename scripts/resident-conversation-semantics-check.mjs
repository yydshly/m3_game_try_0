// Resident conversation semantics check — verifies turn structure, speaker alignment,
// digest stability, and playback bar metadata correctness
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

console.log("\n── Resident conversation semantics checks ──");

// 1. buildResidentDialogueTurns is imported and used in app.js
const fs = await import("fs");
const dialogueGenContent = fs.readFileSync("./src/services/dialogueGenerator.js", "utf8");
assert(
  appContent.includes("buildResidentDialogueTurns") && dialogueGenContent.includes("from:") && dialogueGenContent.includes("to:"),
  "buildResidentDialogueTurns provides structured turns with from/to/text"
);

// 2. Each turn has from and to fields (in dialogueGenerator)
assert(
  dialogueGenContent.includes('from: "speaker"') && dialogueGenContent.includes('from: "target"'),
  "turns have from: 'speaker' and from: 'target' in dialogueGenerator"
);

// 3. buildResidentConversationQueue uses structured turns from buildResidentDialogueTurns
// (speakerId/targetId are derived from turn.from/turn.to in buildResidentDialogueTurns)
assert(
  appContent.includes("buildResidentDialogueTurns") && appContent.includes("turn.speakerId"),
  "buildResidentConversationQueue uses structured turns (speakerId from turn.from)"
);

// 4. No raw speaker.name / target.name substitution in templates (dialogueGenerator uses placeholder substitution)
assert(
  !dialogueGenContent.match(/const TEMPLATES[\s\S]{0,200}speaker\.name/) || dialogueGenContent.includes("substituteText"),
  "templates use substituteText rather than raw speaker.name/target.name"
);

// 5. ttsAudios entry for conversation includes speakerName/targetName
assert(
  appContent.includes("speakerName: line.speakerName"),
  "ttsAudios stores speakerName for conversation"
);
assert(
  appContent.includes("targetName: line.targetName"),
  "ttsAudios stores targetName for conversation"
);

// 6. currentVoicePlayback for conversation uses line speakerName/targetName
assert(
  appContent.includes("title: line.speakerName"),
  "currentVoicePlayback.title set to line.speakerName for conversation"
);
assert(
  appContent.includes("subtitle: line.targetName"),
  "currentVoicePlayback.subtitle includes line.targetName for conversation"
);

// 7. VOICE_PLAYBACK_LABELS has conversation type
assert(
  renderContent.includes("conversation:") && renderContent.includes("居民对话"),
  "VOICE_PLAYBACK_LABELS has conversation type entry"
);

// 8. renderVoicePlaybackBar does NOT duplicate icon in statusTitle
const barFnStart = renderContent.indexOf("function renderVoicePlaybackBar(");
const barFnNextFn = renderContent.indexOf("\nfunction ", barFnStart + 10);
const barFnBody = barFnStart !== -1 && barFnNextFn !== -1
  ? renderContent.slice(barFnStart, barFnNextFn)
  : "";
assert(
  !barFnBody.includes("${icon} 正在播放") && !barFnBody.includes("${icon} 已暂停"),
  "renderVoicePlaybackBar statusTitle does not duplicate icon"
);

// 9. stage-bubble is always rendered (not conditional on latestEvent)
const townStageFnStart = renderContent.indexOf("function renderTownStage(");
const townStageNextFn = renderContent.indexOf("\nfunction ", townStageFnStart + 10);
const townStageFn = townStageFnStart !== -1 && townStageNextFn !== -1
  ? renderContent.slice(townStageFnStart, townStageNextFn)
  : "";
assert(
  !townStageFn.includes("latestEvent") && townStageFn.includes("stage-bubble"),
  "stage-bubble always rendered (no latestEvent condition)"
);

// 10. stage-bubble shows "今日动态" not "最新动态"
assert(
  renderContent.includes("今日动态"),
  "stage-bubble shows '今日动态' label"
);
assert(
  !renderContent.includes("最新动态"),
  "stage-bubble no longer shows '最新动态'"
);

// 11. buildStageDigest function exists (stable digest)
assert(
  renderContent.includes("function buildStageDigest("),
  "buildStageDigest function exists for stable stage digest"
);

// 12. startedCount field exists in residentConversation
assert(
  appContent.includes("startedCount: 0") || appContent.includes("startedCount: prevStartedCount + 1"),
  "startedCount field exists in residentConversation state"
);

// 13. rotation seed uses startedCount (via buildResidentDialogueTurns)
assert(
  appContent.includes("startedCount") && dialogueGenContent.includes("rotationSeed"),
  "template rotation uses startedCount via rotationSeed in buildResidentDialogueTurns"
);

// 14. no MiMo endpoint change
assert(
  !appContent.includes("/api/minimax/plan"),
  "MiniMax plan endpoint not referenced in app.js"
);

// 15. no MiniMax endpoint in render
assert(
  !renderContent.includes("/api/minimax/plan"),
  "MiniMax plan endpoint not in render.js"
);

// 16. no credential patterns in source
const sensitivePatterns = [
  /sk-cp-/,
  /apiKey.*sk-/,
  /MIMO_API_KEY=/,
  /tp-[A-Za-z0-9._-]{10,}/,
  /data:audio\/.+;base64,[A-Za-z0-9+/=]{80,}/,
];
for (const pattern of sensitivePatterns) {
  assert(
    !pattern.test(appContent) && !pattern.test(renderContent),
    `no credential pattern ${pattern}`
  );
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`${failed} check(s) failed — review output above`);
  process.exit(1);
} else {
  console.log("All resident conversation semantics checks passed!");
}
