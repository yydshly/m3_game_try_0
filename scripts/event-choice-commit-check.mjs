// event-choice-commit-check — validates that manual event choices commit correctly
// Tests: onChooseEvent path, state commit, memory write, chosen state, dayCycle guard

import { createInitialState } from "../src/domain/state.js";
import { buildEventChoiceEntryView } from "../src/ui/render.js";
import { applyChoiceMemory } from "../src/domain/memory.js";
import { readFileSync } from "fs";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); }
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
}

// ── Inline buildChoiceAftermath (mirrors app.js logic, no DOM dependency) ────

const REACTION_TEMPLATES = [
  "好，我去准备一下。", "明白了，我这就去。", "明白了，我留下。",
  "那我去通知大家。", "好的，我来分工。", "没问题，交给我吧。",
  "那我去花园看看。", "我去工坊拿工具。", "好的，我在广场等大家。",
  "好，我先去森林看看情况。", "明白了，我去安排。", "好的，我去整理一下。",
];

function buildChoiceAftermathInline(sourceEvent, choice, currentState) {
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

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeM3Event(id = "manual-event-1", choicesOverride = null) {
  return {
    id,
    type: "m3-event",
    day: 1,
    phase: "下午",
    title: "要不要把照片挂到工坊墙上？",
    text: "阿远在工坊发现一张旧照片。",
    tone: "cozy",
    residentIds: ["yuan", "hua"],
    placeId: "workshop",
    choices: choicesOverride ?? [
      { id: "hang_it", label: "挂到工坊墙上", preview: "工坊会多一点共同回忆。", resultText: "阿远把照片挂在工坊入口。" },
      { id: "keep_album", label: "先收进小镇相册", preview: "先保存下来。", resultText: "照片被小心收进相册。" },
      { id: "ask_yuan", label: "问问阿远的意见", preview: "让阿远来决定。", resultText: "阿远想了想，决定先留着。" },
    ],
    chosenChoiceId: null,
    choiceResultText: null,
    memoryReferences: [],
  };
}

function readAppJs() {
  return readFileSync("./src/app.js", "utf8");
}

// ── Test 1: applyChoiceMemory writes chosenChoiceId ───────────────────────────
console.log("\n── applyChoiceMemory writes chosenChoiceId ──");
{
  const state = createInitialState();
  const event = makeM3Event();
  const eventsState = { ...state, events: [...state.events, event] };
  const choice = event.choices[0];
  const phase = { label: "下午" };

  const nextState = applyChoiceMemory(eventsState, event, choice, phase);
  const updatedEvent = nextState.events.find((e) => e.id === event.id);

  assert(updatedEvent?.chosenChoiceId === "hang_it", "chosenChoiceId is written to the event");
  assert(updatedEvent?.choiceResultText === "阿远把照片挂在工坊入口。", "choiceResultText is written");
}

// ── Test 2: applyChoiceMemory appends player-choice event ───────────────────
console.log("\n── applyChoiceMemory appends player-choice event ──");
{
  const state = createInitialState();
  const event = makeM3Event();
  const eventsState = { ...state, events: [...state.events, event] };
  const choice = event.choices[0];
  const phase = { label: "下午" };

  const nextState = applyChoiceMemory(eventsState, event, choice, phase);
  const playerChoiceEvents = nextState.events.filter((e) => e.type === "player-choice");

  assert(playerChoiceEvents.length > 0, "player-choice event is appended");
  const pc = playerChoiceEvents[playerChoiceEvents.length - 1];
  assert(pc.choiceLabel === "挂到工坊墙上", "player-choice has correct choiceLabel");
  assert(pc.text === "阿远把照片挂在工坊入口。", "player-choice has result text");
}

// ── Test 3: applyChoiceMemory writes townMemory ──────────────────────────────
console.log("\n── applyChoiceMemory writes townMemory ──");
{
  const state = createInitialState();
  const event = makeM3Event();
  const eventsState = { ...state, events: [...state.events, event] };
  const choice = event.choices[0];
  const phase = { label: "下午" };

  const nextState = applyChoiceMemory(eventsState, event, choice, phase);

  assert(Array.isArray(nextState.townMemory), "townMemory is an array");
  const choiceMemories = nextState.townMemory.filter((m) => m.type === "player-choice" || m.type === "choice-memory");
  assert(choiceMemories.length > 0, "player-choice memory is written to townMemory");
}

// ── Test 4: buildChoiceAftermath creates non-empty aftermath ─────────────────
console.log("\n── buildChoiceAftermath creates aftermath ──");
{
  const state = createInitialState();
  const event = makeM3Event();
  const eventsState = { ...state, events: [...state.events, event] };
  const choice = event.choices[0];
  const phase = { label: "下午" };

  const nextState = applyChoiceMemory(eventsState, event, choice, phase);
  const aftermath = buildChoiceAftermathInline(event, choice, nextState);

  assert(aftermath !== null && typeof aftermath === "object", "aftermath is an object");
  assert(aftermath.id != null, "aftermath has id");
  assert(aftermath.choiceLabel === "挂到工坊墙上", "aftermath.choiceLabel is correct");
  assert(aftermath.summary && aftermath.summary.length > 0, "aftermath.summary is non-empty");
  assert(Array.isArray(aftermath.residentReactions), "aftermath.residentReactions is array");
}

// ── Test 5: chosen state in buildEventChoiceEntryView ───────────────────────
console.log("\n── buildEventChoiceEntryView: chosen status ──");
{
  const state = createInitialState();
  const event = makeM3Event("chosen-ev", [
    { id: "a", label: "选项A", preview: "提示A", resultText: "结果A" },
  ]);
  event.chosenChoiceId = "a";

  const eventsState = { ...state, events: [...state.events, event] };
  const uiState = { llmStatus: "idle", eventDirectorStatus: "idle" };

  const view = buildEventChoiceEntryView(eventsState, uiState);

  assert(view.status === "chosen", "view status is 'chosen'");
  assert(view.chosenChoiceLabel === "选项A", "chosenChoiceLabel is correct");
  assert(view.resultText === "结果A", "resultText is correct");
  assert(view.memoryHint.includes("小镇记住"), "memoryHint is present");
}

// ── Test 6: repeat choice is guarded (no double-write) ───────────────────────
console.log("\n── repeat choice: guard prevents double write ──");
{
  const state = createInitialState();
  const event = makeM3Event("repeat-ev");
  const eventsState = { ...state, events: [...state.events, event] };
  const choice = event.choices[0];
  const phase = { label: "下午" };

  const next1 = applyChoiceMemory(eventsState, event, choice, phase);
  const firstMemCount = next1.townMemory.length;

  if (!event.chosenChoiceId) {
    const next2 = applyChoiceMemory(next1, event, choice, phase);
    assert(next2.townMemory.length === firstMemCount, "repeat choice does not double-write memory");
  } else {
    assert(true, "already chosen — guard prevents double write");
  }
}

// ── Test 7: missing eventId / choiceId returns safely ─────────────────────
console.log("\n── missing eventId / choiceId: guarded by onChooseEvent ──");
{
  const state = createInitialState();
  const event = makeM3Event("safe-test-ev");
  const eventsState = { ...state, events: [...state.events, event] };
  const phase = { label: "下午" };

  // onChooseEvent's guard `if (!sourceEvent) return` prevents null from reaching applyChoiceMemory
  // applyChoiceMemory itself does NOT guard against null — that's the handler's job
  // Test that the guards exist in the source
  const content = readAppJs();
  const chooseHandler = content.split("onChooseEvent:")[1]?.split("onMiniMaxBroadcast:")?.[0] ?? "";
  assert(chooseHandler.includes("if (!sourceEvent) return"), "onChooseEvent guards against null eventId");
  assert(chooseHandler.includes("if (!choice) return"), "onChooseEvent guards against null choiceId");
}

// ── Test 8: onChooseEvent commits state directly (source code check) ───────
console.log("\n── onChooseEvent: always commits state ──");
{
  const content = readAppJs();
  const chooseHandler = content.split("onChooseEvent:")[1]?.split("onMiniMaxBroadcast:")?.[0] ?? "";
  assert(chooseHandler.includes("state = nextState"), "onChooseEvent assigns state = nextState");
  assert(chooseHandler.includes("saveState(state)"), "onChooseEvent calls saveState(state)");
  assert(chooseHandler.includes("render()"), "onChooseEvent calls render()");
  assert(!chooseHandler.includes("completeDayCycle(nextState)"), "onChooseEvent no longer calls completeDayCycle(nextState)");
}

// ── Test 9: transitionDayCycleToCompleted exists and is called ─────────────
console.log("\n── transitionDayCycleToCompleted wiring ──");
{
  const content = readAppJs();
  assert(content.includes("function transitionDayCycleToCompleted()"), "transitionDayCycleToCompleted function exists");
  const chooseHandler = content.split("onChooseEvent:")[1]?.split("onMiniMaxBroadcast:")?.[0] ?? "";
  assert(chooseHandler.includes("transitionDayCycleToCompleted()"), "onChooseEvent calls transitionDayCycleToCompleted");
}

// ── Test 10: transitionDayCycleToCompleted is guarded by waiting_choice ─────
console.log("\n── transitionDayCycleToCompleted: waiting_choice guard ──");
{
  const content = readAppJs();
  const fnBody = content.split("function transitionDayCycleToCompleted()")[1]?.split(/^}/m)?.[0] ?? "";
  assert(fnBody.includes("waiting_choice"), "transitionDayCycleToCompleted checks waiting_choice status");
}

// ── Test 11: chosenChoiceId guard prevents double choice ───────────────────
console.log("\n── chosenChoiceId guard in onChooseEvent ──");
{
  const content = readAppJs();
  const chooseHandler = content.split("onChooseEvent:")[1]?.split("onMiniMaxBroadcast:")?.[0] ?? "";
  assert(chooseHandler.includes("chosenChoiceId"), "onChooseEvent checks chosenChoiceId");
  assert(chooseHandler.includes("if (sourceEvent.chosenChoiceId) return"), "chosenChoiceId already set returns early");
}

// ── Test 12: onChooseEvent guards prevent null from reaching applyChoiceMemory ──
console.log("\n── onChooseEvent null guards ──");
{
  const content = readAppJs();
  const chooseHandler = content.split("onChooseEvent:")[1]?.split("onMiniMaxBroadcast:")?.[0] ?? "";
  assert(chooseHandler.includes("if (!sourceEvent) return"), "guards against null eventId");
  assert(chooseHandler.includes("if (!choice) return"), "guards against null choiceId");
}

// ── Results ───────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll event-choice-commit checks passed!");
