// choice-world-effect-check.mjs
// Validates player choice → stage feedback integration:
// - buildChoiceWorldEffectView pure function
// - place-level markers on the map
// - affected resident feedback on the map
// - no duplicate card titles
// - no undefined/null in HTML output

import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const SRC = resolve(PROJECT_ROOT, "src");

function src(...parts) { return pathToFileURL(resolve(SRC, ...parts)); }

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); }
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
}

// ── 1. buildChoiceWorldEffectView exists as pure function ─────────────────────
console.log("\n── buildChoiceWorldEffectView exists ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "domain/choiceWorldEffect.js"), "utf8");
  assert(content.includes("export function buildChoiceWorldEffectView"), "buildChoiceWorldEffectView exported");
  assert(content.includes("PLACE_NAMES"), "PLACE_NAMES defined");
  assert(content.includes("PLACE_ICONS"), "PLACE_ICONS defined");
  assert(content.includes("deriveMarker"), "deriveMarker helper exists");
  assert(!content.includes("document") && !content.includes("window"), "no DOM globals (pure domain)");
}

// ── 2. buildChoiceWorldEffectView: no aftermath → visible:false ────────────────
console.log("\n── buildChoiceWorldEffectView: no aftermath → visible:false ──");
{
  const mod = await import(src("domain/choiceWorldEffect.js"));
  const view = mod.buildChoiceWorldEffectView({ residents: [], events: [] }, {});
  assert(view.visible === false, "visible is false when no choiceAftermath");
  assert(view.placeId == null, "placeId is null-ish when no data");
}

// ── 3. buildChoiceWorldEffectView: with choiceAftermath → visible:true ─────────
console.log("\n── buildChoiceWorldEffectView: with choiceAftermath → visible:true ──");
{
  const mod = await import(src("domain/choiceWorldEffect.js"));
  const state = { residents: [{ id: "seven", name: "小七" }, { id: "zhou", name: "老周" }], events: [] };
  const uiState = {
    choiceAftermath: {
      id: "aftermath-test-1", eventId: "evt-1", choiceId: "choice-a", placeId: "cafe",
      choiceLabel: "帮忙把画册送去餐厅",
      summary: "小七把画册轻放在餐厅旁边。",
      residentReactions: [
        { residentId: "seven", residentName: "小七", reaction: "放在这里，大家路过都能看到。" },
        { residentId: "zhou", residentName: "老周", reaction: "放在餐厅旁边挺合适。" },
      ],
      createdAt: Date.now(),
    },
  };
  const view = mod.buildChoiceWorldEffectView(state, uiState);
  assert(view.visible === true, "visible is true with choiceAftermath");
  assert(view.placeId === "cafe", "placeId extracted from choiceAftermath");
  assert(view.placeLabel === "餐厅", "placeLabel is 餐厅");
  assert(typeof view.markerIcon === "string" && view.markerIcon.length > 0, "markerIcon non-empty");
  assert(typeof view.markerLabel === "string" && view.markerLabel.length > 0, "markerLabel non-empty");
}

// ── 4. markerLabel not empty ─────────────────────────────────────────────────
console.log("\n── markerLabel derivation ──");
{
  const mod = await import(src("domain/choiceWorldEffect.js"));
  const view = mod.buildChoiceWorldEffectView(
    { residents: [], events: [] },
    { choiceAftermath: { id: "a2", eventId: "e1", choiceId: "c1", placeId: "garden", choiceLabel: "帮忙把画册送去餐厅", summary: "结果。", residentReactions: [], createdAt: Date.now() } }
  );
  assert(view.markerLabel.length > 0, "markerLabel is not empty");
  assert(view.markerIcon.length > 0, "markerIcon is not empty");
}

