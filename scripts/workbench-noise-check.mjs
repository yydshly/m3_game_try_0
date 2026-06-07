// workbench-noise-check — validates workbench interaction noise reduction rules
import { createInitialState } from "../src/domain/state.js";
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
  onGenerateTts() {},
  onPlayTts() {},
  onPauseTts() {},
  onAssignTask() {},
  onSelectResident() {},
  onResetAssignments() {},
  onNewTown() {},
  onChooseEvent() {},
  onPlayMimoTts() {},
  onPauseMimoTts() {},
  onResumeMimoTts() {},
  onStopConversation() {},
  onRunTownDayCycle() {},
  onVoicePause() {},
  onVoiceResume() {},
  onVoiceStop() {},
};

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

// ── Test 1: Idle state shows current scene bubble ──────────────────────────────

console.log("\n── Idle state: shows '当前场景' bubble ──");
{
  const state = createInitialState();
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    selectedResidentFocus: { residentId: state.residents[0].id, clickedAt: 0 },
  });

  const html = root.innerHTML;

  assert(html.includes("当前场景"), "idle shows '当前场景'");
  assert(html.includes("stage-bubble--scene"), "idle has stage-bubble--scene class");
  assert(!html.includes("正在观察"), "idle does NOT show '正在观察' when clickedAt=0");
}

// ── Test 2: Idle + clickedAt>0 shows resident focus ──────────────────────────

console.log("\n── Idle + clickedAt>0: shows resident focus bubble ──");
{
  const state = createInitialState();
  const residentId = state.residents[0].id;

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    selectedResidentFocus: { residentId, clickedAt: Date.now() },
  });

  const html = root.innerHTML;

  assert(html.includes("正在观察"), "idle with click shows '正在观察'");
  assert(html.includes("stage-bubble--resident-focus"), "has stage-bubble--resident-focus class");
  assert(!html.includes("stage-bubble--scene"), "idle with click does NOT show scene bubble");
}

// ── Test 3: Conversation playing suppresses resident focus ──────────────────────

console.log("\n── Conversation playing: suppresses resident focus bubble ──");
{
  const state = createInitialState();
  const residentId = state.residents[0].id;
  const queue = [
    { id: "line-1", speakerId: state.residents[0].id, speakerName: state.residents[0].name, text: "今天天气真好。", audioKey: "conv:r0:line-1" },
    { id: "line-2", speakerId: state.residents[1].id, speakerName: state.residents[1].name, text: "是啊，适合出去走走。", audioKey: "conv:r1:line-2" },
  ];

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    selectedResidentFocus: { residentId, clickedAt: Date.now() },
    residentConversation: {
      enabled: true,
      status: "playing",
      queue,
      currentIndex: 0,
      currentLineId: "line-1",
      visibleText: "今天天气真好。",
    },
  });

  const html = root.innerHTML;

  assert(!html.includes("正在观察"), "conversation playing suppresses '正在观察'");
  assert(!html.includes("stage-bubble--resident-focus"), "conversation playing suppresses resident-focus bubble");
}

// ── Test 4: Conversation playing suppresses scene bubble ───────────────────────

console.log("\n── Conversation playing: suppresses scene bubble ──");
{
  const state = createInitialState();
  const queue = [
    { id: "line-1", speakerId: state.residents[0].id, speakerName: state.residents[0].name, text: "你好。", audioKey: "conv:r0:line-1" },
  ];

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    residentConversation: {
      enabled: true,
      status: "playing",
      queue,
      currentIndex: 0,
      currentLineId: "line-1",
      visibleText: "你好。",
    },
  });

  const html = root.innerHTML;

  assert(!html.includes("stage-bubble--scene"), "conversation playing suppresses scene bubble");
  assert(!html.includes("当前场景"), "conversation playing suppresses '当前场景'");
}

// ── Test 5: Conversation playing hides recommended-voice card ─────────────────

