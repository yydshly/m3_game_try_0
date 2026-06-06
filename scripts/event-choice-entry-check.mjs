// event-choice-entry-check — validates buildEventChoiceEntryView and the Event Director card
// Tests: view model states, choice rendering, no M3 endpoint changes

import { createInitialState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";
import { buildEventChoiceEntryView } from "../src/ui/render.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); }
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
}

// ── Test data helpers ─────────────────────────────────────────────────────────

function makeStateWithEvent(eventOverrides = {}, choiceOverrides = []) {
  const state = advancePhase(advancePhase(advancePhase(createInitialState())));
  return {
    ...state,
    events: [
      ...state.events,
      {
        id: "test-event-1",
        type: "m3-event",
        day: 2,
        phase: "下午",
        title: "森林边的风铃声",
        text: "小七在森林边听到风铃声，发现一只迷路的小猫躲在树下。",
        tone: "cozy",
        residentIds: ["seven", "zhou"],
        placeId: "forest",
        choices: choiceOverrides.length > 0 ? choiceOverrides : [
          { id: "care_cat", label: "让小七先照顾小猫", preview: "小七会很开心。", resultText: "小七把小猫抱到餐厅门口。" },
          { id: "ask_zhou", label: "让老周去广场询问", preview: "老周会把消息告诉更多居民。", resultText: "老周在广场贴出寻主启事。" },
        ],
        chosenChoiceId: null,
        choiceResultText: null,
        ...eventOverrides,
      },
    ],
  };
}

const noopUiState = {
  llmStatus: "idle",
  eventDirectorStatus: "idle",
  eventDirectorMessage: "",
  latestBroadcast: null,
  broadcastStatus: "idle",
  residentConversation: { enabled: false, status: "idle" },
  choiceAftermath: null,
};

// ── Test 1: empty state → empty status ──────────────────────────────────────
console.log("\n── buildEventChoiceEntryView: empty state ──");
{
  const state = createInitialState();
  const view = buildEventChoiceEntryView(state, noopUiState);
  assert(view.visible === true, "visible is true");
  assert(view.status === "empty", "status is 'empty'");
  assert(view.eventId === null, "eventId is null");
  assert(view.choices.length === 0, "choices is empty array");
}

// ── Test 2: m3-event without choices → empty status ──────────────────────────
console.log("\n── buildEventChoiceEntryView: event without choices ──");
{
  const state = advancePhase(advancePhase(advancePhase(createInitialState())));
  const eventState = {
    ...state,
    events: [
      ...state.events,
      {
        id: "event-no-choices",
        type: "m3-event",
        day: 2,
        phase: "晚上",
        title: "花园里传来笑声",
        text: "小花和阿远在花园里聊天。",
        tone: "social",
        residentIds: ["hua", "yuan"],
        placeId: "garden",
        // no choices field
      },
    ],
  };
  const view = buildEventChoiceEntryView(eventState, noopUiState);
  assert(view.status === "empty", "status is 'empty' for event without choices");
}

// ── Test 3: m3-event with choices (unchosen) → ready status ─────────────────
console.log("\n── buildEventChoiceEntryView: ready status ──");
{
  const state = makeStateWithEvent();
  const view = buildEventChoiceEntryView(state, noopUiState);
  assert(view.visible === true, "visible is true");
  assert(view.status === "ready", "status is 'ready'");
  assert(view.eventId === "test-event-1", "eventId is set");
  assert(view.title === "森林边的风铃声", "title is correct");
  assert(view.summary === "小七在森林边听到风铃声，发现一只迷路的小猫躲在树下。", "summary is correct");
  assert(view.placeLabel === "森林", "placeLabel is '森林'");
  assert(Array.isArray(view.residentNames), "residentNames is array");
  assert(view.residentNames.includes("小七") || view.residentNames.includes("seven"), "residentNames includes participant");
  assert(view.choices.length === 2, "choices has 2 items");
  assert(view.chosenChoiceLabel === "", "chosenChoiceLabel is empty");
  assert(view.resultText === "", "resultText is empty");
}

// ── Test 4: ready status has at most 3 choices ──────────────────────────────
console.log("\n── buildEventChoiceEntryView: max 3 choices ──");
{
  const state = makeStateWithEvent({}, [
    { id: "a", label: "选项A", preview: "提示A", resultText: "结果A" },
    { id: "b", label: "选项B", preview: "提示B", resultText: "结果B" },
    { id: "c", label: "选项C", preview: "提示C", resultText: "结果C" },
    { id: "d", label: "选项D", preview: "提示D", resultText: "结果D" },
    { id: "e", label: "选项E", preview: "提示E", resultText: "结果E" },
  ]);
  const view = buildEventChoiceEntryView(state, noopUiState);
  assert(view.choices.length <= 3, `choices limited to 3 (got ${view.choices.length})`);
}

// ── Test 5: chosen event → chosen status ─────────────────────────────────────
console.log("\n── buildEventChoiceEntryView: chosen status ──");
{
  const state = makeStateWithEvent({ chosenChoiceId: "care_cat" });
  const view = buildEventChoiceEntryView(state, noopUiState);
  assert(view.status === "chosen", "status is 'chosen'");
  assert(view.chosenChoiceLabel === "让小七先照顾小猫", "chosenChoiceLabel is correct");
  assert(view.resultText === "小七把小猫抱到餐厅门口。", "resultText is correct");
  assert(view.memoryHint.includes("小镇记住"), "memoryHint is present");
  assert(view.choices.length === 0, "choices is empty when already chosen");
}

// ── Test 6: place names are mapped correctly ─────────────────────────────────
console.log("\n── buildEventChoiceEntryView: place name mapping ──");
{
  for (const [placeId, expectedLabel] of [
    ["garden", "花园"], ["cafe", "餐厅"], ["workshop", "工坊"],
    ["plaza", "广场"], ["forest", "森林"],
  ]) {
    const state = makeStateWithEvent({ placeId });
    const view = buildEventChoiceEntryView(state, noopUiState);
    assert(view.placeLabel === expectedLabel, `placeId '${placeId}' → '${expectedLabel}'`);
  }
}

// ── Test 7: choice button structure ───────────────────────────────────────────
console.log("\n── buildEventChoiceEntryView: choice structure ──");
{
  const state = makeStateWithEvent({}, [
    { id: "choice_x", label: "选项X", preview: "提示X", resultText: "结果X" },
  ]);
  const view = buildEventChoiceEntryView(state, noopUiState);
  const choice = view.choices[0];
  assert(choice.id === "choice_x", "choice.id is correct");
  assert(choice.label === "选项X", "choice.label is correct");
  assert(choice.preview === "提示X", "choice.preview is correct");
}

// ── Test 8: no reverse find scattered in render ────────────────────────────
console.log("\n── No scattered event find in render.js ──");
{
  const fs = await import("fs");
  const renderContent = fs.readFileSync("./src/ui/render.js", "utf8");
  // After our changes, find logic should only be in buildEventChoiceEntryView
  const renderFn = renderContent.split("function renderEventDirectorStatus")[1]?.split("\n}")?.[0] ?? "";
  const hasFindInRender = /events\.find|\.find\(.*event/.test(renderFn);
  assert(!hasFindInRender, "renderEventDirectorStatus does not contain scattered .find() for events");
}

// ── Results ───────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll event-choice-entry checks passed!");
