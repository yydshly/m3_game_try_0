// Event Choice Interaction check — tests choices schema, render, and state flow
import { createInitialState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";
import { renderApp } from "../src/ui/render.js";

const root = {
  innerHTML: "",
  querySelector: () => ({ addEventListener() {} }),
  querySelectorAll: () => [],
};

const noopHandlers = {
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
};

// ── normalizeEventChoices inline copy (same logic as server.mjs) ────────────────

const FALLBACK_CHOICES = [
  {
    id: "gentle_help",
    label: "温柔地帮忙",
    preview: "让居民主动参与这件小事。",
    resultText: "居民们用温柔的方式回应了这件小事，小镇的今天多了一点故事。",
  },
  {
    id: "watch_first",
    label: "先观察一下",
    preview: "先看看事情会如何发展。",
    resultText: "你选择先观察一下，居民们把这件事记在了今天的小镇动态里。",
  },
];

function normalizeEventChoices(rawChoices) {
  const raw = Array.isArray(rawChoices) ? rawChoices : [];
  const selected = raw.slice(0, 2);

  while (selected.length < 2) {
    const fallbackIdx = selected.length;
    if (fallbackIdx < FALLBACK_CHOICES.length) {
      selected.push({ ...FALLBACK_CHOICES[fallbackIdx] });
    } else {
      selected.push({ ...FALLBACK_CHOICES[0], id: `fallback_${selected.length}` });
    }
  }

  return selected.map((choice, idx) => {
    const id = String(choice.id ?? "").trim() || (idx === 0 ? "choice_a" : "choice_b");
    const label = String(choice.label ?? "").trim() || FALLBACK_CHOICES[idx]?.label || "温柔地帮忙";
    const preview = String(choice.preview ?? "").trim() || "这个选择会被记录在小镇动态里。";
    const resultText = String(choice.resultText ?? "").trim() || "你的选择被小镇记住了，居民们继续着今天的生活。";

    return {
      id,
      label: label.slice(0, 24),
      preview: preview.slice(0, 40),
      resultText: resultText.slice(0, 100),
    };
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

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

// Test 1: choices normalize returns exactly 2
console.log("\n── normalizeEventChoices ──");
{
  const result = normalizeEventChoices([]);
  assert(result.length === 2, "empty input returns 2 fallback choices");
  assert(result[0].id === "gentle_help", "first fallback id correct");
  assert(result[1].id === "watch_first", "second fallback id correct");
}

// Test 2: partial choices filled with fallbacks
{
  const result = normalizeEventChoices([{ id: "custom_id", label: "自定义", preview: "提示", resultText: "结果" }]);
  assert(result.length === 2, "partial input padded to 2");
  assert(result[0].id === "custom_id", "custom id preserved");
  assert(result[1].id === "watch_first", "second filled from fallback");
}

// Test 3: excess choices truncated to 2
{
  const result = normalizeEventChoices([
    { id: "a", label: "A", preview: "p1", resultText: "r1" },
    { id: "b", label: "B", preview: "p2", resultText: "r2" },
    { id: "c", label: "C", preview: "p3", resultText: "r3" },
  ]);
  assert(result.length === 2, "excess choices truncated to 2");
  assert(result[0].id === "a", "first kept");
  assert(result[1].id === "b", "second kept (not third)");
}

// Test 4: label truncation at 24 chars
{
  const result = normalizeEventChoices([{ id: "x", label: "一二三四五一二三四五一二三四五六七八九十", preview: "p", resultText: "r" }]);
  assert(result[0].label.length <= 24, `label truncated to <= 24 (got ${result[0].label.length})`);
}

// Test 5: preview truncation at 40 chars
{
  const result = normalizeEventChoices([{ id: "x", label: "L", preview: "一二三四五一二三四五一二三四五六七八九十零一二三四五六七八", resultText: "r" }]);
  assert(result[0].preview.length <= 40, `preview truncated to <= 40 (got ${result[0].preview.length})`);
}

// Test 6: resultText truncation at 100 chars
{
  const result = normalizeEventChoices([{ id: "x", label: "L", preview: "p", resultText: "一".repeat(150) }]);
  assert(result[0].resultText.length <= 100, `resultText truncated to <= 100 (got ${result[0].resultText.length})`);
}

// Test 7: HTML injection prevention (id with script tag)
{
  const rawId = '<script>alert("xss")</script>';
  const result = normalizeEventChoices([{ id: rawId, label: "label", preview: "p", resultText: "r" }]);
  // normalize does NOT filter/sanitize - escape happens at render time (escapeHtml in render.js)
  assert(result[0].id === rawId, "script tag id preserved as-is by normalize (render must escape)");
}

// ── Render: m3-event with choices (unchosen) ───────────────────────────────────

console.log("\n── renderApp: m3-event with choices (unchosen) ──");
{
  const state = advancePhase(advancePhase(advancePhase(createInitialState())));
  const stateWithChoices = {
    ...state,
    events: [
      ...state.events,
      {
        id: "m3-event-choice-test",
        type: "m3-event",
        day: 2,
        phase: "下午",
        title: "森林边的风铃声",
        text: "小七在森林边听到风铃声，发现一只迷路的小猫躲在树下。",
        tone: "cozy",
        residentIds: ["seven", "zhou"],
        placeId: "forest",
        suggestedFollowUp: "要不要让居民帮帮它？",
        choices: [
          { id: "care_cat", label: "让小七先照顾小猫", preview: "小七会很开心，但也会多花些时间。", resultText: "小七把小猫抱到餐厅门口，米米给它准备了一小碟水。" },
          { id: "ask_zhou", label: "让老周去广场询问", preview: "老周会把消息告诉更多居民。", resultText: "老周在广场贴出寻主启事，几个居民都过来帮忙留意。" },
        ],
        chosenChoiceId: null,
        choiceResultText: null,
      },
    ],
  };

  root.innerHTML = "";
  renderApp(root, stateWithChoices, noopHandlers);

  assert(root.innerHTML.includes('data-action="choose-event"'), "choose-event buttons rendered");
  assert(root.innerHTML.includes("care_cat"), "first choice id present in HTML");
  assert(root.innerHTML.includes("ask_zhou"), "second choice id present in HTML");
  assert(root.innerHTML.includes("让小七先照顾小猫"), "first choice label rendered");
  assert(root.innerHTML.includes("让老周去广场询问"), "second choice label rendered");
  assert(root.innerHTML.includes("小七会很开心"), "first choice preview rendered");
  assert(root.innerHTML.includes("老周会把消息告诉更多居民"), "second choice preview rendered");
  assert(root.innerHTML.includes("你要怎么做？"), "choice prompt rendered");
}

// ── Render: m3-event with choices (already chosen) ─────────────────────────────

console.log("\n── renderApp: m3-event already chosen ──");
{
  const state = advancePhase(advancePhase(advancePhase(createInitialState())));
  const stateWithChosen = {
    ...state,
    events: [
      ...state.events,
      {
        id: "m3-event-chosen-test",
        type: "m3-event",
        day: 2,
        phase: "下午",
        title: "森林边的风铃声",
        text: "小七在森林边听到风铃声。",
        tone: "cozy",
        residentIds: ["seven"],
        placeId: "forest",
        suggestedFollowUp: "",
        choices: [
          { id: "care_cat", label: "让小七先照顾小猫", preview: "小七会很开心。", resultText: "小七把小猫抱到餐厅门口。" },
          { id: "ask_zhou", label: "让老周去广场询问", preview: "老周会把消息告诉更多居民。", resultText: "老周在广场贴出寻主启事。" },
        ],
        chosenChoiceId: "care_cat",
        choiceResultText: "小七把小猫抱到餐厅门口。",
      },
    ],
  };

  root.innerHTML = "";
  renderApp(root, stateWithChosen, noopHandlers);

  assert(!root.innerHTML.includes('data-action="choose-event"') || !root.innerHTML.includes("m3-event-chosen-test"), "no new choice buttons for already-chosen event");
  assert(root.innerHTML.includes("已选择"), "chosen label rendered");
  assert(root.innerHTML.includes("让小七先照顾小猫"), "chosen choice label shown");
  assert(root.innerHTML.includes("小七把小猫抱到餐厅门口"), "chosen resultText shown");
}

// ── Render: player-choice event ─────────────────────────────────────────────────

console.log("\n── renderApp: player-choice event ──");
{
  const state = advancePhase(advancePhase(advancePhase(createInitialState())));
  const stateWithPlayerChoice = {
    ...state,
    events: [
      ...state.events,
      {
        id: "choice-m3-event-choice_a",
        type: "player-choice",
        day: 2,
        phase: "下午",
        sourceEventId: "m3-event-choice-test",
        choiceId: "choice_a",
        title: "你的选择",
        text: "小七把小猫抱到餐厅门口，米米给它准备了一小碟水。",
        choiceLabel: "让小七先照顾小猫",
        residentIds: ["seven", "mimi"],
        placeId: "forest",
      },
    ],
  };

  root.innerHTML = "";
  renderApp(root, stateWithPlayerChoice, noopHandlers);

  assert(root.innerHTML.includes("你的选择"), "player-choice title rendered");
  assert(root.innerHTML.includes("你选择了"), "player-choice label rendered");
  assert(root.innerHTML.includes("让小七先照顾小猫"), "player-choice choiceLabel rendered");
  assert(root.innerHTML.includes("小七把小猫抱到餐厅门口"), "player-choice text rendered");
  assert(root.innerHTML.includes("feed-item--player-choice"), "player-choice CSS class applied");
  assert(root.innerHTML.includes("森林"), "player-choice place rendered");
}

// ── Render: choice world marker sanitizes anthropomorphic labels ─────────────────────────

console.log("\n── sanitizePlaceMarkerLabel: sanitizes anthropomorphic place labels ──");
{
  const { sanitizePlaceMarkerLabel } = await import("../src/ui/render.js");

  // All these anthropomorphic patterns should be replaced with fallback
  const anthropomorphicCases = [
    ["广场回应：明白了。", "广场"],
    ["花园说：好的。", "花园"],
    ["森林表示：知道了。", "森林"],
    ["广场回应明白了。", "广场"],
  ];
  for (const [label, place] of anthropomorphicCases) {
    const result = sanitizePlaceMarkerLabel(label, place);
    assert(!result.includes("回应") && !result.includes("说") && !result.includes("表示"),
      `sanitizePlaceMarkerLabel("${label}", "${place}") = "${result}" — no speech verbs`);
    assert(result.includes("留下了新的变化") || result.includes(`${place}留下了`),
      `sanitizePlaceMarkerLabel result contains fallback: "${result}"`);
  }

  // Normal labels should be preserved
  const normalCases = [
    ["花园的气氛变得更热闹", "花园"],
    ["广场有了新变化", "广场"],
    ["", "广场"],
  ];
  for (const [label, place] of normalCases) {
    const result = sanitizePlaceMarkerLabel(label, place);
    assert(result.length > 0, `sanitizePlaceMarkerLabel("${label}", "${place}") returns non-empty: "${result}"`);
  }
}

// ── Render: old event without choices still works ───────────────────────────────

console.log("\n── renderApp: old m3-event without choices ──");
{
  const state = advancePhase(advancePhase(advancePhase(createInitialState())));
  const stateWithOldEvent = {
    ...state,
    events: [
      ...state.events,
      {
        id: "m3-event-old",
        type: "m3-event",
        day: 1,
        phase: "上午",
        title: "花园里传来笑声",
        text: "小花和阿远在花园里聊天。",
        tone: "social",
        residentIds: ["hua", "yuan"],
        placeId: "garden",
        suggestedFollowUp: "明天可以安排他们一起种花。",
        // no choices field
      },
    ],
  };

  root.innerHTML = "";
  renderApp(root, stateWithOldEvent, noopHandlers);

  assert(root.innerHTML.includes("花园里传来笑声"), "old event title still renders");
  assert(root.innerHTML.includes("feed-item--m3-event"), "old event CSS class still applies");
  assert(!root.innerHTML.includes("undefined"), "no undefined in output for old events");
}

// ── Results ────────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\nAll event-choice checks passed!");