console.log("\n── Conversation playing: hides recommended-voice card ──");
{
  const state = createInitialState();
  const queue = [
    { id: "line-1", speakerId: state.residents[0].id, speakerName: state.residents[0].name, text: "你好。", audioKey: "conv:r0:line-1" },
  ];

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    residentConversation: {
      enabled: true,
      status: "playing",
      queue,
      currentIndex: 0,
      currentLineId: "line-1",
      visibleText: "你好。",
    },
    residentVoiceInteraction: {
      enabled: true,
      recommendedClipKey: "clip-1",
      lastTriggeredAt: Date.now(),
      hint: "试试听一下",
    },
    residentVoiceClips: [
      { key: "clip-1", residentId: state.residents[0].id, residentName: state.residents[0].name, text: "推荐语音", scene: "resident_dialogue" },
    ],
  });

  const html = root.innerHTML;

  // The recommended-voice card should not appear during conversation
  assert(!html.includes("推荐收听"), "conversation playing suppresses recommended-voice card");
  // Note: 🎧 appears in the atmosphere-panel header (🎧 小镇氛围) which is separate content
  assert(!html.includes("recommended-voice__label"), "conversation playing suppresses recommended-voice label text");
}

// ── Test 6: Past dialogue lines do not show "已就绪" ──────────────────────────

console.log("\n── Past dialogue lines: no '已就绪' label ──");
{
  const state = createInitialState();
  const queue = [
    { id: "line-1", speakerId: state.residents[0].id, speakerName: state.residents[0].name, text: "第一句。", audioKey: "conv:r0:line-1" },
    { id: "line-2", speakerId: state.residents[1].id, speakerName: state.residents[1].name, text: "第二句。", audioKey: "conv:r1:line-2" },
  ];

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    residentConversation: {
      enabled: true,
      status: "playing",
      queue,
      currentIndex: 1,
      currentLineId: "line-2",
      visibleText: "第二句。",
    },
    ttsAudios: {
      "conv:r0:line-1": { status: "ready" },   // past line — should NOT show 已就绪
      "conv:r1:line-2": { status: "loading" },  // current line — can show 生成中
    },
  });

  const html = root.innerHTML;

  // Should not show "已就绪" for the past line
  const pastLineDiv = html.match(/data-conversation-audio-key="conv:r0:line-1"[^>]*>[\s\S]*?<div class="dialogue-beat__voice-status">已就绪<\/div>/);
  assert(!pastLineDiv, "past line does NOT display '已就绪' voice status");
}

// ── Test 7: Current dialogue line can show "播放中" ────────────────────────────

console.log("\n── Current dialogue line: shows voice status labels ──");
{
  const state = createInitialState();
  const queue = [
    { id: "line-1", speakerId: state.residents[0].id, speakerName: state.residents[0].name, text: "第一句。", audioKey: "conv:r0:line-1" },
  ];

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    residentConversation: {
      enabled: true,
      status: "playing",
      queue,
      currentIndex: 0,
      currentLineId: "line-1",
      visibleText: "第一句。",
    },
    ttsAudios: {
      "conv:r0:line-1": { status: "playing" },
    },
  });

  const html = root.innerHTML;

  // Current line should show "播放中" or similar
  assert(html.includes("播放中") || html.includes("生成中"), "current line shows a voice status label");
}

// ── Test 8: Task animation suppresses resident focus ──────────────────────────

console.log("\n── Task animation: suppresses resident focus bubble ──");
{
  const state = createInitialState();
  const residentId = state.residents[0].id;

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    selectedResidentFocus: { residentId, clickedAt: Date.now() },
    isAnimating: true,
    activeTaskAnimations: [
      { residentId: state.residents[0].id, taskId: "plant", bubble: "花园变得更有精神了。" },
    ],
  });

  const html = root.innerHTML;

  assert(!html.includes("正在观察"), "task animation suppresses '正在观察'");
  assert(!html.includes("stage-bubble--resident-focus"), "task animation suppresses resident-focus bubble");
  assert(!html.includes("stage-bubble--scene"), "task animation suppresses scene bubble");
}

// ── Test 9: Voice playback suppresses resident focus ──────────────────────────

