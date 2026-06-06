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
  assert(content.includes("isChoiceAffected = false, choiceReaction = null)"), "isChoiceAffected and choiceReaction params in renderStageCharacter");
  assert(content.includes("choiceAffectedClass = isChoiceAffected ?"), "choiceAffectedClass derived from isChoiceAffected");
  assert(content.includes("stage-character--choice-affected"), "choice-affected class applied");
  assert(content.includes("stage-character__choice-reaction"), "choice-reaction bubble class exists");
}

// ── 11. choice reaction bubble rendered with contextLabel ───────────────────────
console.log("\n── choice reaction bubble ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "ui/render.js"), "utf8");
  // contextLabel (place+reaction) is used for the bubble text
  assert(content.includes("escapeHtml(choiceReaction.contextLabel"), "contextLabel is escaped in bubble");
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
  // CSS animation for 30s fade-out
  const css = fs.readFileSync(resolve(PROJECT_ROOT, "src/styles.css"), "utf8");
  assert(css.includes("choiceMarkerFadeOut") || css.includes("30s"), "CSS fade-out animation exists for 30s timeout");
}

// ── 28. applyChoiceMemory writes choiceChosenAt to m3-event ──────────────────
console.log("\n── applyChoiceMemory writes choiceChosenAt ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "domain/memory.js"), "utf8");
  assert(content.includes("choiceChosenAt: Date.now()"), "choiceChosenAt written to m3-event");
}

// ── 29. player-choice event has createdAt ────────────────────────────────────
console.log("\n── player-choice event has createdAt ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "domain/memory.js"), "utf8");
  assert(content.includes("createdAt: Date.now()") && content.includes("playerChoiceEvent"), "player-choice event has createdAt");
}

// ── 30. buildChoiceWorldEffectView uses choiceChosenAt / createdAt in fallback ─
console.log("\n── buildChoiceWorldEffectView: no Date.now() in fallback createdAt ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "domain/choiceWorldEffect.js"), "utf8");
  // The fallback blocks should NOT use Date.now() for createdAt
  const fallbackM3Block = content.match(/source = "m3-event";[\s\S]*?choiceAftermath = \{[\s\S]*?\};/);
  const fallbackPcBlock = content.match(/source = "player-choice";[\s\S]*?choiceAftermath = \{[\s\S]*?\};/);
  assert(!fallbackM3Block?.[0].includes("Date.now()"), "m3-event fallback does not use Date.now()");
  assert(!fallbackPcBlock?.[0].includes("Date.now()"), "player-choice fallback does not use Date.now()");
}

// ── 31. old events without timestamp not marked recent (createdAt = old timestamp) ─
console.log("\n── old event without timestamp: createdAt is old (not Date.now()) ──");
{
  const mod = await import(src("domain/choiceWorldEffect.js"));
  // Simulate an old m3-event fallback (no choiceChosenAt, no createdAt)
  const state = {
    residents: [{ id: "seven", name: "小七" }],
    events: [{
      id: "old-event",
      type: "m3-event",
      placeId: "cafe",
      chosenChoiceId: "c1",
      choices: [{ id: "c1", label: "测试", resultText: "结果。" }],
      // No choiceChosenAt — old event
    }],
  };
  const view = mod.buildChoiceWorldEffectView(state, {});
  // createdAt should NOT be Date.now() (it should be null or old timestamp that makes age > 30s)
  const age = Date.now() - (view.createdAt ?? 0);
  assert(age > 30_000 || view.createdAt === null, `old event createdAt is not Date.now() (age=${age})`);
}

// ── 32. markerLabel ≠ choiceLabel (world trace, not full choice text) ─────────
console.log("\n── markerLabel is world trace, not full choiceLabel ──");
{
  const mod = await import(src("domain/choiceWorldEffect.js"));
  const view = mod.buildChoiceWorldEffectView(
    { residents: [], events: [] },
    {
      choiceAftermath: {
        id: "a1", eventId: "e1", choiceId: "c1", placeId: "cafe",
        choiceLabel: "帮忙把画册送去餐厅",
        summary: "阿远把画册轻放在餐厅入口旁边的架子上。",
        residentReactions: [],
        createdAt: Date.now(),
      },
    }
  );
  // markerLabel should NOT equal the full choiceLabel
  assert(view.markerLabel !== "帮忙把画册送去餐厅", "markerLabel is not the full choiceLabel");
  // It should be a trace-like phrase derived from resultText
  assert(view.markerLabel.length <= 16, `markerLabel ≤ 16 chars (got ${view.markerLabel.length}: "${view.markerLabel}")`);
}

