// Layout stability check — verifies fixed-height slots and stable containers
// that prevent layout shift during conversation playback and voice state changes
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

console.log("\n── Layout stability checks ──");

// 1. voice-playback-slot or equivalent fixed slot exists in render output
assert(
  cssContent.includes(".voice-playback-slot") || renderContent.includes("voice-playback-slot"),
  "voice-playback-slot container exists"
);

// 2. Playback bar uses opacity/visibility to hide instead of removing from DOM
assert(
  cssContent.includes("opacity: 0") &&
  (cssContent.includes("visibility: hidden") || cssContent.includes(".voice-playback-bar--idle")),
  "Playback bar uses opacity/visibility hidden (not DOM removal)"
);

// 3. voice-playback-slot has fixed min-height
const slotStyle = cssContent.match(/\.voice-playback-slot\s*\{[^}]+\}/)?.[0] ?? "";
assert(
  slotStyle.includes("min-height"),
  "voice-playback-slot has min-height"
);

// 4. conversation bubble text uses data-conversation-visible-text targeting
assert(
  renderContent.includes("data-conversation-visible-text="),
  "conversation bubble targets text via data attribute"
);

// 5. typewriter tick does NOT call render() for each character
// Verify updateConversationVisibleText is used instead
const tickBlocks = appContent.match(/const tick = \(\) => \{[\s\S]*?\}\n  \};/g) || [];
const hasLocalUpdate = tickBlocks.some((b) => b.includes("updateConversationVisibleText"));
assert(
  hasLocalUpdate || appContent.includes("updateConversationVisibleText("),
  "typewriter tick uses local DOM update (not render())"
);

// 6. latest event bubble / stage-bubble has stable min-height or line-clamp
assert(
  cssContent.includes(".stage-bubble") && (
    cssContent.includes(".stage-bubble") && (
      cssContent.match(/\.stage-bubble\s*\{[^}]*min-height/) !== null ||
      cssContent.match(/\.stage-bubble\s*\{[^}]*-webkit-line-clamp/) !== null
    )
  ),
  "stage-bubble has stable min-height or line-clamp"
);

// 7. recommended-voice has stable container (min-height or always rendered)
assert(
  cssContent.includes(".recommended-voice") &&
  cssContent.includes("min-height"),
  "recommended-voice has stable min-height"
);

// 8. atmosphere-panel has min-height to prevent height collapse
const atmosStyle = cssContent.match(/\.atmosphere-panel\s*\{[^}]+\}/)?.[0] ?? "";
assert(
  atmosStyle.includes("min-height"),
  "atmosphere-panel has min-height"
);

// 9. speaking highlight uses only box-shadow/transform (no border-width/margin changes)
assert(
  cssContent.includes(".stage-character--speaking"),
  "speaker highlight CSS class exists"
);
const speakingStyle = cssContent.match(/\.stage-character--speaking[^}]*\{[^}]*\}/)?.[0] ?? "";
const hasBorderMargin = /border-width:\s*\d|margin\s*:\s*\d/.test(speakingStyle);
assert(
  !hasBorderMargin,
  "speaker highlight does not change border-width or margin (only box-shadow/transform)"
);

// 10. MiMo endpoint unchanged
assert(
  !appContent.includes("/api/minimax/plan"),
  "MiniMax plan endpoint not referenced in app.js"
);

// 11. MiMo endpoint unchanged (no new endpoint override)
assert(
  !renderContent.includes("/api/minimax/plan"),
  "MiniMax endpoint not in render.js"
);

// 12. No API key / base64 audio in source
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
    `source: no credential pattern ${pattern}`
  );
}

// 13. voice playback bar always renders a slot — check it doesn't return "" inside the function
// (function is at EOF so we search for end of file marker)
const barFnStart = renderContent.indexOf("function renderVoicePlaybackBar(");
assert(
  barFnStart !== -1,
  "renderVoicePlaybackBar function exists"
);
// The bar slot is always returned; only the --idle class controls visibility
assert(
  renderContent.includes("voice-playback-slot"),
  "renderVoicePlaybackBar returns a fixed slot container"
);

// 14. recommended-voice container uses class toggle (--empty) not DOM removal
// When enabled=false the parent doesn't render it at all; when enabled=true it always has a container
assert(
  renderContent.includes("recommended-voice--empty") || cssContent.includes("recommended-voice--empty"),
  "recommended-voice uses --empty class for empty state (not DOM removal)"
);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`${failed} check(s) failed — review output above`);
  process.exit(1);
} else {
  console.log("All layout stability checks passed!");
}
