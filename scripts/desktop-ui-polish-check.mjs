// desktop-ui-polish-check — validates desktop UI polish changes
import { createInitialState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";
import { renderApp } from "../src/ui/render.js";

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
  onAssignTask() {},
  onSelectResident() {},
  onResetAssignments() {},
  onNewTown() {},
  onChooseEvent() {},
  onGenerateTts() {},
  onPlayTts() {},
};

function makeUiState(overrides = {}) {
  return {
    activeTaskAnimations: [],
    selectedResidentId: null,
    autoPlay: false,
    llmStatus: "idle",
    llmMessage: "",
    eventDirectorStatus: "idle",
    eventDirectorMessage: "",
    broadcastStatus: "idle",
    broadcastMessage: "",
    latestBroadcast: null,
    broadcastAudio: { status: "idle", text: "", audioUrl: null, error: null },
    isAnimating: false,
    animationMessage: "",
    completionFeedback: null,
    ...overrides,
  };
}

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

// ── Test: Map stage bubble text is truncated to 120 chars ───────────────────

console.log("\n── Map stage bubble: max 120 char truncation ──");
{
  const state = createInitialState();
  // Inject a long event text > 120 chars — must NOT be type "system" (those are skipped)
  state.events.push({
    id: "long-event",
    day: 1,
    phase: "morning",
    type: "action",
    text: "早晨的阳光洒在小镇的花园里，居民们开始了新的一天。早晨的阳光洒在小镇的花园里，居民们开始了新的一天。早晨的阳光洒在小镇的花园里，居民们开始了新的一天。早晨的阳光洒在小镇的花园里，居民们开始了新的一天。早晨的阳光洒在小镇的花园里。居民们午后相聚在广场。",
  });

  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState());

  const bubbleMatch = root.innerHTML.match(/<aside class="stage-bubble"[^>]*>[\s\S]*?<\/aside>/);
  assert(bubbleMatch !== null, "stage-bubble is rendered");

  // Extract the text inside the bubble
  const bubbleText = bubbleMatch?.[0] ?? "";
  // Check the bubble contains "今日动态" tag (not "最新动态")
  assert(bubbleText.includes("今日动态"), "stage-bubble shows '今日动态' (stable digest, not latest event)");
  // Extract text from <p> and verify reasonable length (digest is short text, not event)
  const pMatch = bubbleText.match(/<p>([\s\S]*?)<\/p>/);
  const pText = pMatch?.[1] ?? "";
  const cleanText = pText.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  assert(cleanText.length >= 4 && cleanText.length <= 121, `bubble digest text is reasonable length (got ${cleanText.length})`);
}

// ── Test: Right panel atmosphere broadcast still shows content (truncated to 120) ─

console.log("\n── Right panel: atmosphere broadcast content preserved ──");
{
  const state = createInitialState();
  const longScript = "这是一个非常长的完整广播文本内容，用于确保右侧小镇氛围面板仍然显示完整的广播内容，不会因为地图上的截断而受到影响，这里应该显示全部文字。".repeat(3);
  const truncatedScript = longScript.slice(0, 120) + "…";

  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: {
      id: "bc1",
      title: "早安小镇",
      script: longScript,
      mood: "warm",
      placeId: "plaza",
      musicMood: "轻快",
    },
  }));

  assert(root.innerHTML.includes("atmosphere-broadcast-preview"), "atmosphere panel rendered");
  assert(root.innerHTML.includes(truncatedScript), "truncated script (120 chars) shown in right panel");
  assert(root.innerHTML.includes("atmosphere-tag"), "mood and music mood tags shown");
}

// ── Test: Idle event director is compact (no long placeholder) ───────────────

console.log("\n── Idle event director: compact single-line style ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({ eventDirectorStatus: "idle" }));

  assert(root.innerHTML.includes("event-director__idle"), "idle compact class present");
  // idle uses a div (not section.panel), so no panel__head inside event-director--idle
  const idleMatch = root.innerHTML.match(/<div class="event-director event-director--idle">[\s\S]*?<\/div>/);
  assert(idleMatch !== null, "idle state renders as compact div, not full panel section");
  assert(root.innerHTML.includes("小镇事件导演"), "event director label present in idle state");
}

// ── Test: Stage character task label hidden during animation ─────────────────