// ── 5. affectedResidents max 2 ───────────────────────────────────────────────
console.log("\n── affectedResidents limit ──");
{
  const mod = await import(src("domain/choiceWorldEffect.js"));
  const view = mod.buildChoiceWorldEffectView(
    { residents: [], events: [] },
    { choiceAftermath: {
      id: "a3", eventId: "e1", choiceId: "c1", placeId: "cafe", choiceLabel: "选择", summary: "结果",
      residentReactions: [
        { residentId: "r1", residentName: "居民1", reaction: "反应1" },
        { residentId: "r2", residentName: "居民2", reaction: "反应2" },
        { residentId: "r3", residentName: "居民3", reaction: "反应3" },
        { residentId: "r4", residentName: "居民4", reaction: "反应4" },
      ],
      createdAt: Date.now(),
    }}
  );
  assert(view.affectedResidents.length <= 2, `affectedResidents ≤ 2 (got ${view.affectedResidents.length})`);
}

// ── 6. render.js imports buildChoiceWorldEffectView ──────────────────────────
console.log("\n── render.js wiring ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "ui/render.js"), "utf8");
  assert(content.includes("import { buildChoiceWorldEffectView }"), "buildChoiceWorldEffectView imported");
  assert(content.includes("buildChoiceWorldEffectView(state, uiState)"), "buildChoiceWorldEffectView called");
}

// ── 7. renderPlaceLabel accepts choiceAffected parameter ─────────────────────
console.log("\n── renderPlaceLabel: choiceAffected parameter ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "ui/render.js"), "utf8");
  assert(content.includes("function renderPlaceLabel(placeId, isActive, anim, choiceAffected)"), "renderPlaceLabel has choiceAffected param");
  assert(content.includes("choiceAffectedClass = choiceAffected ?"), "choiceAffectedClass used");
  assert(content.includes("stage-place-label--choice-affected"), "choice-affected CSS class used");
}

// ── 8. stage-choice-marker rendered in town-stage ────────────────────────────
console.log("\n── stage-choice-marker in renderTownStage ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "ui/render.js"), "utf8");
  assert(content.includes("renderChoiceWorldMarker(choiceWorldEffect)"), "renderChoiceWorldMarker called");
  assert(content.includes("function renderChoiceWorldMarker"), "renderChoiceWorldMarker function exists");
  assert(content.includes("stage-choice-marker"), "stage-choice-marker CSS class used");
  assert(content.includes("stage-choice-marker--warm"), "warm modifier used");
  assert(content.includes("stage-choice-marker--recent"), "recent modifier used");
}

// ── 9. marker positioned by placeId coordinates ─────────────────────────────
console.log("\n── marker positioning ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "ui/render.js"), "utf8");
  assert(content.includes("stagePlaces[placeId]"), "stagePlaces used for marker");
  assert(content.includes("left:${place.x}%"), "x coordinate used");
  assert(content.includes("top:${place.y"), "y coordinate used (above place)");
}

// ── 10. affected character has stage-character--choice-affected class ─────────
console.log("\n── stage-character--choice-affected ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "ui/render.js"), "utf8");
  assert(content.includes("choiceReaction = null)"), "choiceReaction param added to renderStageCharacter");
  assert(content.includes("choiceAffectedClass = choiceReaction ?"), "choiceAffectedClass derived");
  assert(content.includes("stage-character--choice-affected"), "choice-affected class applied");
  assert(content.includes("stage-character__choice-reaction"), "choice-reaction bubble class exists");
}

// ── 11. choice reaction bubble rendered ─────────────────────────────────────
console.log("\n── choice reaction bubble ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "ui/render.js"), "utf8");
  assert(content.includes("escapeHtml(choiceReaction.reactionText)"), "reaction text escaped");
  assert(content.includes("choiceReactionBubble"), "choiceReactionBubble variable exists");
}

// ── 12. renderTownStage passes choiceReaction to renderStageCharacter ─────────
console.log("\n── renderTownStage passes choiceReaction ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "ui/render.js"), "utf8");
  assert(content.includes("affectedResidentIds = new Set"), "affectedResidentIds set built");
  assert(content.includes("choiceReaction = "), "choiceReaction derived per character");
  assert(content.includes("choiceWorldEffect.affectedResidents"), "choiceWorldEffect.affectedResidents used");
}

