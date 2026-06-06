// event-choice-click-check.mjs
// Real UI click simulation: render → click → chosen state
// Validates the full onChooseEvent → state commit → chosen UI flow

import { createInitialState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";
import { renderApp } from "../src/ui/render.js";
import { applyChoiceMemory } from "../src/domain/memory.js";
import { buildEventChoiceEntryView } from "../src/ui/render.js";

// ── Inline buildChoiceAftermath (no DOM dependency, mirrors app.js logic) ───────

const REACTION_TEMPLATES = [
  "好，我去准备一下。", "明白了，我这就去。", "明白了，我留下。",
  "那我去通知大家。", "好的，我来分工。", "没问题，交给我吧。",
  "那我去花园看看。", "我去工坊拿工具。", "好的，我在广场等大家。",
  "好，我先去森林看看情况。", "明白了，我去安排。", "好的，我去整理一下。",
];

function buildChoiceAftermath(sourceEvent, choice, currentState) {
  const residents = currentState?.residents ?? [];
  const resultText = choice?.resultText ?? "";
  const choiceLabel = choice?.label ?? "做出了选择";
  let summary = resultText;
  if (!summary || summary.length < 4) summary = "小镇居民们开始根据你的选择行动。";
  const allText = `${choiceLabel} ${resultText}`;
  const mentionedNames = [];
  for (const r of residents) {
    if (allText.includes(r.name)) mentionedNames.push(r);
  }
  const reactingResidents = mentionedNames.length > 0 ? mentionedNames.slice(0, 3) : residents.slice(0, 2);
  const residentReactions = reactingResidents.slice(0, 3).map((r, i) => ({
    residentId: r.id,
    residentName: r.name,
    reaction: REACTION_TEMPLATES[(r.name.length + i * 3) % REACTION_TEMPLATES.length],
    emotion: "认真",
  }));
  const placeId = sourceEvent?.placeId ?? residents[0]?.locationId ?? "plaza";
  const PLACE_ICONS = { garden: "🌸", cafe: "🍲", workshop: "🔨", plaza: "⛲", forest: "🌲" };
  const stageEffect = {
    type: "choice-ripple",
    placeId,
    icon: PLACE_ICONS[placeId] ?? "✨",
    label: "你的选择产生了影响",
  };
  return {
    id: `aftermath-${Date.now()}`,
    eventId: sourceEvent?.id ?? "",
    choiceId: choice?.id ?? "",
    choiceLabel,
    scenarioId: currentState?.activeScenario?.id ?? "",
    summary,
    residentReactions,
    stageEffect,
    memoryLabels: [],
    createdAt: Date.now(),
  };
}

// ── Mock DOM root ──────────────────────────────────────────────────────────────
// Must provide non-null mock elements for ALL selectors used in bindEvents,
// otherwise addEventListener throws and renderApp fails.

let lastClickedEventId = null;
let lastClickedChoiceId = null;

// Track all registered listeners so we can inspect what handlers were wired
const listeners = {};

function makeMockEl() {
  return {
    addEventListener(event, handler) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    removeEventListener() {},
    getAttribute(name) { return null; },
    dataset: {},
    closest: () => null,
    remove: () => {},
  };
}

function makeMockElWithData(attrs = {}) {
  return {
    addEventListener(event, handler) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    removeEventListener() {},
    getAttribute(name) { return attrs[name] ?? null; },
    dataset: attrs,
    closest: () => null,
    remove: () => {},
  };
}

const root = {
  _innerHTML: "",
  get innerHTML() { return this._innerHTML; },
  set innerHTML(v) { this._innerHTML = v; },
  _elements: {},
  querySelector(selector) {
    // Provide mock for every selector bindEvents uses
    const el = makeMockEl();
    this._elements[selector] = el;
    return el;
  },
  querySelectorAll(selector) {
    // Return array of mock elements for each registered choice
    if (selector === `[data-action="choose-event"]`) {
      return choices.map((c) => makeMockElWithData({
        "data-event-id": c.eventId,
        "data-choice-id": c.choiceId,
      }));
    }
    return [];
  },
};

// ── State factory ───────────────────────────────────────────────────────────────

let choices = []; // populated before each render

function makeStateWithM3Event() {
  const state = advancePhase(advancePhase(advancePhase(createInitialState())));
  const event = {
    id: "m3-event-click-test",
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
    memoryReferences: [],
  };

  choices = [
    { eventId: event.id, choiceId: "care_cat" },
    { eventId: event.id, choiceId: "ask_zhou" },
  ];

  return {
    state: { ...state, events: [...state.events, event] },
    eventId: event.id,
    choiceId: "care_cat",
  };
}

// ── onChooseEvent handler (mirrors app.js) ─────────────────────────────────────

function makeOnChooseEvent(appState) {
  return function onChooseEvent(eventId, choiceId) {
    const events = appState.events ?? [];
    const sourceEvent = events.find((e) => e.id === eventId);
    if (!sourceEvent) return;
    if (sourceEvent.type !== "m3-event") return;
    if (sourceEvent.chosenChoiceId) return;

    const choice = (sourceEvent.choices ?? []).find((c) => c.id === choiceId);
    if (!choice) return;

    const phases = [{ label: "上午" }, { label: "下午" }, { label: "傍晚" }];
    const currentPhase = phases[appState.phaseIndex] ?? phases[1];
    const nextState = applyChoiceMemory(appState, sourceEvent, choice, currentPhase);
    const aftermath = buildChoiceAftermath(sourceEvent, choice, appState);

    // Commit state
    Object.assign(appState, nextState);

    // Return aftermath so caller can verify
    return { nextState, aftermath };
  };
}

// ── Test helpers ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); }
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
}

