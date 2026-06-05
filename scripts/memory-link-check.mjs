// Memory Link check — tests townMemory, resident memory, and compact state
import { createInitialState, upgradeState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";
import { applyChoiceMemory, createChoiceMemoryEntry, ensureTownMemory, trimMemories } from "../src/domain/memory.js";
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

// ── createInitialState includes townMemory ──────────────────────────────────────

console.log("\n── createInitialState ──");
{
  const state = createInitialState();
  assert(Array.isArray(state.townMemory), "townMemory is an array");
  assert(state.townMemory.length === 0, "townMemory starts empty");
}

// ── upgradeState adds townMemory ─────────────────────────────────────────────────

console.log("\n── upgradeState ──");
{
  const oldState = {
    day: 1,
    phaseIndex: 0,
    town: { comfort: 42, supplies: 8, spirit: 64 },
    residents: [],
    relationships: {},
    events: [],
    reports: [],
    // no townMemory
  };
  const migrated = upgradeState(oldState);
  assert(Array.isArray(migrated.townMemory), "old state upgrade includes townMemory");
  assert(migrated.townMemory.length === 0, "upgraded townMemory is empty");
}

// ── applyChoiceMemory core logic ────────────────────────────────────────────────

console.log("\n── applyChoiceMemory ──");
{
  const state = advancePhase(advancePhase(advancePhase(createInitialState())));
  const currentPhase = { label: "下午" };
  const sourceEvent = {
    id: "m3-event-test-1",
    type: "m3-event",
    day: 2,
    title: "森林边的风铃声",
    residentIds: ["seven", "zhou"],
    placeId: "forest",
    choices: [
      { id: "care_cat", label: "让小七先照顾小猫", resultText: "小七把小猫抱到餐厅门口。" },
      { id: "ask_zhou", label: "让老周去广场询问", resultText: "老周在广场贴出寻主启事。" },
    ],
    chosenChoiceId: null,
  };
  const choice = sourceEvent.choices[0];

  // Inject the event into state so applyChoiceMemory can find it
  const stateWithEvent = {
    ...state,
    events: [...state.events, sourceEvent],
  };

  const next = applyChoiceMemory(stateWithEvent, sourceEvent, choice, currentPhase);

  // source event updated
  const updatedEvent = next.events.find((e) => e.id === sourceEvent.id);
  assert(updatedEvent?.chosenChoiceId === "care_cat", "source event chosenChoiceId set");
  assert(updatedEvent?.choiceResultText === "小七把小猫抱到餐厅门口。", "source event choiceResultText set");

  // player-choice event added
  const playerChoiceEvent = next.events.find((e) => e.type === "player-choice");
  assert(playerChoiceEvent != null, "player-choice event added");
  assert(playerChoiceEvent?.choiceLabel === "让小七先照顾小猫", "player-choice label correct");

  // townMemory updated
  assert(next.townMemory.length === 1, "townMemory has 1 entry");
  assert(next.townMemory[0].type === "player-choice", "townMemory type is player-choice");
  assert(next.townMemory[0].title === "森林边的风铃声", "townMemory title correct");
  assert(next.townMemory[0].choiceId === "care_cat", "townMemory choiceId correct");

  // resident memory updated
  const seven = next.residents.find((r) => r.id === "seven");
  assert(seven?.memory[0]?.includes("让小七先照顾小猫"), "seven resident memory updated");
  const zhou = next.residents.find((r) => r.id === "zhou");
  assert(zhou?.memory[0]?.includes("让老周去广场询问") === false, "zhou resident memory has seven's choice only");

  // unrelated resident not updated
  const hua = next.residents.find((r) => r.id === "hua");
  const huaMemoryUnchanged = hua?.memory[0] === state.residents.find((r) => r.id === "hua")?.memory[0];
  assert(huaMemoryUnchanged, "hua resident memory unchanged");
}

// ── Idempotence: choosing same event again does nothing ─────────────────────────

console.log("\n── idempotence: duplicate choice ignored ──");
{
  const state = advancePhase(advancePhase(advancePhase(createInitialState())));
  const currentPhase = { label: "下午" };
  const sourceEvent = {
    id: "m3-event-idempotent",
    type: "m3-event",
    day: 2,
    title: "测试事件",
    residentIds: ["seven"],
    placeId: "plaza",
    choices: [{ id: "opt_a", label: "选项A", resultText: "结果A" }],
    chosenChoiceId: "opt_a", // already chosen
  };
  const choice = { id: "opt_a", label: "选项A", resultText: "结果A" };

  const next = applyChoiceMemory(state, sourceEvent, choice, currentPhase);

  // Should be unchanged (idempotent)
  const playerChoices = next.events.filter((e) => e.type === "player-choice");
  const originalCount = state.events.length;
  assert(next.events.length === originalCount, "no duplicate event added for already-chosen");
  assert(next.townMemory.length === 0, "no duplicate townMemory added");
}

// ── townMemory cap at 30 ──────────────────────────────────────────────────────

console.log("\n── townMemory cap at 30 ──");
{
  let state = createInitialState();
  // Manually fill townMemory to 29
  state = {
    ...state,
    townMemory: Array.from({ length: 29 }, (_, i) => ({
      id: `mem-${i}`,
      day: 1,
      phase: "早上",
      type: "player-choice",
      title: `记忆 ${i}`,
      text: `文本 ${i}`,
      residentIds: ["hua"],
      placeId: "plaza",
      sourceEventId: `evt-${i}`,
      choiceId: `c-${i}`,
      createdAt: Date.now(),
    })),
  };

  const currentPhase = { label: "晚上" };
  const sourceEvent = {
    id: "m3-event-cap",
    type: "m3-event",
    day: 2,
    title: "第30条记忆",
    residentIds: ["seven"],
    placeId: "plaza",
    choices: [{ id: "c", label: "选", resultText: "结果" }],
  };
  const choice = sourceEvent.choices[0];

  // Inject event into state so applyChoiceMemory can find it
  const stateWithEvent = { ...state, events: [...state.events, sourceEvent] };
  const next = applyChoiceMemory(stateWithEvent, sourceEvent, choice, currentPhase);
  assert(next.townMemory.length === 30, `townMemory capped at 30 (got ${next.townMemory.length})`);
  assert(next.townMemory[29].title === "第30条记忆", "newest memory is last");
}

// ── resident memory cap at 8 ───────────────────────────────────────────────────

console.log("\n── resident memory cap at 8 ──");
{
  let state = createInitialState();
  // Fill seven's memory to 8
  const sevenIdx = state.residents.findIndex((r) => r.id === "seven");
  state.residents[sevenIdx] = {
    ...state.residents[sevenIdx],
    memory: Array.from({ length: 8 }, (_, i) => `旧记忆 ${i}`),
  };

  const currentPhase = { label: "下午" };
  const sourceEvent = {
    id: "m3-event-res-cap",
    type: "m3-event",
    day: 2,
    title: "新事件",
    residentIds: ["seven"],
    placeId: "plaza",
    choices: [{ id: "x", label: "选", resultText: "新记忆内容" }],
  };
  const choice = sourceEvent.choices[0];

  // Inject event into state so applyChoiceMemory can find it
  const stateWithEvent = { ...state, events: [...state.events, sourceEvent] };
  const next = applyChoiceMemory(stateWithEvent, sourceEvent, choice, currentPhase);
  const seven = next.residents.find((r) => r.id === "seven");
  assert(seven?.memory.length === 8, "resident memory capped at 8");
  assert(seven?.memory[0]?.includes("新记忆内容"), "new memory is first");
}

// ── createChoiceMemoryEntry ────────────────────────────────────────────────────

console.log("\n── createChoiceMemoryEntry ──");
{
  const state = advancePhase(createInitialState());
  const sourceEvent = {
    id: "m3-evt-entry",
    title: "花园茶会",
    residentIds: ["hua", "mimi"],
    placeId: "garden",
  };
  const choice = { id: "join_tea", label: "参加茶会", resultText: "大家聊得很开心。" };
  const phase = { label: "下午" };

  const entry = createChoiceMemoryEntry({ state, sourceEvent, choice, currentPhase: phase });

  assert(entry.id === "town-memory-m3-evt-entry-join_tea", "entry id correct");
  assert(entry.day === state.day, "entry day correct");
  assert(entry.phase === "下午", "entry phase correct");
  assert(entry.title === "花园茶会", "entry title correct");
  assert(entry.text.includes("参加茶会"), "entry text includes choice label");
  assert(entry.text.includes("大家聊得很开心"), "entry text includes resultText");
  assert(entry.choiceId === "join_tea", "entry choiceId correct");
  assert(entry.residentIds.includes("hua"), "entry residentIds correct");
}

// ── ensureTownMemory ───────────────────────────────────────────────────────────

console.log("\n── ensureTownMemory ──");
{
  const bad = { townMemory: "not an array" };
  const good = { townMemory: [{ id: "1" }] };
  const result1 = ensureTownMemory(bad);
  const result2 = ensureTownMemory(good);
  assert(Array.isArray(result1.townMemory), "non-array corrected to array");
  assert(result1.townMemory.length === 0, "non-array corrected to empty");
  assert(result2.townMemory.length === 1, "valid array preserved");
}

// ── trimMemories ───────────────────────────────────────────────────────────────

console.log("\n── trimMemories ──");
{
  let state = createInitialState();
  state = {
    ...state,
    townMemory: Array.from({ length: 35 }, (_, i) => ({
      id: `t-${i}`, day: 1, phase: "早上", type: "player-choice",
      title: `t${i}`, text: `t${i}`, residentIds: [], placeId: "plaza",
      sourceEventId: `e${i}`, choiceId: `c${i}`, createdAt: Date.now(),
    })),
  };
  const trimmed = trimMemories(state);
  assert(trimmed.townMemory.length === 30, "trimMemories caps townMemory at 30");

  const overMemResident = {
    ...state.residents[0],
    memory: Array.from({ length: 15 }, (_, i) => `mem${i}`),
  };
  const trimmedResident = trimMemories({
    ...state,
    residents: state.residents.map((r, i) => i === 0 ? overMemResident : r),
  }).residents[0];
  assert(trimmedResident.memory.length === 8, "trimMemories caps resident memory at 8");
}

// ── renderApp: townMemory rendered ───────────────────────────────────────────────

console.log("\n── renderApp: townMemory rendered ──");
{
  const state = advancePhase(advancePhase(advancePhase(createInitialState())));
  const withTownMemory = {
    ...state,
    townMemory: [
      {
        id: "tm-1",
        day: 2,
        phase: "下午",
        type: "player-choice",
        title: "森林边的风铃声",
        text: "玩家选择了「让小七先照顾小猫」。小七把小猫抱到餐厅门口。",
        residentIds: ["seven"],
        placeId: "forest",
        sourceEventId: "m3-evt-1",
        choiceId: "care_cat",
        createdAt: Date.now(),
      },
    ],
  };

  root.innerHTML = "";
  renderApp(root, withTownMemory, noopHandlers);

  assert(root.innerHTML.includes("🧠 小镇记忆"), "town memory header rendered");
  assert(root.innerHTML.includes("森林边的风铃声"), "town memory title rendered");
  assert(root.innerHTML.includes("玩家选择了"), "town memory text rendered");
  assert(root.innerHTML.includes("第 2 天"), "town memory day rendered");
}

// ── renderApp: empty townMemory shows placeholder ────────────────────────────────

console.log("\n── renderApp: empty townMemory placeholder ──");
{
  const state = advancePhase(advancePhase(createInitialState()));
  // townMemory is empty by default on fresh state
  root.innerHTML = "";
  renderApp(root, state, noopHandlers);

  assert(root.innerHTML.includes("🧠 小镇记忆"), "town memory header rendered");
  assert(root.innerHTML.includes("小镇还没有留下重要记忆"), "empty state placeholder shown");
}

// ── renderApp: resident memory updated after choice ─────────────────────────────

console.log("\n── renderApp: resident memory after choice ──");
{
  const state = advancePhase(advancePhase(advancePhase(createInitialState())));
  const currentPhase = { label: "下午" };
  const sourceEvent = {
    id: "m3-evt-res-mem",
    type: "m3-event",
    day: 2,
    title: "花园茶会",
    residentIds: ["hua"],
    placeId: "garden",
    choices: [{ id: "join", label: "参加茶会", resultText: "大家聊得很开心。" }],
  };
  const choice = sourceEvent.choices[0];

  const stateWithEvent = { ...state, events: [...state.events, sourceEvent] };
  const next = applyChoiceMemory(stateWithEvent, sourceEvent, choice, currentPhase);

  root.innerHTML = "";
  renderApp(root, next, noopHandlers);

  // Resident memory text includes the full narrative
  const expectedMemory = "玩家在「花园茶会」中选择了「参加茶会」";
  assert(root.innerHTML.includes(expectedMemory), "resident memory full text appears in UI");
}

// ── Results ────────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\nAll memory-link checks passed!");
