// resident-dialogue-visual-check — validates visual UX of dialogue chip and controls
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

console.log("\n── Dialogue chip and controls ──");

// 1. voice-playback-chip rendered inside town-stage (not between HUD and layout)
assert(
  renderContent.includes("voice-playback-chip"),
  "voice-playback-chip rendered in render.js"
);

// 2. Chip is inside town-stage (renderVoicePlaybackChip is called within renderTownStage output)
assert(
  renderContent.includes("renderVoicePlaybackChip(voiceViewModel"),
  "renderVoicePlaybackChip is called in town-stage rendering"
);

// 3. Left panel conversation section: no pause/stop buttons during playback
// The left panel shows conversation-status read-only indicator, not action buttons
assert(
  renderContent.includes("conversation-status--playing") || renderContent.includes("conversation-status"),
  "left panel: uses read-only conversation-status indicator"
);
assert(
  !renderContent.includes('data-action="pause-conversation"'),
  "left panel: no pause-conversation button"
);
assert(
  !renderContent.includes('data-action="stop-conversation"'),
  "left panel: no stop-conversation button during playback"
);

// 4. Chip has compact single-line format (speaker → target)
assert(
  renderContent.includes("voice-playback-chip__compact") || renderContent.includes("speakerName") && renderContent.includes("targetName"),
  "chip: has compact speaker→target format"
);

// 5. Chip has voice-pause/voice-resume/voice-stop controls
assert(
  renderContent.includes('data-action="voice-pause"'),
  "chip: has pause control"
);
assert(
  renderContent.includes('data-action="voice-resume"'),
  "chip: has resume control"
);
assert(
  renderContent.includes('data-action="voice-stop"'),
  "chip: has stop control"
);

// 6. Right panel dialogue: no TTS playback buttons in conversation record
// renderRecommendedVoiceClip uses play-mimo-tts for recommended voice (atmosphere panel, not right panel)
// renderRightPanel's dialogue-beats section should not have TTS buttons
const dialogueBeatsPattern = /dialogue-beats[\s\S]{0,500}/;
const dialogueBeatsSnippet = renderContent.match(dialogueBeatsPattern)?.[0] ?? "";
assert(
  dialogueBeatsSnippet.length === 0 || (!dialogueBeatsSnippet.includes("play-mimo-tts") && !dialogueBeatsSnippet.includes("pause-mimo-tts")),
  "right panel dialogue-beats: no TTS playback buttons"
);

// 7. Recommended voice card: shows hint when conversation is active
assert(
  renderContent.includes("isConversationActive") || renderContent.includes("conversationStatus"),
  "recommended voice: checks conversationStatus"
);

// 8. Chip positioned inside town-stage (not between HUD and layout)
const chipCSS = stylesContent.substring(stylesContent.indexOf(".voice-playback-chip"), stylesContent.indexOf(".voice-playback-chip--idle"));
assert(
  chipCSS.includes("position: absolute"),
  "chip: uses absolute positioning"
);
assert(
  chipCSS.includes("bottom:"),
  "chip: uses bottom positioning (not top pushing layout)"
);

// 9. stage-bubble still exists
assert(
  renderContent.includes("stage-bubble") && renderContent.includes("今日动态"),
  "stage-bubble (今日动态) still rendered"
);

// 10. deed-outcome-panel still exists
assert(
  renderContent.includes("deed-outcome-panel"),
  "deed-outcome-panel still rendered"
);

// 11. Map bubbles: only current speaker shows conversation bubble
assert(
  renderContent.includes("stage-character__dialogue--conversation"),
  "conversation bubble class exists"
);

// 12. No TTS buttons in right resident dialogue section
const rightPanelMatch = renderContent.match(/function renderRightPanel[\s\S]*?function \w+/);
if (rightPanelMatch) {
  const rightPanelCode = rightPanelMatch[0];
  assert(
    !rightPanelCode.includes("play-mimo-tts") && !rightPanelCode.includes("pause-mimo-tts"),
    "right panel: no TTS buttons in dialogue beats"
  );
}

// 13. CSS: chip bottom position is 18px or more (avoiding stage-bubble)
const bottomMatch = chipCSS.match(/bottom:\s*(\d+)px/);
if (bottomMatch) {
  const bottomPx = parseInt(bottomMatch[1]);
  assert(
    bottomPx >= 18,
    `chip: bottom position ${bottomPx}px (>= 18px to avoid stage-bubble)`
  );
}

// 14. CSS: chip max-width <= 480px
const maxWidthMatch = chipCSS.match(/max-width:\s*min\((\d+)px/);
if (maxWidthMatch) {
  const maxW = parseInt(maxWidthMatch[1]);
  assert(
    maxW <= 480,
    `chip: max-width ${maxW}px (<= 480px)`
  );
}

// 15. CSS: chip uses safe variables (--rose for error, not --error)
// Verify the chip--error state uses var(--rose) not an undefined --error variable
const chipErrorRule = stylesContent.match(/\.voice-playback-chip--error\s*\{[^}]+\}/)?.[0] ?? "";
assert(
  chipErrorRule.includes("var(--rose)") || chipErrorRule.includes("#c47a82"),
  "chip --error state uses --rose (not undefined --error)"
);
assert(
  !chipErrorRule.includes("var(--error)"),
  "chip --error state does not use undefined --error variable"
);

// 16. stage-character__voice-btn CSS: no --accent, --accent-muted, --error
const voiceBtnSection = stylesContent.substring(
  stylesContent.indexOf(".stage-character__voice-btn"),
  stylesContent.indexOf(".stage-character__voice-btn--idle")
);
for (const v of ["--bg-elevated", "--accent", "--accent-muted", "--error"]) {
  assert(
    !voiceBtnSection.includes(v),
    `stage-character__voice-btn CSS: does not use undefined variable ${v}`
  );
}

// 17. buildVoicePlaybackView handles conversation type
assert(
  renderContent.includes('sourceType === "conversation"') ||
    renderContent.includes('sourceType === "resident-dialogue"'),
  "buildVoicePlaybackView: handles conversation sourceType"
);

// 18. No new TTS providers introduced
assert(
  !renderContent.includes("azure") && !renderContent.includes("openai"),
  "no new TTS providers (Azure/OpenAI) in render.js"
);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\nAll resident dialogue visual checks passed!");
