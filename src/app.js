import { createInitialState, upgradeState } from "./domain/state.js";
import { advancePhase, applyAgentPlan, assignTask, resetAssignments } from "./domain/simulation.js";
import { applyChoiceMemory } from "./domain/memory.js";
import { requestMiniMaxPlan, requestMiniMaxEvent, requestMiniMaxBroadcast, buildPromptMemoryNarrative } from "./services/minimaxClient.js";
import { generateBroadcastSpeech } from "./services/minimaxTts.js";
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
// ── Animation Timing Constants ───────────────────────────────────────────────────────

const TRAVEL_ANIMATION_MS = 1150;
const TASK_ACTION_MS = 2100;
const TASK_ANIMATION_DURATION_MS = TRAVEL_ANIMATION_MS + TASK_ACTION_MS; // 3250ms
const AUTO_PLAY_DELAY_MS = TASK_ANIMATION_DURATION_MS + 700; // ~4000ms
const COMPLETION_FEEDBACK_MS = 2200;

// ── UI State ──────────────────────────────────────────────────────────────────────

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
  broadcastAudio: makeAudioState(),
  activeTaskAnimations: [],
  isAnimating: false,
  animationMessage: "",
  completionFeedback: null,
};
let autoPlayTimer = null;
let animationTimer = null;
let completionTimer = null;

// ── Broadcast Audio Player ─────────────────────────────────────────────────────────

/** Persistent audio instance for the broadcast player */
let activeAudio = null;

/**
 * Simple string hash for detecting script changes.
 * Uses the same algorithm as the memory hash for consistency.
 */
function hashBroadcastScript(script) {
  return String(script || "")
    .trim()
    .split("")
    .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
    .toString(16);
}

/**
 * Make a clean broadcastAudio object.
 */
function makeAudioState(overrides = {}) {
  return {
    status: "idle",
    text: "",
    audioUrl: null,
    error: null,
    traceId: null,
    generatedAt: null,
    scriptHash: "",
    ...overrides,
  };
}

/**
 * Stop and clean up the active audio instance.
 */
function stopActiveAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio = null;
  }
}

// ── Task Animation Layer ────────────────────────────────────────────────────────────

const TASK_STAGE_EFFECTS = {
  plant:   { action: "work", effect: "bloom", bubble: "花园变得更有精神了。", gait: "walk" },
  cook:    { action: "work", effect: "steam",  bubble: "餐厅飘出了热气。", gait: "walk" },
  repair:  { action: "work", effect: "spark",  bubble: "工坊传来轻轻的敲打声。", gait: "walk" },
  chat:    { action: "chat", effect: "chat",   bubble: "广场上的聊天声多了起来。", gait: "walk" },
  forage:  { action: "work", effect: "leaf",   bubble: "森林里传来树叶沙沙声。", gait: "run" },
  rest:    { action: "rest", effect: "rest",   bubble: "有人在安静地休息。", gait: "slow" },
};

// ── Stage Presentation Layer ─────────────────────────────────────────────────────
// Defines how each task looks on the stage — prop emoji, action class, place effect.
// These are pure UI concerns; they do NOT affect simulation or task planning.

/**
 * @typedef {Object} StagePresentation
 * @property {string} actionClass  - CSS class suffix added to .stage-character (e.g. "is-farming")
 * @property {string} prop         - emoji shown as the character's prop/hand item
 * @property {string} propClass    - CSS class for prop animation (e.g. "prop--tool")
 * @property {string} placeEffect  - CSS class suffix for place label effect (e.g. "soil-bloom")
 * @property {string} motion       - animation type: "work-loop" | "calm-loop" | "talk-loop" | "breath-loop" | "travel-loop"
 */

/** @type {Record<string, StagePresentation>} */
const TASK_STAGE_PRESENTATIONS = {
  plant:   { actionClass: "is-farming",   prop: "⛏️", propClass: "prop--tool",   placeEffect: "soil-bloom",  motion: "work-loop"  },
  cook:    { actionClass: "is-cooking",   prop: "🍳", propClass: "prop--tool",   placeEffect: "steam-rise",  motion: "work-loop"  },
  repair:  { actionClass: "is-building",  prop: "🔧", propClass: "prop--tool",   placeEffect: "spark-float", motion: "work-loop"  },
  chat:    { actionClass: "is-chatting",  prop: "💬", propClass: "prop--chat",   placeEffect: "chat-pulse",  motion: "talk-loop"  },
  forage:  { actionClass: "is-foraging",  prop: "🧺", propClass: "prop--tool",   placeEffect: "leaf-float",  motion: "work-loop"  },
  rest:    { actionClass: "is-resting",   prop: "☁️", propClass: "prop--rest",   placeEffect: "soft-glow",   motion: "breath-loop" },
};