console.log("\n── Voice playback active: suppresses resident focus ──");
{
  const state = createInitialState();
  const residentId = state.residents[0].id;

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    selectedResidentFocus: { residentId, clickedAt: Date.now() },
    currentVoicePlayback: {
      key: "broadcast-1",
      provider: "minimax",
      scene: "town_broadcast",
      sourceType: "town_broadcast",
      title: "小镇广播",
      subtitle: "",
      textPreview: "广播内容",
      status: "playing",
    },
  });

  const html = root.innerHTML;

  assert(!html.includes("正在观察"), "voice playback suppresses '正在观察'");
  assert(!html.includes("stage-bubble--resident-focus"), "voice playback suppresses resident-focus bubble");
}

// ── Test 10: Conversation audio hides global playback chip ─────────────────────────

console.log("\n── Conversation audio: hides global playback chip ──");
{
  const state = createInitialState();
  const queue = [
    { id: "line-1", speakerId: state.residents[0].id, speakerName: state.residents[0].name, text: "米米，今天有什么计划吗？", audioKey: "conversation:xiaohua:line-1" },
  ];

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    residentConversation: {
      enabled: true,
      status: "playing",
      queue,
      currentIndex: 0,
      currentLineId: "line-1",
      visibleText: "米米，今天有什么计划吗？",
    },
    currentVoicePlayback: {
      key: "conversation:xiaohua:line-1",
      provider: "mimo",
      scene: "conversation",
      sourceType: "conversation",
      sourceId: state.residents[0].id,
      title: state.residents[0].name,
      subtitle: "对 米米 说",
      textPreview: "米米，今天有什么计划吗？",
      status: "playing",
    },
    ttsAudios: {
      "conversation:xiaohua:line-1": { status: "playing" },
    },
  });

  const html = root.innerHTML;

  // Global playback chip must not appear for conversation audio
  assert(!html.includes("voice-playback-chip--playing"), "conversation does not render global voice playback chip");
  // No "正在播放" global label from the chip
  assert(!html.includes("voice-playback-chip__compact") || !html.includes("正在播放"), "conversation does not show global '正在播放' label");
  // Current dialogue line still shows local playing status
  assert(html.includes("播放中"), "current dialogue line still shows local playing status");
}

// ── Test 10b: Conversation playing shows stage overlay ────────────────────────────

console.log("\n── Conversation playing: shows stage overlay with dialogue text ──");
{
  const state = createInitialState();
  const speakerId = state.residents[0].id;
  const targetId = state.residents[1].id;
  const queue = [
    { id: "line-1", speakerId, targetId, speakerName: state.residents[0].name, targetName: state.residents[1].name, text: "米米，今天有什么计划吗？", audioKey: "conv:r0:line-1" },
  ];

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    residentConversation: {
      enabled: true,
      status: "playing",
      queue,
      currentIndex: 0,
      currentLineId: "line-1",
      visibleText: "米米，今天有什么计划吗？",
      sessionState: {
        participants: [
          { residentId: speakerId, residentName: state.residents[0].name, role: "speaker" },
          { residentId: targetId, residentName: state.residents[1].name, role: "listener" },
        ],
      },
    },
  });

  const html = root.innerHTML;

  // Stage overlay must be present
  assert(html.includes("stage-conversation-overlay"), "conversation renders main stage dialogue overlay");
  // Overlay must show current dialogue text
  assert(html.includes("米米，今天有什么计划吗？"), "conversation overlay shows current dialogue text");
  // Overlay must show speaker name
  assert(html.includes(state.residents[0].name), "conversation overlay shows speaker name");
  // Overlay must show target name
  assert(html.includes(state.residents[1].name), "conversation overlay shows target name");
  // Stage bubbles must be suppressed
  assert(!html.includes("stage-bubble--scene"), "conversation suppresses scene bubble");
  assert(!html.includes("stage-bubble--resident-focus"), "conversation suppresses resident-focus bubble");
  // Global playback chip still hidden
  assert(!html.includes("voice-playback-chip--playing"), "conversation still hides global playback chip");
  // No "正在播放" in main stage
  assert(!html.includes("正在播放"), "conversation does not show '正在播放' on main stage");
}

// ── Test 10c: Speaker gets speaking class, listener gets listening class ───────────

