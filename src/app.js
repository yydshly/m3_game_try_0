import { createInitialState, upgradeState } from "./domain/state.js";
import { advancePhase, applyAgentPlan, assignTask, resetAssignments } from "./domain/simulation.js";
import { applyChoiceMemory } from "./domain/memory.js";
import { requestMiniMaxPlan, requestMiniMaxEvent, requestMiniMaxBroadcast } from "./services/minimaxClient.js";
import { loadState, saveState, clearState } from "./services/persistence.js";
import { renderApp } from "./ui/render.js";
import { phases } from "./data/seed.js";

const root = document.querySelector("#app");
let state = loadState();
if (state) {
  state = upgradeState(state);
} else {
  state = createInitialState();
}
let uiState = {
  selectedResidentId: state.residents[0]?.id ?? null,
  autoPlay: false,
  llmStatus: "idle",
  llmMessage: "",
  eventDirectorStatus: "idle",
  eventDirectorMessage: "",
  broadcastStatus: "idle",
  broadcastMessage: "",
  latestBroadcast: null,
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
        uiState = { ...uiState, llmStatus: "loading", llmMessage: "正在观察居民状态和小镇资源……" };
        render();
        try {
          const plan = await requestMiniMaxPlan(state);
          const townNote = plan.townNote ? `✨ ${plan.townNote}` : "✨ AI 管家已完成本轮安排~";
          uiState = { ...uiState, llmStatus: "ready", llmMessage: townNote };
          commit(applyAgentPlan(state, plan));
        } catch (error) {
          uiState = { ...uiState, llmStatus: "error", llmMessage: error.message };
          render();
        }
      },
      onMiniMaxEvent: async () => {
        stopAutoPlay();
        uiState = { ...uiState, eventDirectorStatus: "loading", eventDirectorMessage: "M3 正在观察居民和小镇动态……" };
        render();
        try {
          const result = await requestMiniMaxEvent(state);
          const evt = result.event;
          const currentPhase = phases[state.phaseIndex];
          const newEvent = {
            id: evt.id ?? `m3-event-${Date.now()}`,
            type: "m3-event",
            day: state.day,
            phase: currentPhase.label,
            title: evt.title,
            text: evt.text,
            tone: evt.tone ?? "cozy",
            residentIds: evt.residentIds ?? [],
            placeId: evt.placeId ?? "plaza",
            suggestedFollowUp: evt.suggestedFollowUp ?? "",
            choices: evt.choices ?? [],
            chosenChoiceId: null,
            choiceResultText: null,
          };
          const nextState = {
            ...state,
            events: [...(state.events ?? []), newEvent],
          };
          const followUp = evt.suggestedFollowUp
            ? `✨ 建议：${evt.suggestedFollowUp}`
            : "✨ 小镇事件已加入动态。";
          uiState = { ...uiState, eventDirectorStatus: "ready", eventDirectorMessage: followUp };
          commit(nextState);
        } catch (error) {
          uiState = { ...uiState, eventDirectorStatus: "error", eventDirectorMessage: error.message };
          render();
        }
      },
      onChooseEvent: (eventId, choiceId) => {
        const events = state.events ?? [];
        const sourceEvent = events.find((e) => e.id === eventId);
        if (!sourceEvent) return;
        if (sourceEvent.type !== "m3-event") return;
        if (sourceEvent.chosenChoiceId) return;
        const choice = (sourceEvent.choices ?? []).find((c) => c.id === choiceId);
        if (!choice) return;

        const currentPhase = phases[state.phaseIndex];
        const nextState = applyChoiceMemory(state, sourceEvent, choice, currentPhase);
        commit(nextState);
      },
      onMiniMaxBroadcast: async () => {
        stopAutoPlay();
        uiState = { ...uiState, broadcastStatus: "loading", broadcastMessage: "M3 正在整理今天的小镇广播……" };
        render();
        try {
          const result = await requestMiniMaxBroadcast(state);
          const bc = result.broadcast;
          const currentPhase = phases[state.phaseIndex];
          const newEvent = {
            id: bc.id ?? `broadcast-${Date.now()}`,
            type: "town-broadcast",
            day: state.day,
            phase: currentPhase.label,
            title: bc.title,
            text: bc.script,
            mood: bc.mood,
            musicMood: bc.musicMood,
            musicPrompt: bc.musicPrompt,
            residentIds: bc.relatedResidentIds ?? [],
            placeId: bc.placeId ?? "plaza",
            durationHint: bc.durationHint ?? "15-30s",
          };
          const nextState = {
            ...state,
            events: [...(state.events ?? []), newEvent],
          };
          uiState = {
            ...uiState,
            broadcastStatus: "ready",
            broadcastMessage: "小镇广播已加入动态。",
            latestBroadcast: bc,
          };
          commit(nextState);
        } catch (error) {
          uiState = { ...uiState, broadcastStatus: "error", broadcastMessage: error.message };
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
        uiState = { selectedResidentId: null, autoPlay: false, llmStatus: "idle", llmMessage: "", eventDirectorStatus: "idle", eventDirectorMessage: "", broadcastStatus: "idle", broadcastMessage: "", latestBroadcast: null };
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