// ── 33. markerLabel max 16 Chinese chars ─────────────────────────────────────
console.log("\n── markerLabel max length ──");
{
  const mod = await import(src("domain/choiceWorldEffect.js"));
  const view = mod.buildChoiceWorldEffectView(
    { residents: [], events: [] },
    {
      choiceAftermath: {
        id: "a2", eventId: "e2", choiceId: "c2", placeId: "garden",
        choiceLabel: "整理花园",
        summary: "小七和米米把花园里的杂草清除干净，又补种了几株新的花苗。",
        residentReactions: [],
        createdAt: Date.now(),
      },
    }
  );
  assert(view.markerLabel.length <= 16, `markerLabel ≤ 16 chars (got ${view.markerLabel.length}: "${view.markerLabel}")`);
}

// ── 34. safeText helper exists in render.js ──────────────────────────────────
console.log("\n── safeText helper exists ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "ui/render.js"), "utf8");
  assert(content.includes("function safeText(value, fallback"), "safeText function defined");
  assert(content.includes("return value == null ? fallback : String(value)"), "safeText null-check logic correct");
}

// ── 35. latestBroadcast.script uses safeText (no undefined in HTML) ───────────
console.log("\n── latestBroadcast.script: no undefined output ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync(resolve(SRC, "ui/render.js"), "utf8");
  // Should use safeText for latestBc.title and latestBc.script, not bare escapeHtml
  assert(content.includes("safeText(latestBc.title") || content.includes("safeText(latestBc.script"), "safeText used for latestBc fields");
}

// ── 36. CSS: choiceMarkerFadeOut animation exists ─────────────────────────────
console.log("\n── CSS: choiceMarkerFadeOut animation ──");
{
  const fs = await import("fs");
  const css = fs.readFileSync(resolve(PROJECT_ROOT, "src/styles.css"), "utf8");
  assert(css.includes("@keyframes choiceMarkerFadeOut") || css.includes("choiceMarkerFadeOut"), "choiceMarkerFadeOut animation defined");
}

// ── 37. affectedResidents hasBubble field: only 1 primary resident ─────────────
console.log("\n── affectedResidents: only 1 hasBubble ──");
{
  const mod = await import(src("domain/choiceWorldEffect.js"));
  const residents = [
    { id: "seven", name: "小七", locationId: "cafe" },
    { id: "zhou", name: "老周", locationId: "plaza" },
    { id: "hua", name: "阿花", locationId: "cafe" },
  ];
  const view = mod.buildChoiceWorldEffectView(
    { residents, events: [] },
    {
      choiceAftermath: {
        id: "a4", eventId: "e4", choiceId: "c4", placeId: "cafe",
        choiceLabel: "测试选择",
        summary: "结果说明",
        residentReactions: [
          { residentId: "seven", residentName: "小七", reaction: "明白了。" },
          { residentId: "zhou", residentName: "老周", reaction: "好的。" },
          { residentId: "hua", residentName: "阿花", reaction: "知道了。" },
        ],
        createdAt: Date.now(),
      },
    }
  );
  assert(view.visible === true, "visible is true");
  const bubbleCount = view.affectedResidents.filter((r) => r.hasBubble).length;
  assert(bubbleCount === 1, `only 1 resident has hasBubble=true (got ${bubbleCount})`);
  assert(view.affectedResidents.length >= 1, "has at least 1 affected resident");
}

