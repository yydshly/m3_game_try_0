import { createInitialState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

// Test 1: createInitialState后所有居民都有agent字段
const initialState = createInitialState();
assert(initialState.residents.length === 5, "Should have 5 residents");
for (const resident of initialState.residents) {
  assert(resident.agent !== undefined, `Resident ${resident.name} missing agent field`);
  assert(resident.agent.needs !== undefined, `Resident ${resident.name} missing agent.needs`);
  assert(resident.agent.goals !== undefined, `Resident ${resident.name} missing agent.goals`);
  assert(typeof resident.agent.decisionReason === "string", `Resident ${resident.name} missing agent.decisionReason`);
}
console.log("PASS: All residents have agent fields on createInitialState");

// Test 2: 连续 advancePhase() 三次后仍然进入第2天
let state = initialState;
state = advancePhase(state);
state = advancePhase(state);
state = advancePhase(state);
assert(state.day === 2, `Expected day 2, got day ${state.day}`);
assert(state.phaseIndex === 0, `Expected phaseIndex 0, got ${state.phaseIndex}`);
assert(state.reports.length >= 1, `Expected at least 1 report, got ${state.reports.length}`);
console.log("PASS: After 3 advancePhase calls, day advanced to 2 correctly");

// Test 3: 每个居民agent.needs数值仍在0~100
for (const resident of state.residents) {
  const { rest, social, achievement } = resident.agent.needs;
  assert(
    rest >= 0 && rest <= 100,
    `Resident ${resident.name} rest need ${rest} out of range [0,100]`
  );
  assert(
    social >= 0 && social <= 100,
    `Resident ${resident.name} social need ${social} out of range [0,100]`
  );
  assert(
    achievement >= 0 && achievement <= 100,
    `Resident ${resident.name} achievement need ${achievement} out of range [0,100]`
  );
}
console.log("PASS: All resident agent.needs values are within [0,100]");

// Test 4: 每个居民有decisionReason
for (const resident of state.residents) {
  assert(
    typeof resident.agent.decisionReason === "string" && resident.agent.decisionReason.length > 0,
    `Resident ${resident.name} missing decisionReason`
  );
}
console.log("PASS: All residents have non-empty decisionReason");

// Test 5: reports仍正常生成
assert(state.reports.length >= 1, "Should have at least 1 daily report");
const latestReport = state.reports[0];
assert(latestReport.title !== undefined, "Report missing title");
assert(latestReport.summary !== undefined, "Report missing summary");
assert(Array.isArray(latestReport.highlights), "Report highlights should be an array");
console.log("PASS: Daily reports are generated correctly");

console.log("\nAll agent-check validations passed!");
console.log(JSON.stringify(
  {
    day: state.day,
    phaseIndex: state.phaseIndex,
    residents: state.residents.length,
    reports: state.reports.length,
    agentNeeds: state.residents.map((r) => ({
      name: r.name,
      needs: r.agent.needs,
      decisionReason: r.agent.decisionReason,
    })),
  },
  null,
  2
));
