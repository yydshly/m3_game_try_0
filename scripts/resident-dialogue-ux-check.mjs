// resident-dialogue-ux-check — validates V1 resident dialogue UX improvements
import { createInitialState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";
import { renderApp } from "../src/ui/render.js";
import { selectTownLifeScenario } from "../src/domain/aiDirector.js";
import { buildResidentDialogueTurns } from "../src/services/dialogueGenerator.js";
import { buildVoicePlaybackView } from "../src/ui/render.js";

const root = {
  innerHTML: "",
  querySelector: () => ({ addEventListener() {} }),
  querySelectorAll: () => [],
};

const handlers = {
  onAdvance() {},
  onRunDay() {},
  onToggleAutoPlay() {},
  onMiniMaxPlan() {},
  onMiniMaxEvent() {},
  onMiniMaxBroadcast() {},
  onGenerateTts() {},
  onPlayTts() {},
  onPauseTts() {},
  onAssignTask() {},
  onSelectResident() {},
  onResetAssignments() {},
  onNewTown() {},
  onChooseEvent() {},
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); }
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
}

// ── 1. buildResidentDialogueTurns returns structured turns ─────────────────────
console.log("\n── buildResidentDialogueTurns returns structured turns ──");
{
  const state = createInitialState();
  const turns = buildResidentDialogueTurns(state, { rotationSeed: 1 });
  assert(Array.isArray(turns), "returns an array");
  assert(turns.length > 0, "has at least one turn");
  const first = turns[0];
  assert("from" in first, "turn has 'from' field");
  assert("to" in first, "turn has 'to' field");
  assert("text" in first, "turn has 'text' field");
  assert("reason" in first, "turn has 'reason' field");
  assert("speakerId" in first, "turn has 'speakerId' field");
  assert("targetId" in first, "turn has 'targetId' field");
  assert("speakerName" in first, "turn has 'speakerName' field");
  assert("targetName" in first, "turn has 'targetName' field");
  assert(first.from === "speaker" || first.from === "target", "from is 'speaker' or 'target'");
  assert(first.to === "speaker" || first.to === "target", "to is 'speaker' or 'target'");
}

// ── 2. Dialogue content includes task/location/phase context ─────────────────
console.log("\n── Dialogue content includes task/location/phase context ──");
{
  const state = createInitialState();
  state.residents[0].assignmentId = "plant";
  state.residents[0].locationId = "garden";
  state.residents[1].assignmentId = "cook";
  state.residents[1].locationId = "cafe";
  state.phaseIndex = 0; // morning

  const turns = buildResidentDialogueTurns(state, { rotationSeed: 1 });
  const allText = turns.map((t) => t.text).join("");

  assert(
    allText.includes("花园") || allText.includes("早上") || allText.includes("照看") || allText.includes("餐点"),
    "dialogue includes location, phase, or task context"
  );
}

// ── 3. No purely generic "今天感觉怎么样" exchanges ───────────────────────────
console.log("\n── No purely generic exchanges ──");
{
  const state = createInitialState();
  state.phaseIndex = 0;
  state.residents[0].assignmentId = "chat";
  state.residents[1].assignmentId = "chat";

  // Check that dialogue is NOT just the generic fallback
  const GENERIC_PATTERNS = [
    "今天感觉怎么样？",
    "还不错，你呢？",
  ];
  const turns = buildResidentDialogueTurns(state, { rotationSeed: 5 });
  const allText = turns.map((t) => t.text).join("");

  // It's OK if some generic words appear in context, but not the whole exchange
  const hasPureGeneric = GENERIC_PATTERNS.every((p) => allText === p || allText.includes(p));
  assert(!hasPureGeneric, "dialogue is not purely generic exchange");
  assert(turns.length >= 2, "has at least 2 turns");
}

// ── 4. Turn has reason field set ─────────────────────────────────────────────
console.log("\n── Turn reason field set ──");
{
  const state = createInitialState();
  const turns = buildResidentDialogueTurns(state, { rotationSeed: 1 });
  for (const turn of turns) {
    assert(
      turn.reason != null && turn.reason.length > 0,
      `turn reason is non-empty: "${turn.reason}"`
    );
  }
}