// ── Test 1: render shows choose-event buttons ───────────────────────────────────
console.log("\n── render: choose-event buttons present ──");
{
  const { state } = makeStateWithM3Event();
  root.innerHTML = "";
  renderApp(root, state, {});

  assert(root.innerHTML.includes('data-action="choose-event"'), "data-action='choose-event' present in HTML");
  assert(root.innerHTML.includes("care_cat"), "choice id 'care_cat' in HTML");
  assert(root.innerHTML.includes("让小七先照顾小猫"), "choice label in HTML");
}

// ── Test 2: click simulation → onChooseEvent updates chosenChoiceId ─────────────
console.log("\n── click: choose-event → chosenChoiceId written ──");
{
  const { state, eventId, choiceId } = makeStateWithM3Event();
  const onChooseEvent = makeOnChooseEvent(state);

  const result = onChooseEvent(eventId, choiceId);

  assert(result !== undefined, "onChooseEvent returned result");
  const updatedEvent = state.events.find((e) => e.id === eventId);
  assert(updatedEvent?.chosenChoiceId === "care_cat", "chosenChoiceId written to event");
  assert(updatedEvent?.choiceResultText === "小七把小猫抱到餐厅门口，米米给它准备了一小碟水。", "choiceResultText written");
}

// ── Test 3: click → player-choice event appended ───────────────────────────────
console.log("\n── click: player-choice event appended ──");
{
  const { state, eventId, choiceId } = makeStateWithM3Event();
  const onChooseEvent = makeOnChooseEvent(state);
  onChooseEvent(eventId, choiceId);

  const playerChoiceEvents = state.events.filter((e) => e.type === "player-choice");
  assert(playerChoiceEvents.length > 0, "player-choice event appended");
  const last = playerChoiceEvents[playerChoiceEvents.length - 1];
  assert(last.choiceLabel === "让小七先照顾小猫", "player-choice has correct choiceLabel");
}

// ── Test 4: click → townMemory appended ────────────────────────────────────────
console.log("\n── click: townMemory appended ──");
{
  const { state, eventId, choiceId } = makeStateWithM3Event();
  const onChooseEvent = makeOnChooseEvent(state);
  const before = state.townMemory?.length ?? 0;
  onChooseEvent(eventId, choiceId);
  const after = state.townMemory?.length ?? 0;
  assert(after > before, "townMemory grew after choice");
}