// ── 38. contextLabel exists on primary resident ─────────────────────────────────
console.log("\n── contextLabel on primary resident ──");
{
  const mod = await import(src("domain/choiceWorldEffect.js"));
  const residents = [
    { id: "seven", name: "小七", locationId: "cafe" },
    { id: "zhou", name: "老周", locationId: "plaza" },
  ];
  const view = mod.buildChoiceWorldEffectView(
    { residents, events: [] },
    {
      choiceAftermath: {
        id: "a5", eventId: "e5", choiceId: "c5", placeId: "cafe",
        choiceLabel: "测试",
        summary: "阿远把画册放在餐厅。",
        residentReactions: [
          { residentId: "seven", residentName: "小七", reaction: "明白了。" },
          { residentId: "zhou", residentName: "老周", reaction: "好的。" },
        ],
        createdAt: Date.now(),
      },
    }
  );
  const primary = view.affectedResidents.find((r) => r.hasBubble);
  assert(primary !== undefined, "primary (hasBubble) resident exists");
  assert(primary?.contextLabel !== undefined && primary?.contextLabel !== null, "primary has contextLabel");
  assert(typeof primary?.contextLabel === "string" && primary.contextLabel.length > 0, "contextLabel is non-empty string");
  // contextLabel should include the place name
  assert(primary?.contextLabel.includes("餐厅") || primary?.contextLabel.includes("小镇"), "contextLabel includes place name");
}

// ── 39. contextLabel ≤ 18 chars ───────────────────────────────────────────────
console.log("\n── contextLabel max 18 chars ──");
{
  const mod = await import(src("domain/choiceWorldEffect.js"));
  const residents = [{ id: "seven", name: "小七", locationId: "cafe" }];
  const view = mod.buildChoiceWorldEffectView(
    { residents, events: [] },
    {
      choiceAftermath: {
        id: "a6", eventId: "e6", choiceId: "c6", placeId: "cafe",
        choiceLabel: "测试",
        summary: "小七把画册轻放在餐厅入口旁边的架子上，非常高",
        residentReactions: [
          { residentId: "seven", residentName: "小七", reaction: "明白了，我会处理的。" },
        ],
        createdAt: Date.now(),
      },
    }
  );
  const primary = view.affectedResidents.find((r) => r.hasBubble);
  if (primary?.contextLabel) {
    assert(primary.contextLabel.length <= 18, `contextLabel ≤ 18 chars (got ${primary.contextLabel.length}: "${primary.contextLabel}")`);
  }
}

// ── 40. no undefined in HTML output after choice (renderApp check) ─────────────
console.log("\n── renderApp: no undefined after choice ──");
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
  // Simulate choice aftermath in uiState
  const uiState = {
    choiceAftermath: {
      id: "post-choice-test", eventId: "evt-1", choiceId: "c1", placeId: "cafe",
      choiceLabel: "帮忙把画册送去餐厅",
      summary: "小七把画册轻放在餐厅旁边。",
      residentReactions: [
        { residentId: "seven", residentName: "小七", reaction: "放在这里，大家路过都能看到。" },
        { residentId: "zhou", residentName: "老周", reaction: "放在餐厅旁边挺合适。" },
      ],
      createdAt: Date.now(),
    },
  };
  renderMod.renderApp(mockRoot, state, {}, uiState);
  const html = mockRoot.innerHTML;

  // Basic safety nets
  assert(!html.includes(">undefined<"), "no >undefined< in HTML after choice");
  assert(!html.includes(" undefined "), "no ' undefined ' in text nodes after choice");
  assert(!html.includes(">null<"), "no >null< in HTML after choice");
  assert(!html.includes(" null "), "no ' null ' in text nodes after choice");
  assert(!html.includes("✅ undefined"), "no ✅ undefined completion banner");

  // Bubble count: at most 1 reaction bubble (primary resident only)
  const bubbleMatches = html.match(/stage-character__choice-reaction/g) ?? [];
  assert(bubbleMatches.length <= 1, `at most 1 choice reaction bubble in HTML (got ${bubbleMatches.length})`);

  // Highlight count: >= affectedResidents.length (all affected get highlighted)
  const highlightMatches = html.match(/stage-character--choice-affected/g) ?? [];
  // We have 2 residentReactions in uiState
  assert(highlightMatches.length >= 2, `≥2 choice-affected highlights in HTML (got ${highlightMatches.length})`);
}

// ── Results ────────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll choice-world-effect checks passed!");
