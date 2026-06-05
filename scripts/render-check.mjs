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
  onAssignTask() {},
  onSelectResident() {},
  onResetAssignments() {},
  onNewTown() {},
};

renderApp(root, advancePhase(createInitialState()), noopHandlers);

const result = {
  hasStage: root.innerHTML.includes("town-stage"),
  residents: root.innerHTML.split('class="stage-resident ').length - 1,
  places: root.innerHTML.split('class="stage-place').length - 1,
  bubble: root.innerHTML.includes("stage-bubble"),
  travelVars: root.innerHTML.includes("--from-x"),
  actionBadges: root.innerHTML.split('class="char-chip"').length - 1,
  legend: root.innerHTML.includes("stage-legend"),
  spotlightStatus: root.innerHTML.includes("spotlight__status"),
  goals: root.innerHTML.split('<article class="goal').length - 1,
  autoPlay: root.innerHTML.includes('data-action="toggle-auto"'),
  minimaxButton: root.innerHTML.includes('data-action="minimax-plan"'),
};

if (
  !result.hasStage ||
  result.residents !== 5 ||
  result.places !== 5 ||
  !result.bubble ||
  !result.travelVars ||
  result.actionBadges !== 5 ||
  !result.legend ||
  !result.spotlightStatus ||
  result.goals < 4 ||
  !result.autoPlay ||
  !result.minimaxButton
) {
  console.error(result);
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