console.log("\n── Conversation: speaker has speaking class, listener has listening class ──");
{
  const state = createInitialState();
  const speakerId = state.residents[0].id;  // 小花 = speaker
  const listenerId = state.residents[1].id;  // 米米 = listener
  const outsiderId = state.residents[2].id;   // 其他居民 = 非参与者
  const queue = [
    { id: "line-1", speakerId, targetId: listenerId, speakerName: state.residents[0].name, targetName: state.residents[1].name, text: "今天天气真好！", audioKey: "conv:r0:line-1" },
  ];

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    residentConversation: {
      enabled: true,
      status: "playing",
      queue,
      currentIndex: 0,
      currentLineId: "line-1",
      visibleText: "今天天气真好！",
      sessionState: {
        participants: [
          { residentId: speakerId, residentName: state.residents[0].name, role: "speaker" },
          { residentId: listenerId, residentName: state.residents[1].name, role: "listener" },
        ],
      },
    },
  });

  const html = root.innerHTML;

  // Speaker must have speaking class
  assert(html.includes('stage-character--speaking'), "current speaker has stage-character--speaking class");
  // Listener must have listening class
  assert(html.includes('stage-character--listening'), "current listener has stage-character--listening class");
  // Non-participant must NOT have speaking or listening class
  // Count total speaking/listening classes - should be exactly 1 each (only the two participants)
  const totalSpeaking = (html.match(/stage-character--speaking/g) || []).length;
  const totalListening = (html.match(/stage-character--listening/g) || []).length;
  assert(totalSpeaking === 1, `only one speaker has speaking class (got ${totalSpeaking})`);
  assert(totalListening === 1, `only one listener has listening class (got ${totalListening})`);
  // Only one speaker should exist
  const speakerMatches = html.match(/stage-character--speaking/g) || [];
  assert(speakerMatches.length === 1, "only one speaker has speaking class");
  // Only one listener should exist
  const listenerMatches = html.match(/stage-character--listening/g) || [];
  assert(listenerMatches.length === 1, "only one listener has listening class");
}

// ── Test 10d: Conversation bubble only on speaker, not on listener ─────────────────

console.log("\n── Conversation: bubble only on speaker, not on listener ──");
{
  const state = createInitialState();
  const speakerId = state.residents[0].id;
  const listenerId = state.residents[1].id;
  const queue = [
    { id: "line-1", speakerId, targetId: listenerId, speakerName: state.residents[0].name, targetName: state.residents[1].name, text: "一起去花园吧！", audioKey: "conv:r0:line-1" },
  ];

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    residentConversation: {
      enabled: true,
      status: "playing",
      queue,
      currentIndex: 0,
      currentLineId: "line-1",
      visibleText: "一起去花园吧！",
      sessionState: {
        participants: [
          { residentId: speakerId, residentName: state.residents[0].name, role: "speaker" },
          { residentId: listenerId, residentName: state.residents[1].name, role: "listener" },
        ],
      },
    },
  });

  const html = root.innerHTML;
  // Conversation bubble class only appears once (on speaker)
  const convBubbleMatches = html.match(/stage-character__dialogue--conversation/g) || [];
  assert(convBubbleMatches.length === 1, "only speaker shows conversation bubble");
}

// ── Test 10e: Conversation idle/completed cleans up speaking/listening/overlay ───────

console.log("\n── Conversation idle/completed: no speaking/listening/overlay ──");
{
  const state = createInitialState();

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    residentConversation: {
      enabled: true,
      status: "idle",
      queue: [],
      currentIndex: 0,
      currentLineId: "",
      visibleText: "",
    },
  });

  const html = root.innerHTML;

  assert(!html.includes("stage-conversation-overlay"), "idle conversation: no stage overlay");
  assert(!html.includes("stage-character--speaking"), "idle conversation: no speaking class");
  assert(!html.includes("stage-character--listening"), "idle conversation: no listening class");

  // Also test completed status
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    residentConversation: {
      enabled: true,
      status: "completed",
      queue: [],
      currentIndex: 0,
      currentLineId: "",
      visibleText: "",
    },
  });

  const html2 = root.innerHTML;
  assert(!html2.includes("stage-conversation-overlay"), "completed conversation: no stage overlay");
  assert(!html2.includes("stage-character--speaking"), "completed conversation: no speaking class");
  assert(!html2.includes("stage-character--listening"), "completed conversation: no listening class");
}