const TASK_COMPLETION_ICONS = {
  plant:   "🌸",
  cook:    "🍲",
  repair:  "🔧",
  chat:    "💬",
  forage:  "🌿",
  rest:    "💤",
};

const TASK_COMPLETION_LABELS = {
  plant:   "完成照看花园",
  cook:    "完成准备餐点",
  repair:  "完成工坊维护",
  chat:    "完成邻里交流",
  forage:  "完成森林采集",
  rest:    "完成休息恢复",
};

function buildCompletionFeedback(nextState) {
  return {
    id: `completion-${Date.now()}`,
    message: "本阶段行动完成",
    startedAt: Date.now(),
    residentResults: nextState.residents.map((resident) => ({
      residentId: resident.id,
      icon: TASK_COMPLETION_ICONS[resident.assignmentId] ?? "✓",
      label: TASK_COMPLETION_LABELS[resident.assignmentId] ?? "已完成",
    })),
  };
}

function getGait(taskId, resident) {
  if (taskId === "forage") return "run";
  if (taskId === "rest") return "slow";
  if ((resident?.energy ?? 100) < 30) return "slow";
  return "walk";
}

function buildTaskAnimations(prevState, nextState) {
  const prevById = new Map((prevState?.residents ?? []).map((r) => [r.id, r]));

  return nextState.residents.map((resident) => {
    const taskId = resident.assignmentId;
    const effect = TASK_STAGE_EFFECTS[taskId] ?? TASK_STAGE_EFFECTS.rest;
    const presentation = TASK_STAGE_PRESENTATIONS[taskId] ?? TASK_STAGE_PRESENTATIONS.rest;
    const gait = getGait(taskId, resident);

    const fromResident = prevById.get(resident.id);
    const fromPlaceId = fromResident?.locationId ?? null;
    const toPlaceId = resident.locationId ?? effect.placeId ?? null;
    const traveling = fromPlaceId != null && toPlaceId !== fromPlaceId;

    return {
      id: `anim-${Date.now()}-${resident.id}`,
      residentId: resident.id,
      taskId,
      fromPlaceId: fromPlaceId ?? toPlaceId,
      toPlaceId,
      placeId: toPlaceId,
      action: effect.action,
      effect: effect.effect,
      bubble: effect.bubble,
      gait,
      traveling,
      // Presentation
      presentationClass: presentation.actionClass,
      prop: presentation.prop,
      propClass: presentation.propClass,
      placeEffect: presentation.placeEffect,
      motion: presentation.motion,
      startedAt: Date.now(),
    };
  });
}

function showTaskAnimations(prevState, nextState, options = {}) {
  if (animationTimer) clearTimeout(animationTimer);
  if (completionTimer) { clearTimeout(completionTimer); completionTimer = null; }
  uiState = {
    ...uiState,
    activeTaskAnimations: buildTaskAnimations(prevState, nextState),
    isAnimating: true,
    animationMessage: "居民正在行动中……",
    completionFeedback: null,
  };
  render();
  animationTimer = setTimeout(() => {
    // Animation done — show completion feedback
    uiState = {
      ...uiState,
      activeTaskAnimations: [],
      isAnimating: false,
      animationMessage: "",
      completionFeedback: buildCompletionFeedback(nextState),
    };
    animationTimer = null;
    render();
    // Clear completion feedback after a short display
    completionTimer = setTimeout(() => {
      uiState = { ...uiState, completionFeedback: null };
      completionTimer = null;
      render();
      if (typeof options.afterComplete === "function") {
        options.afterComplete();
      }
    }, COMPLETION_FEEDBACK_MS);
  }, TASK_ANIMATION_DURATION_MS);
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearTimeout(autoPlayTimer);
    autoPlayTimer = null;
  }
  uiState = { ...uiState, autoPlay: false };
}

function scheduleAutoPlay() {
  if (!uiState.autoPlay) return;
  if (autoPlayTimer) clearTimeout(autoPlayTimer);
  autoPlayTimer = setTimeout(() => {
    if (!uiState.autoPlay) return;
    if (uiState.isAnimating) {
      // wait for animation to finish then retry
      scheduleAutoPlay();
      return;
    }
    const prev = state;
    const next = advancePhase(state);
    commit(next);
    showTaskAnimations(prev, next, { afterComplete: scheduleAutoPlay });
  }, AUTO_PLAY_DELAY_MS);
}

