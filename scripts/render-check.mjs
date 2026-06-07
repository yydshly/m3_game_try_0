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

renderApp(root, advancePhase(createInitialState()), noopHandlers);

const result = {
  hasStage: root.innerHTML.includes("town-stage"),
  residents: root.innerHTML.split("stage-character").length - 1,
  placeLabels: root.innerHTML.split("stage-place-label").length - 1,
  bubble: root.innerHTML.includes("stage-bubble"),
  legend: root.innerHTML.includes("stage-legend"),
  spotlightStatus: root.innerHTML.includes("spotlight__status"),
  goals: root.innerHTML.split(/<article class="goal|<div class="goal/).length - 1,
  autoPlay: root.innerHTML.includes('data-action="toggle-auto"'),
  minimaxButton: root.innerHTML.includes('data-action="minimax-plan"'),
  townMemory: root.innerHTML.includes("town-memory"),
  v1SummaryLink: root.innerHTML.includes("V1 项目总结"),
  v1SummaryHref: root.innerHTML.includes("docs/V1_PROJECT_SUMMARY_SHOWCASE.html"),
  v1SummaryNewTab: root.innerHTML.includes('target="_blank"'),
};

if (
  !result.hasStage ||
  result.residents < 5 ||
  !result.bubble ||
  !result.legend ||
  !result.spotlightStatus ||
  result.goals < 4 ||
  !result.autoPlay ||
  !result.minimaxButton ||
  !result.v1SummaryLink ||
  !result.v1SummaryHref ||
  !result.v1SummaryNewTab
) {
  console.error(result);
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