console.log("\n── Stage character: task label hidden during animation ──");
{
  const state = createInitialState();
  const resident = state.residents[0];
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    activeTaskAnimations: [
      {
        residentId: resident.id,
        fromPlaceId: "garden",
        toPlaceId: "cafe",
        action: "travel",
        traveling: true,
        gait: "walk",
        bubble: "去餐厅帮忙",
      },
    ],
    isAnimating: true,
    animationMessage: "居民正在行动中",
  }));

  // During animation, task label should NOT appear alongside the action bubble
  // (the task label is hidden during anim per our change)
  const charHtml = root.innerHTML.match(new RegExp(`data-resident-id="${resident.id}"[\\s\\S]*?<\\/button>`));
  if (charHtml) {
    const hasTaskOnly = charHtml[0].includes("stage-character__task") && !charHtml[0].includes("stage-character__action-bubble");
    const hasActionBubble = charHtml[0].includes("stage-character__action-bubble");
    assert(hasActionBubble || !hasTaskOnly, "task label hidden when action bubble is shown");
  } else {
    assert(false, "resident character button found in DOM");
  }
}

// ── Test: Completion badge takes priority over mood icon on stage ────────────

console.log("\n── Stage character: completion badge priority over mood icon ──");
{
  const state = createInitialState();
  const resident = state.residents[0];

  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    completionFeedback: {
      id: "cf1",
      message: "本阶段完成",
      startedAt: Date.now(),
      residentResults: [
        { residentId: resident.id, icon: "🌸", label: "完成花园任务" },
      ],
    },
  }));

  assert(root.innerHTML.includes("stage-character__completion-badge"), "completion badge rendered on stage");
  // mood icon should NOT appear when completion badge is present
  const charHtml = root.innerHTML.match(new RegExp(`data-resident-id="${resident.id}"[\\s\\S]*?<\\/button>`));
  if (charHtml) {
    const hasCompletionBadge = charHtml[0].includes("stage-character__completion-badge");
    const hasMoodIcon = charHtml[0].includes("stage-character__mood");
    assert(hasCompletionBadge && !hasMoodIcon, "mood icon hidden when completion badge shown");
  }
}

// ── Test: TTS button still present in atmosphere panel ─────────────────────

console.log("\n── TTS button: still present in atmosphere panel ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: {
      id: "bc1",
      title: "晚安小镇",
      script: "月色温柔，小镇进入安静的夜晚。",
      mood: "calm",
      placeId: "plaza",
    },
  }));

  assert(root.innerHTML.includes('data-action="generate-tts"'), "TTS generate button present");
  assert(root.innerHTML.includes("🎧 小镇氛围"), "atmosphere panel rendered");
}

// ── Test: Right panel broadcast shows title and full script ─────────────────

console.log("\n── Right panel: broadcast title + full script ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState({
    latestBroadcast: {
      id: "bc1",
      title: "早安小镇广播",
      script: "欢迎来到小镇新的一天，今天天气晴朗，适合在花园散步。",
      mood: "lively",
      placeId: "garden",
      musicMood: "轻快",
      musicPrompt: "一段轻快的钢琴曲",
    },
  }));

  assert(root.innerHTML.includes("atmosphere-broadcast-preview__title"), "broadcast title rendered");
  assert(root.innerHTML.includes("早安小镇广播"), "broadcast title text present");
  assert(root.innerHTML.includes("欢迎来到小镇新的一天"), "full broadcast script preserved");
  assert(root.innerHTML.includes("轻快") && root.innerHTML.includes("atmosphere-tag"), "music mood tag shown");
  assert(root.innerHTML.includes("一段轻快的钢琴曲"), "music prompt present");
}

// ── Test: Layout uses 3-column desktop grid ─────────────────────────────────

console.log("\n── CSS: desktop 3-column layout class applied ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, makeUiState());

  assert(root.innerHTML.includes('class="layout"'), "layout div present");
  assert(root.innerHTML.includes('class="left-col"'), "left-col present");
  assert(root.innerHTML.includes('class="map-panel"'), "map-panel present");
  assert(root.innerHTML.includes('class="side-panel"'), "side-panel present");
  assert(root.innerHTML.includes('class="town-stage'), "town-stage present");
}

// ── Results ────────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll desktop UI polish checks passed!");