// ── 13. place label has choice-affected class when affected ──────────────────
console.log("\n── place label choice-affected class ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "ui/render.js"), "utf8");
  assert(content.includes("renderPlaceLabel(placeId"), "renderPlaceLabel called");
  assert(content.includes("choiceAffected = choiceWorldEffect.visible"), "choiceAffected passed");
}

// ── 14. CSS: stage-choice-marker styles exist ───────────────────────────────
console.log("\n── CSS: stage-choice-marker ──");
{
  const fs = await import("fs");
  const css = fs.readFileSync(resolve(PROJECT_ROOT, "src/styles.css"), "utf8");
  assert(css.includes(".stage-choice-marker"), "stage-choice-marker class exists");
  assert(css.includes(".stage-choice-marker__icon"), "stage-choice-marker__icon exists");
  assert(css.includes(".stage-choice-marker__label"), "stage-choice-marker__label exists");
  assert(css.includes(".stage-choice-marker--warm"), "warm modifier exists");
}

// ── 15. CSS: stage-place-label--choice-affected exists ───────────────────────
console.log("\n── CSS: stage-place-label--choice-affected ──");
{
  const fs = await import("fs");
  const css = fs.readFileSync(resolve(PROJECT_ROOT, "src/styles.css"), "utf8");
  assert(css.includes(".stage-place-label--choice-affected"), "stage-place-label--choice-affected CSS exists");
}

// ── 16. CSS: stage-character--choice-affected exists ─────────────────────────
console.log("\n── CSS: stage-character--choice-affected ──");
{
  const fs = await import("fs");
  const css = fs.readFileSync(resolve(PROJECT_ROOT, "src/styles.css"), "utf8");
  assert(css.includes(".stage-character--choice-affected"), "stage-character--choice-affected CSS exists");
  assert(css.includes(".stage-character__choice-reaction"), "stage-character__choice-reaction CSS exists");
}

// ── 17. choiceAftermath card title changed ──────────────────────────────────
console.log("\n── choiceAftermath card: no duplicate title ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "ui/render.js"), "utf8");
  assert(content.includes('aria-label="居民反应"'), "choiceAftermath aria-label is 居民反应");
  assert(content.includes(">居民反应<"), "choiceAftermath header says 居民反应");
  const directorSection = content.split("function renderEventDirectorStatus")[1]?.split("function")[0] ?? "";
  assert(directorSection.includes("✨ 刚刚的选择"), "event director still says 刚刚的选择");
}

// ── 18. renderChoiceAftermath header uses 👥 ─────────────────────────────────
console.log("\n── renderChoiceAftermath header ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "ui/render.js"), "utf8");
  const fnBody = content.split("function renderChoiceAftermath")[1]?.split("\n}")?.[0] ?? "";
  assert(fnBody.includes("居民反应") || fnBody.includes(">👥<"), "header updated to 居民反应 or 👥");
}

// ── 19. renderApp output: no undefined in HTML ───────────────────────────────
console.log("\n── renderApp: no undefined in HTML ──");
{
  const stateMod = await import(src("domain/state.js"));
  const simMod = await import(src("domain/simulation.js"));
  const renderMod = await import(src("ui/render.js"));
  const mockRoot = {
    _innerHTML: "",
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = v; },
    querySelector() { return { addEventListener() {} }; },
    querySelectorAll() { return []; },
  };
  const state = simMod.advancePhase(simMod.advancePhase(simMod.advancePhase(stateMod.createInitialState())));
  renderMod.renderApp(mockRoot, state, {});
  const html = mockRoot.innerHTML;
  assert(!html.includes(">undefined<"), "no >undefined< in HTML");
  assert(!html.includes(" undefined "), "no ' undefined ' in text nodes");
  assert(!html.includes(">null<"), "no >null< in HTML");
  assert(!html.includes(" null "), "no ' null ' in text nodes");
}

