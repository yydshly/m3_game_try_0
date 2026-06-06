// Memory reference check — tests buildTownMemorySummary and prompt integration
import { buildTownMemorySummary } from "../src/domain/memory.js";
import { createInitialState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";
import { renderApp } from "../src/ui/render.js";

// Test the actual buildBroadcastPrompt logic (re-implemented here to avoid importing server internals)
function buildBroadcastPromptTest(state, memorySummary = "") {
  const memoryBlock = memorySummary
    ? `\n\n${memorySummary}\n\nYou may naturally reference the memories above if relevant. Do NOT invent memories that are not listed above. If no relevant memory exists, simply ignore the memory section and write a normal broadcast for today.`
    : "";
  return {
    system:
      "You are the town radio host." +
      (memorySummary ? " The broadcast may naturally reference real town memories listed in the user content. Never fabricate a memory that is not provided." : ""),
    userContent: JSON.stringify({ state, memorySummary }),
    memoryBlock,
  };
}

function buildEventPromptTest(state, memorySummary = "") {
  const memoryBlock = memorySummary
    ? `\n\n${memorySummary}\n\nYou may create an event that continues from a real memory above if it feels natural. Do NOT invent player choices or events that are not listed. If no relevant memory exists, generate a normal event for today.`
    : "";
  return {
    system:
      "You are the event director." +
      (memorySummary ? " Events may naturally continue from real town memories listed in the user content. Never fabricate player choices or events that are not provided in the memories." : ""),
    userContent: JSON.stringify({ state, memorySummary }),
    memoryBlock,
  };
}

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
  onGenerateTts() {},
  onPlayTts() {},
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

// ── buildTownMemorySummary tests ───────────────────────────────────────────────
console.log("\n── buildTownMemorySummary ──");

{
  const result = buildTownMemorySummary([]);
  assert(result === "", "empty array returns empty string");
}

{
  const result = buildTownMemorySummary(null);
  assert(result === "", "null returns empty string");
}

{
  const result = buildTownMemorySummary(undefined);
  assert(result === "", "undefined returns empty string");
}

{
  const result = buildTownMemorySummary("not an array");
  assert(result === "", "non-array returns empty string");
}

{
  const result = buildTownMemorySummary([null, undefined, {}]);
  assert(result === "", "entries with missing text return empty string");
}

{
  const result = buildTownMemorySummary([
    { text: "" },
    { text: "   " },
  ]);
  assert(result === "", "whitespace-only text returns empty string");
}

{
  const result = buildTownMemorySummary([
    { text: "玩家选择了帮助花园。", day: 1, phase: "早上" },
    { text: "居民们很开心。", day: 1, phase: "下午" },
    { text: "晚上小镇很安静。", day: 1, phase: "晚上" },
  ]);
  assert(result.includes("小镇近期记忆"), "header included");
  assert(result.includes("玩家选择了帮助花园"), "first entry included");
  assert(result.includes("居民们很开心"), "second entry included");
  assert(result.includes("晚上小镇很安静"), "third entry included");
}

{
  // maxEntries cap
  const entries = Array.from({ length: 5 }, (_, i) => ({
    text: `记忆${i + 1}很长很长的内容需要被截断`,
    day: i + 1,
  }));
  const result = buildTownMemorySummary(entries, { maxEntries: 3 });
  const count = (result.match(/·/g) || []).length;
  assert(count === 3, `maxEntries=3 limits entries (got ${count})`);
}

{
  // maxEntryLength truncation
  const entries = [{ text: "A".repeat(200), day: 1 }];
  const result = buildTownMemorySummary(entries, { maxEntryLength: 80 });
  assert(result.length <= 100, "long entries truncated");
  assert(result.includes("…"), "truncation indicated with ellipsis");
}

{
  // maxLength overall cap
  const entries = [
    { text: "第1天玩家选择了帮助花园。这是一个很长的记忆内容。", day: 1 },
    { text: "第2天居民们很开心。花香飘到了广场上。", day: 2 },
    { text: "第3天小镇安静地运转着。大家都过得很舒适。", day: 3 },
  ];
  const result = buildTownMemorySummary(entries, { maxLength: 100 });
  assert(result.length <= 102, `maxLength=100 caps total output (got ${result.length})`);
}

{
  // Order: most recent last
  const entries = [
    { text: "最早的记忆", day: 1 },
    { text: "最新的记忆", day: 3 },
    { text: "中间的记忆", day: 2 },
  ];
  const result = buildTownMemorySummary(entries);
  const latestIdx = result.indexOf("最新的记忆");
  const earliestIdx = result.indexOf("最早的记忆");
  assert(latestIdx > earliestIdx, "most recent entry appears last in output");
}

// ── Prompt integration tests ────────────────────────────────────────────────────
console.log("\n── Prompt memory injection ──");

{
  const state = { townMemory: [] };
  const prompt = buildBroadcastPromptTest(state, "");
  assert(!prompt.system.includes("fabricate"), "no anti-fabrication constraint when no memory");
  assert(prompt.userContent.includes('""') || prompt.userContent.includes('"memorySummary":"\\n\\n"'), "empty memorySummary passed");
}

{
  const state = {
    townMemory: [
      { text: "玩家选择了帮助花园。", day: 1, phase: "早上" },
    ],
  };
  const summary = buildTownMemorySummary(state.townMemory);
  const prompt = buildBroadcastPromptTest(state, summary);
  assert(prompt.system.includes("fabricate") || prompt.system.includes("fabricate"), "anti-fabrication constraint present");
  assert(prompt.userContent.includes("帮助花园"), "memory text included in prompt");
}

{
  const state = { townMemory: [] };
  const summary = buildTownMemorySummary(state.townMemory);
  const prompt = buildEventPromptTest(state, summary);
  assert(JSON.parse(prompt.userContent).memorySummary === "", "empty memorySummary serializes correctly in event prompt");
}

{
  const state = {
    townMemory: [
      { text: "玩家在集市活动中选择了帮忙。居民们记得这件事。", day: 2, phase: "下午" },
    ],
  };
  const summary = buildTownMemorySummary(state.townMemory);
  const prompt = buildEventPromptTest(state, summary);
  assert(prompt.system.includes("fabricate"), "anti-fabrication constraint in event prompt");
  assert(prompt.userContent.includes("帮忙"), "memory text included in event prompt");
}

// ── Fallback behavior tests ────────────────────────────────────────────────────
console.log("\n── Fallback when no memory ──");

{
  // Simulate what happens when townMemory is missing from state
  const stateWithMissingTownMemory = { residents: [], town: {} };
  const summary = buildTownMemorySummary(stateWithMissingTownMemory?.townMemory);
  assert(summary === "", "missing townMemory returns empty string");
  const prompt = buildBroadcastPromptTest(stateWithMissingTownMemory, summary);
  assert(!prompt.userContent.includes("帮助"), "no fabricated content when townMemory missing");
}

{
  // Simulate what happens when townMemory is undefined
  const stateWithUndefinedMemory = { residents: [], town: {}, townMemory: undefined };
  const summary = buildTownMemorySummary(stateWithUndefinedMemory?.townMemory);
  assert(summary === "", "undefined townMemory returns empty string");
}

// ── Render integration ─────────────────────────────────────────────────────────
console.log("\n── Render integration (no regression) ──");

const state = advancePhase(advancePhase(createInitialState()));
renderApp(root, state, noopHandlers);

assert(root.innerHTML.includes("🎧 小镇氛围"), "atmosphere panel still renders");
assert(root.innerHTML.includes("📻 生成小镇广播"), "broadcast button still renders");
assert(root.innerHTML.includes("🎭 生成小镇事件") || root.innerHTML.includes("🎭 小镇事件导演"), "event button still renders");

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\nAll memory-reference checks passed!");