// ── Test 10f: Place marker sanitizes anthropomorphic labels ─────────────────────────

console.log("\n── sanitizePlaceMarkerLabel: sanitizes anthropomorphic labels ──");
{
  const { sanitizePlaceMarkerLabel } = await import("../src/ui/render.js");

  // Anthropomorphic labels get sanitized to fallback
  const cases = [
    { label: "广场回应：明白了。", place: "广场", expectContains: "留下了新的变化" },
    { label: "花园说：好的。", place: "花园", expectContains: "留下了新的变化" },
    { label: "森林表示：知道了。", place: "森林", expectContains: "留下了新的变化" },
    { label: "广场回应明白了", place: "广场", expectContains: "留下了新的变化" },
    { label: "花园想到了一个主意", place: "花园", expectContains: "留下了新的变化" },
    // Normal labels are preserved
    { label: "花园的气氛变得更热闹", place: "花园", expectContains: "花园的气氛变得更热闹" },
    { label: "", place: "广场", expectContains: "广场留下了新的变化" },
  ];

  for (const c of cases) {
    const result = sanitizePlaceMarkerLabel(c.label, c.place);
    assert(result.includes(c.expectContains),
      `sanitizePlaceMarkerLabel("${c.label}", "${c.place}") contains "${c.expectContains}" (got: "${result}")`);
  }

  // Specifically check forbidden patterns don't appear
  const forbidden = [
    ["广场回应：明白了。", "广场"],
    ["花园说：好的。", "花园"],
    ["森林表示：知道了。", "森林"],
  ];
  for (const [label, place] of forbidden) {
    const result = sanitizePlaceMarkerLabel(label, place);
    assert(!result.includes("回应") && !result.includes("说") && !result.includes("表示"),
      `sanitizePlaceMarkerLabel("${label}", "${place}") = "${result}" — no speech verbs`);
  }
}

// ── Test 10fa: sanitizeChoiceReactionLabel prevents place-personification ──────────

console.log("\n── sanitizeChoiceReactionLabel: prevents place-personification ──");
{
  const { sanitizeChoiceReactionLabel } = await import("../src/ui/render.js");

  // Forbidden: place + speech verb
  const placeSpeechCases = [
    ["广场回应：明白了。", "老周", "广场"],
    ["花园说：好的。", "小花", "花园"],
    ["森林表示：知道了。", "阿远", "森林"],
    ["餐厅回应明白了。", "米米", "餐厅"],
  ];
  for (const [label, resident, place] of placeSpeechCases) {
    const result = sanitizeChoiceReactionLabel(label, resident, place);
    assert(!result.includes("回应") && !result.includes("说") && !result.includes("表示"),
      `sanitizeChoiceReactionLabel("${label}", "${resident}", "${place}") — no speech verbs`);
    assert(result.includes(resident) && result.includes("注意到了变化"),
      `sanitizeChoiceReactionLabel result is neutral: "${result}"`);
  }

  // Forbidden: generic reactions → neutral fallback
  const genericCases = [
    ["明白了。", "老周"],
    ["好的。", "小花"],
    ["知道了", "阿远"],
    ["收到。", "米米"],
    ["嗯", "小七"],
    ["好！", "居民"],
  ];
  for (const [label, resident] of genericCases) {
    const result = sanitizeChoiceReactionLabel(label, resident, "广场");
    assert(result === `${resident}注意到了变化`,
      `generic reaction "${label}" → "${result}"`);
  }

  // Safe: non-generic preserved
  const safeCases = [
    ["老周记住了这次选择", "老周"],
    ["小花对这个决定很满意", "小花"],
  ];
  for (const [label, resident] of safeCases) {
    const result = sanitizeChoiceReactionLabel(label, resident, "广场");
    assert(result === label, `safe label preserved: "${result}"`);
  }
}

// ── Test 10fb: choiceReactionBubble does not show place-personification ────────────