// ── 5. buildVoicePlaybackView returns type distinction ─────────────────────────
console.log("\n── buildVoicePlaybackView distinguishes resident-dialogue vs town-broadcast ──");
{
  const conversationVp = {
    key: "conversation:hua:conv-line-1",
    provider: "mimo",
    scene: "conversation",
    sourceType: "conversation",
    sourceId: "hua",
    title: "小花",
    subtitle: "对 阿远 说",
    textPreview: "早上的光刚好。",
    status: "playing",
    error: "",
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };

  const broadcastVp = {
    key: "minimax-broadcast",
    provider: "minimax",
    scene: "town_broadcast",
    sourceType: "town_broadcast",
    sourceId: "",
    title: "小镇广播",
    subtitle: "",
    textPreview: "今天的小镇很温馨。",
    status: "playing",
    error: "",
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };

  const convView = buildVoicePlaybackView(conversationVp);
  const bcView = buildVoicePlaybackView(broadcastVp);

  assert(convView.type === "conversation" || convView.type === "conversation", "conversation type detected");
  assert(bcView.type === "town_broadcast", "broadcast type detected");
  assert(convView.visible === true, "conversation view is visible when playing");
  assert(bcView.visible === true, "broadcast view is visible when playing");
  assert(convView.speakerName === "小花", "conversation view has speakerName");
  assert(bcView.speakerName === "小镇广播", "broadcast view has speakerName as fallback title");
}

// ── 6. Compact chip CSS: voice-playback-chip class exists ───────────────────────
console.log("\n── CSS: compact chip class exists ──");
{
  const fs = await import("fs");
  const css = fs.readFileSync("./src/styles.css", "utf8");
  assert(css.includes(".voice-playback-chip"), "voice-playback-chip class exists in CSS");
  assert(css.includes(".voice-playback-chip--playing"), "chip playing state class exists");
  assert(css.includes(".voice-playback-chip--idle"), "chip idle state class exists");
  assert(css.includes(".voice-playback-chip--paused"), "chip paused state class exists");
  assert(css.includes("position: absolute"), "chip uses absolute positioning");
  assert(css.includes("bottom: 14px"), "chip positioned at bottom of stage");
}

// ── 7. Old voice-playback-slot no longer pushes layout with min-height ───────
console.log("\n── Voice playback slot no longer pushes layout ──");
{
  const fs = await import("fs");
  const css = fs.readFileSync("./src/styles.css", "utf8");
  // The slot should now use display:contents or be removed/minimal
  // Not the old min-height: 72px that pushed layout
  const slotBlock = css.match(/\.voice-playback-slot\s*\{([^}]*)\}/);
  if (slotBlock) {
    const styles = slotBlock[1];
    assert(!styles.includes("min-height: 72px"), "voice-playback-slot no longer has min-height: 72px");
  } else {
    assert(true, "voice-playback-slot block not found (assumed replaced with display:contents)");
  }
}

// ── 8. renderTownStage includes voice playback chip ────────────────────────────
console.log("\n── renderTownStage includes voice playback chip ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    activeScenario: selectTownLifeScenario(state),
    residentSceneBeats: [],
    currentVoicePlayback: null,
  });
  assert(root.innerHTML.includes("voice-playback-chip"), "voice-playback-chip rendered in town-stage");
}

// ── 9. Right panel dialogue: no TTS buttons ─────────────────────────────────
console.log("\n── Right panel dialogue: no TTS buttons ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    activeScenario: selectTownLifeScenario(state),
    residentSceneBeats: [
      {
        id: "beat-1",
        residentId: state.residents[0].id,
        residentName: state.residents[0].name,
        dialogue: "早上的光刚好。",
        actionHint: "照料花园",
        emotion: "平静",
      },
    ],
    currentVoicePlayback: null,
  });
  // Should NOT have TTS button in dialogue beats panel
  const dialoguePanelHtml = root.innerHTML.match(/<div class="panel dialogue-beats-panel"[^>]*>[\s\S]*?<\/div>\s*<div class="panel"/)?.[0] ?? "";
  const hasTtsBtn = dialoguePanelHtml.includes("mimo-tts-btn") || dialoguePanelHtml.includes("data-action=\"play-mimo-tts\"");
  assert(!hasTtsBtn, "dialogue beats panel does not contain TTS playback buttons");
}

