import { createInitialState } from "./domain/state.js";
import { advancePhase, applyAgentPlan, assignTask, resetAssignments } from "./domain/simulation.js";
import { requestMiniMaxPlan } from "./services/minimaxClient.js";
import { loadState, saveState, clearState } from "./services/persistence.js";
import { renderApp } from "./ui/render.js";

const root = document.querySelector("#app");
let state = loadState() ?? createInitialState();
let uiState = {
  selectedResidentId: state.residents[0]?.id ?? null,
  autoPlay: false,
  llmStatus: "idle",
  llmMessage: "",
};
let autoPlayTimer = null;

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer);
    autoPlayTimer = null;
  }
  uiState = { ...uiState, autoPlay: false };
}

function startAutoPlay() {
  if (autoPlayTimer) return;
  uiState = { ...uiState, autoPlay: true };
  autoPlayTimer = setInterval(() => {
    commit(advancePhase(state));
  }, 1400);
}

function commit(nextState) {
  try {
    state = nextState;
    saveState(state);
    render();
  } catch (error) {
    renderError(error);
  }
}

function render() {
  try {
    renderApp(root, state, {
      onAdvance: () => commit(advancePhase(state)),
      onRunDay: () => {
        let next = state;
        const steps = 3 - state.phaseIndex;
        for (let index = 0; index < steps; index += 1) {
          next = advancePhase(next);
        }
        commit(next);
      },
      onToggleAutoPlay: () => {
        if (autoPlayTimer) {
          stopAutoPlay();
        } else {
          startAutoPlay();
        }
        render();
      },
      onMiniMaxPlan: async () => {
        stopAutoPlay();
        uiState = { ...uiState, llmStatus: "loading", llmMessage: "Asking MiniMax to plan the next phase..." };
        render();
        try {
          const plan = await requestMiniMaxPlan(state);
          uiState = { ...uiState, llmStatus: "ready", llmMessage: plan.model ? `Plan from ${plan.model}` : "MiniMax plan applied" };
          commit(applyAgentPlan(state, plan));
        } catch (error) {
          uiState = { ...uiState, llmStatus: "error", llmMessage: error.message };
          render();
        }
      },
      onAssignTask: (residentId, taskId) => commit(assignTask(state, residentId, taskId)),
      onSelectResident: (residentId) => {
        uiState = { ...uiState, selectedResidentId: residentId };
        render();
      },
      onResetAssignments: () => commit(resetAssignments(state)),
      onNewTown: () => {
        stopAutoPlay();
        clearState();
        uiState = { selectedResidentId: null, autoPlay: false, llmStatus: "idle", llmMessage: "" };
        commit(createInitialState());
      },
    }, uiState);
  } catch (error) {
    renderError(error);
  }
}

function renderError(error) {
  console.error(error);
  root.innerHTML = `
    <main class="shell">
      <section class="panel app-error">
        <p class="eyebrow">Runtime Error</p>
        <h1>AI Town Life could not render.</h1>
        <p>The saved local state may be incompatible. Start a fresh town to recover.</p>
        <button class="button button--primary" type="button" data-action="recover">Start Fresh</button>
      </section>
    </main>
  `;
  root.querySelector("[data-action='recover']").addEventListener("click", () => {
    clearState();
    state = createInitialState();
    saveState(state);
    render();
  });
}

render();