// ── 20. stage-bubble still in output ─────────────────────────────────────────
console.log("\n── stage-bubble preserved ──");
{
  const stateMod = await import(src("domain/state.js"));
  const renderMod = await import(src("ui/render.js"));
  const mockRoot = { _innerHTML: "", get innerHTML() { return this._innerHTML; }, set innerHTML(v) { this._innerHTML = v; }, querySelector() { return { addEventListener() {} }; }, querySelectorAll() { return []; } };
  renderMod.renderApp(mockRoot, stateMod.createInitialState(), {});
  assert(mockRoot.innerHTML.includes("stage-bubble"), "stage-bubble still present");
}

// ── 21. deed-outcome-panel still in output ────────────────────────────────────
console.log("\n── deed-outcome-panel preserved ──");
{
  const stateMod = await import(src("domain/state.js"));
  const renderMod = await import(src("ui/render.js"));
  const mockRoot = { _innerHTML: "", get innerHTML() { return this._innerHTML; }, set innerHTML(v) { this._innerHTML = v; }, querySelector() { return { addEventListener() {} }; }, querySelectorAll() { return []; } };
  renderMod.renderApp(mockRoot, stateMod.createInitialState(), {});
  assert(mockRoot.innerHTML.includes("deed-outcome-panel"), "deed-outcome-panel still present");
}

// ── 22. voice-playback-chip not affected ──────────────────────────────────────
console.log("\n── voice-playback-chip preserved ──");
{
  const stateMod = await import(src("domain/state.js"));
  const renderMod = await import(src("ui/render.js"));
  const mockRoot = { _innerHTML: "", get innerHTML() { return this._innerHTML; }, set innerHTML(v) { this._innerHTML = v; }, querySelector() { return { addEventListener() {} }; }, querySelectorAll() { return []; } };
  renderMod.renderApp(mockRoot, stateMod.createInitialState(), {});
  assert(mockRoot.innerHTML.includes("voice-playback-chip"), "voice-playback-chip not removed");
}

// ── 23. No new npm dependencies introduced ───────────────────────────────────
console.log("\n── No new dependencies ──");
{
  const fs = await import("fs");
  const pkg = JSON.parse(fs.readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const forbidden = ["phaser", "pixi", "pixi.js", "pixi-legacy", "matter-js", "playwright", "puppeteer", "react", "vue", "svelte", "angular", "solid-js", "lit", "howler", "tone.js"];
  const found = forbidden.filter((k) => deps[k]);
  assert(found.length === 0, `no forbidden frameworks (found: ${found.join(", ") || "none"})`);
}

// ── 24. No API keys committed in new files ───────────────────────────────────
console.log("\n── No API keys in new files ──");
{
  const fs = await import("fs");
  const cwe = fs.readFileSync(resolve(SRC, "domain/choiceWorldEffect.js"), "utf8");
  const render = fs.readFileSync(resolve(SRC, "ui/render.js"), "utf8");
  const combined = cwe + render;
  assert(!combined.match(/sk-[a-zA-Z0-9]{20,}/), "no sk- API key in new files");
  assert(!combined.match(/tp-[a-zA-Z0-9._-]{10,}/), "no tp- API key in new files");
}

// ── 25. M3 event interface not changed ─────────────────────────────────────
console.log("\n── M3 event interface unchanged ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "domain/memory.js"), "utf8");
  assert(content.includes("createChoiceMemoryEntry"), "createChoiceMemoryEntry still exists");
}

// ── 26. deriveMarker keyword detection ───────────────────────────────────────
console.log("\n── deriveMarker keyword detection ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "domain/choiceWorldEffect.js"), "utf8");
  assert(content.includes("画册") || content.includes("相册"), "photo album keyword detection");
  assert(content.includes("PLACE_ICONS"), "PLACE_ICONS used as fallback");
}

// ── 27. marker disappears after 30 seconds ───────────────────────────────────
console.log("\n── marker age timeout ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "ui/render.js"), "utf8");
  assert(content.includes("age > 30_000") || content.includes("age > 30000"), "30-second age check present");
}

// ── Results ────────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll choice-world-effect checks passed!");