function startAutoPlay() {
  if (autoPlayTimer) return;
  uiState = { ...uiState, autoPlay: true };
  scheduleAutoPlay();
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
      onAdvance: () => {
        if (uiState.isAnimating) return;
        const prev = state;
        const next = advancePhase(state);
        commit(next);
        showTaskAnimations(prev, next);
      },
      onRunDay: () => {
        if (uiState.isAnimating) return;
        let prev = state;
        let next = state;
        const steps = 3 - state.phaseIndex;
        for (let index = 0; index < steps; index += 1) {
          next = advancePhase(next);
        }
        commit(next);
        showTaskAnimations(prev, next);
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
            // Tag event with memory references for UI display
            memoryReferences: buildPromptMemoryNarrative(state).uiLabels,
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
            latestBroadcast: {
              ...bc,
              // Tag UI labels for "引用记忆" display
              memoryReferences: buildPromptMemoryNarrative(state).uiLabels,
            },
            // Reset TTS state when new broadcast is generated
            broadcastAudio: makeAudioState({ text: bc.script ?? "", scriptHash: hashBroadcastScript(bc.script ?? "") }),
          };
          commit(nextState);
        } catch (error) {
          uiState = { ...uiState, broadcastStatus: "error", broadcastMessage: error.message };
          render();
        }
      },
      onGenerateTts: async () => {
        const latestBc = uiState.latestBroadcast;
        if (!latestBc) return;
        const scriptText = latestBc.script ?? latestBc.text ?? "";
        if (!scriptText.trim()) return;

        const currentHash = hashBroadcastScript(scriptText);
        const ba = uiState.broadcastAudio;

        // If loading or playing, ignore (prevent double generation or interruption)
        if (ba.status === "loading" || ba.status === "playing") return;

        // Stop any active audio before generating
        stopActiveAudio();

        uiState = {
          ...uiState,
          broadcastAudio: makeAudioState({
            status: "loading",
            text: scriptText,
            scriptHash: currentHash,
          }),
        };
        render();

        try {
          const result = await generateBroadcastSpeech(scriptText);
          uiState = {
            ...uiState,
            broadcastAudio: {
              status: "ready",
              text: scriptText,
              audioUrl: result.audioUrl,
              error: null,
              traceId: result.traceId,
              generatedAt: Date.now(),
              scriptHash: currentHash,
            },
          };
          render();
          // Auto-play after successful generation
          handlers.onPlayTts();
        } catch (error) {
          uiState = {
            ...uiState,
            broadcastAudio: {
              status: "error",
              text: scriptText,
              audioUrl: null,
              error: error.message,
              traceId: null,
              generatedAt: null,
              scriptHash: currentHash,
            },
          };
          render();
        }
      },
      onPlayTts: () => {
        const ba = uiState.broadcastAudio;
        if (!ba.audioUrl) return;
        // If already playing, pause it
        if (ba.status === "playing") {
          handlers.onPauseTts();
          return;
        }

        // Stop any previous audio instance
        stopActiveAudio();

        activeAudio = new Audio(ba.audioUrl);

        activeAudio.onplay = () => {
          uiState = { ...uiState, broadcastAudio: { ...uiState.broadcastAudio, status: "playing" } };
          render();
        };

        activeAudio.onpause = () => {
          // Only mark paused if it wasn't ended naturally (ended → ready, paused → paused)
          if (uiState.broadcastAudio.status === "playing") {
            uiState = { ...uiState, broadcastAudio: { ...uiState.broadcastAudio, status: "paused" } };
            render();
          }
        };

        activeAudio.onended = () => {
          uiState = { ...uiState, broadcastAudio: { ...uiState.broadcastAudio, status: "ready" } };
          activeAudio = null;
          render();
        };

        activeAudio.onerror = () => {
          uiState = {
            ...uiState,
            broadcastAudio: {
              ...uiState.broadcastAudio,
              status: "error",
              error: "音频播放失败，请稍后重试。",
            },
          };
          activeAudio = null;
          render();
        };

        activeAudio.play().catch(() => {
          // Autoplay blocked — treat as paused
          uiState = { ...uiState, broadcastAudio: { ...uiState.broadcastAudio, status: "paused" } };
          activeAudio = null;
          render();
        });
      },
      onPauseTts: () => {
        if (activeAudio && uiState.broadcastAudio.status === "playing") {
          activeAudio.pause();
          // status will transition to "paused" via onpause handler above
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
        if (animationTimer) { clearTimeout(animationTimer); animationTimer = null; }
        if (completionTimer) { clearTimeout(completionTimer); completionTimer = null; }
        clearState();
        uiState = {
          selectedResidentId: null,
          autoPlay: false,
          llmStatus: "idle",
          llmMessage: "",
          eventDirectorStatus: "idle",
          eventDirectorMessage: "",
          broadcastStatus: "idle",
          broadcastMessage: "",
          latestBroadcast: null,
          broadcastAudio: makeAudioState(),
          activeTaskAnimations: [],
          isAnimating: false,
          animationMessage: "",
          completionFeedback: null,
        };
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