console.log("\n── choiceReactionBubble: no place-personification in rendered HTML ──");
{
  // Build a minimal state + uiState with choiceAftermath
  const { createInitialState } = await import("../src/domain/state.js");
  const state = createInitialState();
  const residentId = state.residents[0].id;
  const residentName = state.residents[0].name;

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    choiceAftermath: {
      id: "choice-test",
      eventId: "event-test",
      choiceId: "choice-a",
      placeId: "plaza",
      choiceLabel: "送去花园给小花看看",
      summary: "老周把相框带到花园，小花一眼认出这片叶子，正是第一天她种下的那株。",
      residentReactions: [
        { residentId, residentName, reaction: "明白了。" },
      ],
      createdAt: Date.now(),
    },
  });

  const html = root.innerHTML;

  // Must not contain place-personification patterns
  assert(!html.includes("广场回应"), "stage does not show '广场回应'");
  assert(!html.includes("花园回应"), "stage does not show '花园回应'");
  assert(!html.includes("森林表示"), "stage does not show '森林表示'");
  assert(!html.includes("广场说"), "stage does not show '广场说'");
  assert(!html.includes("广场：明白了"), "stage does not show '广场：明白了'");
  assert(!html.includes("广场回应：明白了"), "stage does not show '广场回应：明白了'");

  // Must contain safe expressions
  assert(
    html.includes("注意到了变化") || html.includes(residentName),
    `stage shows safe expression (resident name or neutral label)`
  );
}

// ── Test 10g: Place marker hidden during conversation ─────────────────────────────

console.log("\n── Conversation active: hides place choice marker ──");
{
  const state = createInitialState();
  const speakerId = state.residents[0].id;
  const listenerId = state.residents[1].id;
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    residentConversation: {
      enabled: true,
      status: "playing",
      queue: [
        { id: "line-1", speakerId, targetId: listenerId, speakerName: state.residents[0].name, targetName: state.residents[1].name, text: "今天天气真好。", audioKey: "conv:r0:line-1" },
      ],
      currentIndex: 0,
      currentLineId: "line-1",
      visibleText: "今天天气真好。",
      sessionState: {
        participants: [
          { residentId: speakerId, residentName: state.residents[0].name, role: "speaker" },
          { residentId: listenerId, residentName: state.residents[1].name, role: "listener" },
        ],
      },
    },
    // Note: choiceWorldEffect is NOT passed here - during conversation it should be suppressed anyway
  });

  const html = root.innerHTML;
  assert(!html.includes("stage-choice-marker"), "conversation suppresses choice world marker");
}

// ── Test 10i: Conversation generating/loading shows overlay immediately ─────────────────────

console.log("\n── Conversation generating: shows stage overlay immediately ──");
{
  const state = createInitialState();
  const speakerId = state.residents[0].id;
  const listenerId = state.residents[1].id;
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    residentConversation: {
      enabled: true,
      status: "generating",
      queue: [
        { id: "line-1", speakerId, targetId: listenerId, speakerName: "阿远", targetName: "小花", text: "小花，今天有什么计划吗？", audioKey: "conv:r0:line-1" },
      ],
      currentIndex: 0,
      currentLineId: "line-1",
      visibleText: "",
      sessionState: {
        participants: [
          { residentId: speakerId, residentName: "阿远", role: "speaker" },
          { residentId: listenerId, residentName: "小花", role: "listener" },
        ],
      },
    },
  });

  const html = root.innerHTML;
  assert(html.includes("stage-conversation-overlay"), "generating conversation shows stage overlay");
  assert(html.includes("小花，今天有什么计划吗？"), "generating conversation shows current line text");
  assert(!html.includes("正在播放"), "generating conversation does not show global playing text");
}

// ── Test 10j: Opening question appears before answer in queue ─────────────────────────