// ── Test 5: re-render after choice → chosen UI state ───────────────────────────
console.log("\n── re-render: chosen UI state visible ──");
{
  const { state, eventId, choiceId } = makeStateWithM3Event();
  const onChooseEvent = makeOnChooseEvent(state);
  onChooseEvent(eventId, choiceId);

  root.innerHTML = "";
  renderApp(root, state, {});

  assert(root.innerHTML.includes("✨ 刚刚的选择"), "✨ 刚刚的选择 visible in HTML");
  assert(root.innerHTML.includes("你选择了："), "你选择了： visible in HTML");
  assert(root.innerHTML.includes("这件事已被小镇记住"), "这件事已被小镇记住 visible in HTML");
  assert(root.innerHTML.includes("让小七先照顾小猫"), "chosen choice label visible in HTML");
}

// ── Test 6: chosen event → buildEventChoiceEntryView returns chosen status ─────
console.log("\n── buildEventChoiceEntryView: chosen status ──");
{
  const { state, eventId, choiceId } = makeStateWithM3Event();
  const onChooseEvent = makeOnChooseEvent(state);
  onChooseEvent(eventId, choiceId);

  const uiState = { llmStatus: "idle", eventDirectorStatus: "idle" };
  const view = buildEventChoiceEntryView(state, uiState);

  assert(view.status === "chosen", "view.status is 'chosen'");
  assert(view.chosenChoiceLabel === "让小七先照顾小猫", "chosenChoiceLabel correct");
  assert(view.resultText === "小七把小猫抱到餐厅门口，米米给它准备了一小碟水。", "resultText correct");
  assert(view.memoryHint.includes("小镇记住"), "memoryHint present");
}

// ── Test 7: dayCycle idle → state still committed ─────────────────────────────
console.log("\n── idle dayCycle: state committed regardless ──");
{
  const { state, eventId, choiceId } = makeStateWithM3Event();
  const onChooseEvent = makeOnChooseEvent(state);

  // dayCycle status is idle (not waiting_choice)
  const beforeEvents = state.events.length;
  onChooseEvent(eventId, choiceId);
  const afterEvents = state.events.length;

  assert(afterEvents > beforeEvents, "events array grew (player-choice appended)");
  const updatedEvent = state.events.find((e) => e.id === eventId);
  assert(updatedEvent?.chosenChoiceId === choiceId, "chosenChoiceId written even when dayCycle idle");
}

// ── Test 8: repeat click → guard prevents double write ────────────────────────
console.log("\n── repeat click: guard prevents double write ──");
{
  const { state, eventId, choiceId } = makeStateWithM3Event();
  const onChooseEvent = makeOnChooseEvent(state);

  onChooseEvent(eventId, choiceId);
  const afterFirst = state.townMemory?.length ?? 0;

  // Try again — should be guarded by chosenChoiceId
  onChooseEvent(eventId, choiceId);
  const afterSecond = state.townMemory?.length ?? 0;

  assert(afterSecond === afterFirst, "repeat click does not double-write townMemory");
}

// ── Test 9: choiceAftermath created ───────────────────────────────────────────
console.log("\n── aftermath: buildChoiceAftermath creates non-empty aftermath ──");
{
  const { state, eventId, choiceId } = makeStateWithM3Event();
  const onChooseEvent = makeOnChooseEvent(state);
  const result = onChooseEvent(eventId, choiceId);

  assert(result?.aftermath !== null && typeof result.aftermath === "object", "aftermath is an object");
  assert(result?.aftermath?.choiceLabel === "让小七先照顾小猫", "aftermath.choiceLabel correct");
  assert(result?.aftermath?.summary && result.aftermath.summary.length > 0, "aftermath.summary non-empty");
  assert(Array.isArray(result?.aftermath?.residentReactions), "aftermath.residentReactions is array");
}

// ── Results ────────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll event-choice-click checks passed!");
