import { createInitialState } from "../src/domain/state.js";
import { advancePhase } from "../src/domain/simulation.js";

let state = createInitialState();
state = advancePhase(state);
state = advancePhase(state);
state = advancePhase(state);

const result = {
  day: state.day,
  phaseIndex: state.phaseIndex,
  residents: state.residents.length,
  events: state.events.length,
  reports: state.reports.length,
};

if (result.day !== 2 || result.phaseIndex !== 0 || result.residents !== 5 || result.reports !== 1) {
  console.error(result);
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