console.log("\n── Conversation queue: question queued before answer renders correctly ──");
{
  const state = createInitialState();
  const speakerId = state.residents[0].id;
  const listenerId = state.residents[1].id;
  // Use currentIndex=1 (answer current): answer in overlay, question in panel
  // This means the conversation has progressed to the second line
  root.innerHTML = "";
  renderApp(root, state, handlers, {
    residentConversation: {
      enabled: true,
      status: "playing",
      queue: [
        { id: "line-1", speakerId, targetId: listenerId, speakerName: "小花", targetName: "阿远", text: "小花，今天有什么计划吗？", audioKey: "conv:r0:line-1" },
        { id: "line-2", speakerId: listenerId, targetId: speakerId, speakerName: "阿远", targetName: "小花", text: "想去花园那边看看。", audioKey: "conv:r1:line-2" },
      ],
      currentIndex: 1,  // Answer is current (overlay), question is past (panel)
      currentLineId: "line-2",
      visibleText: "想去花园那边看看。",
      sessionState: {
        participants: [
          { residentId: speakerId, residentName: "小花", role: "speaker" },
          { residentId: listenerId, residentName: "阿远", role: "listener" },
        ],
      },
    },
  });

  const html = root.innerHTML;
  // Question should appear in the right panel's dialogue-beats-list
  const questionInPanel = html.includes("今天有什么计划吗？");
  assert(questionInPanel, "question line appears in right panel (as past line)");
  // The answer is in the overlay, not panel; question in panel is correct temporal order
  // We verify queue is ordered [question, answer] by checking both texts appear
  assert(html.includes("想去花园那边看看。"), "answer line appears (in overlay)");
}

// ── Test 11: Broadcast audio still shows global playback chip ─────────────────────

console.log("\n── Broadcast: still shows global playback chip ──");
{
  const state = createInitialState();

  root.innerHTML = "";
  renderApp(root, state, handlers, {
    currentVoicePlayback: {
      key: "minimax-broadcast",
      provider: "minimax",
      scene: "town_broadcast",
      sourceType: "town_broadcast",
      title: "小镇广播",
      subtitle: "",
      textPreview: "早安，小镇！",
      status: "playing",
    },
  });

  const html = root.innerHTML;

  // Broadcast must still show the global chip
  assert(html.includes("voice-playback-chip"), "broadcast still renders global voice playback chip");
  assert(html.includes("voice-playback-chip--playing"), "broadcast chip has playing state class");
}

// ── Test 13: Source-level check for hide option in updateVoicePlaybackDomStatus ─

console.log("\n── Source check: updateVoicePlaybackDomStatus supports hide option ──");
{
  const fs = await import("fs");
  const appSource = fs.readFileSync("./src/app.js", "utf8");
  const hasHideSupport = appSource.includes("options.hide");
  assert(hasHideSupport, "updateVoicePlaybackDomStatus handles options.hide");
  const hasConversationHide = appSource.includes('updateConversationAudioDomState(audioKey, "idle", { hide: true })');
  assert(hasConversationHide, "conversation audio ended calls updateConversationAudioDomState with { hide: true }");
}

// ── Test 14: buildWorkbenchMode exists and is pure UI function ─────────────────

console.log("\n── Source check: buildWorkbenchMode is defined in render.js ──");
{
  const fs = await import("fs");
  const renderSource = fs.readFileSync("./src/ui/render.js", "utf8");
  const hasBuildWorkbenchMode = renderSource.includes("function buildWorkbenchMode");
  assert(hasBuildWorkbenchMode, "buildWorkbenchMode function is defined");
  const hasModeValues = renderSource.includes('mode: "conversation"') && renderSource.includes('mode: "task-animation"');
  assert(hasModeValues, "buildWorkbenchMode returns correct mode values");
  const hasSuppressFlags = renderSource.includes("suppressResidentFocus: true");
  assert(hasSuppressFlags, "buildWorkbenchMode returns suppress flags");
}

// ── Test 15: buildVoicePlaybackView returns visible:false for conversation ──────

console.log("\n── Source check: buildVoicePlaybackView suppresses conversation chip ──");
{
  const fs = await import("fs");
  const renderSource = fs.readFileSync("./src/ui/render.js", "utf8");
  const hasConversationGuard = renderSource.includes("isConversation") && renderSource.includes('visible: false');
  assert(hasConversationGuard, "buildVoicePlaybackView returns visible:false for conversation");
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