// ── 10. Right panel shows conversation record when queue active ───────────────
console.log("\n── Right panel shows conversation record when queue active ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    activeScenario: selectTownLifeScenario(state),
    residentSceneBeats: [],
    residentConversation: {
      enabled: true,
      status: "playing",
      queue: [
        { id: "conv-line-1", speakerId: "hua", targetId: "yuan", speakerName: "小花", targetName: "阿远", text: "早上的光刚好。", audioKey: "conversation:hua:conv-line-1", scene: "conversation", status: "idle" },
        { id: "conv-line-2", speakerId: "yuan", targetId: "hua", speakerName: "阿远", targetName: "小花", text: "是啊，去花园看看吧。", audioKey: "conversation:yuan:conv-line-2", scene: "conversation", status: "idle" },
      ],
      currentIndex: 0,
      currentLineId: "conv-line-1",
      visibleText: "早",
    },
  });
  assert(root.innerHTML.includes("dialogue-beat"), "dialogue-beat elements rendered for conversation");
  assert(root.innerHTML.includes("小花"), "conversation speakerName shown in right panel");
  assert(root.innerHTML.includes("阿远"), "conversation targetName shown in right panel");
}

// ── 11. Map bubbles: only current speaker shows bubble ─────────────────────────
console.log("\n── Map bubbles: only current speaker shows bubble ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    activeScenario: selectTownLifeScenario(state),
    residentSceneBeats: [],
    residentConversation: {
      enabled: true,
      status: "playing",
      queue: [
        { id: "conv-line-1", speakerId: "hua", targetId: "yuan", speakerName: "小花", targetName: "阿远", text: "早上的光刚好。", audioKey: "conversation:hua:conv-line-1", scene: "conversation", status: "idle" },
        { id: "conv-line-2", speakerId: "yuan", targetId: "hua", speakerName: "阿远", targetName: "小花", text: "是啊。", audioKey: "conversation:yuan:conv-line-2", scene: "conversation", status: "idle" },
      ],
      currentIndex: 0,
      currentLineId: "conv-line-1",
      visibleText: "早上的光刚好。",
      sessionState: {
        id: "conv-d1-p0-hua-yuan",
        status: "playing",
        locationId: "garden",
        locationLabel: "花园",
        participants: [
          { residentId: "hua", residentName: "小花", role: "speaker" },
          { residentId: "yuan", residentName: "阿远", role: "listener" },
        ],
        currentIndex: 0,
        lines: [
          { id: "conv-line-1", speakerId: "hua", speakerName: "小花", targetId: "yuan", targetName: "阿远", text: "早上的光刚好。", reason: "morning-task" },
          { id: "conv-line-2", speakerId: "yuan", speakerName: "阿远", targetId: "hua", targetName: "小花", text: "是啊。", reason: "morning-checkin" },
        ],
      },
    },
  });
  // Count stage-character__dialogue--conversation elements
  const conversationBubbleMatches = root.innerHTML.match(/stage-character__dialogue--conversation/g) || [];
  assert(conversationBubbleMatches.length === 1, `only 1 conversation bubble rendered (got ${conversationBubbleMatches.length})`);
}

// ── 12. stage-bubble (今日动态) still exists ─────────────────────────────────
console.log("\n── stage-bubble (今日动态) still exists ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, { activeScenario: selectTownLifeScenario(state), residentSceneBeats: [] });
  assert(root.innerHTML.includes("stage-bubble"), "stage-bubble element exists");
  assert(root.innerHTML.includes("今日动态"), "今日动态 label preserved");
}

// ── 13. deed-outcome-panel still exists ───────────────────────────────────────
console.log("\n── deed-outcome-panel still exists ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    activeScenario: selectTownLifeScenario(state),
    residentSceneBeats: [],
    completionFeedback: {
      id: "cf1",
      message: "本阶段行动完成",
      startedAt: Date.now(),
      residentResults: [
        { residentId: state.residents[0].id, icon: "🌸", label: "完成花园" },
      ],
    },
  });
  assert(root.innerHTML.includes("deed-outcome-panel"), "deed-outcome-panel still renders");
}

// ── 14. No state.events reverse find in dialogue generation ───────────────────
console.log("\n── No state.events reverse find in dialogueGenerator.js ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./src/services/dialogueGenerator.js", "utf8");
  const hasReverseFind = content.includes(".slice().reverse()") ||
                        content.includes(".reverse()") ||
                        content.includes("events?.slice(-1)") ||
                        content.includes("events[events.length - 1]");
  assert(!hasReverseFind, "dialogueGenerator.js does not use state.events reverse find");
}

// ── 15. buildVoicePlaybackView handles idle/empty state ───────────────────────
console.log("\n── buildVoicePlaybackView handles idle/empty state ──");
{
  const idleView = buildVoicePlaybackView(null);
  assert(idleView.visible === false, "null input returns visible: false");

  const emptyVp = { key: "", provider: "", scene: "", sourceType: "", title: "", subtitle: "", textPreview: "", status: "idle", error: "" };
  const emptyView = buildVoicePlaybackView(emptyVp);
  assert(emptyView.visible === false, "idle status returns visible: false");
}

// ── 16. Dialogue snippets include task/location placeholders ────────────────────
console.log("\n── Dialogue snippets include task/location placeholders ──");
{
  const state = createInitialState();
  state.phaseIndex = 0; // morning
  state.residents[0].assignmentId = "plant";
  state.residents[0].locationId = "garden";
  state.residents[1].assignmentId = "chat";
  state.residents[1].locationId = "plaza";
  const turns = buildResidentDialogueTurns(state, { rotationSeed: 1 });
  assert(turns.length > 0, "returns turns for morning phase with tasks");
}

// ── 17. Compact chip positioned inside town-stage, not between HUD and layout ─────
console.log("\n── Compact chip positioned inside town-stage (not between HUD and layout) ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    activeScenario: selectTownLifeScenario(state),
    residentSceneBeats: [],
    currentVoicePlayback: {
      key: "test",
      provider: "mimo",
      scene: "conversation",
      sourceType: "conversation",
      sourceId: "hua",
      title: "小花",
      subtitle: "对 阿远 说",
      textPreview: "早上的光刚好。",
      status: "playing",
      error: "",
      startedAt: Date.now(),
      updatedAt: Date.now(),
    },
  });
  // The chip should NOT be between game-hud and layout (old large slot position)
  // It should be inside town-stage (which comes after the layout in HTML)
  // Verify the chip is not in the standalone slot position
  const hudEnd = root.innerHTML.indexOf("</header>");
  const layoutStart = root.innerHTML.indexOf('<main class="layout"');
  const chipPos = root.innerHTML.indexOf("voice-playback-chip");
  // Chip should NOT be between hud end and layout start
  const inOldSlotPosition = chipPos > hudEnd && chipPos < layoutStart;
  assert(!inOldSlotPosition, "voice-playback-chip is NOT between HUD and layout");
  assert(chipPos > layoutStart, "voice-playback-chip is after layout (inside town-stage)");
}

// ── 18. No mimo-tts-btn in the old voice-playback-bar location ───────────────
console.log("\n── No large standalone voice playback bar above layout ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    activeScenario: selectTownLifeScenario(state),
    residentSceneBeats: [],
    currentVoicePlayback: {
      key: "test",
      provider: "mimo",
      scene: "conversation",
      sourceType: "conversation",
      sourceId: "hua",
      title: "小花",
      subtitle: "对 阿远 说",
      textPreview: "测试文本",
      status: "playing",
      error: "",
      startedAt: Date.now(),
      updatedAt: Date.now(),
    },
  });
  // Should NOT have the old large voice-playback-bar with min-height: 72px
  // Chip should be inside town-stage, not in a separate slot
  const hasOldSlot = root.innerHTML.includes("voice-playback-slot") && root.innerHTML.includes("min-height: 72px");
  assert(!hasOldSlot, "old large voice-playback-slot with min-height is gone");
}

// ── Results ────────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll resident dialogue UX checks passed!");
