import { locations, phases, tasks } from "../data/seed.js";
import { buildResidentMoodView, buildTaskCompletionFeedback } from "../domain/residentMood.js";

/**
 * Enhance a task label with the current life scenario context.
 * @param {string} taskLabel
 * @param {object|null} activeScenario
 * @returns {string}
 */
function getEnhancedTaskLabel(taskLabel, activeScenario) {
  if (!activeScenario || !taskLabel) return taskLabel;
  return `${taskLabel}（${activeScenario.label}）`;
}

const LOCATION_ICONS = {
  garden: "./src/assets/ui/garden.svg",
  cafe: "./src/assets/ui/restaurant.svg",
  workshop: "./src/assets/ui/workshop.svg",
  plaza: "./src/assets/ui/plaza.svg",
  forest: "./src/assets/ui/forest.svg",
};

const residentAvatarSrc = {
  hua: "./src/assets/residents/hua.svg",
  yuan: "./src/assets/residents/yuan.svg",
  mimi: "./src/assets/residents/mimi.svg",
  zhou: "./src/assets/residents/zhou.svg",
  seven: "./src/assets/residents/seven.svg",
};

const decisionReasonLabels = {
  "energy low, needs rest": "体力偏低，今天更适合先休息一下。",
  "supplies low, help town forage": "小镇物资不多了，适合去森林采集。",
  "follows current assignment": "正在按照当前安排行动中。",
  "follows preferred task": "选择了自己更擅长也更喜欢的事情。",
  "social need high, seeks company": "社交需求较高，想和小伙伴聊聊天。",
  "achievement need high, seeks challenge": "成就需求较高，渴望有所突破。",
  "town comfort low, helps improve": "小镇舒适度不足，想为小镇出一份力。",
};

// ── Stage Coordinate System ──────────────────────────────────────────────────────

const stagePlaces = {
  garden: { label: "花园", x: 24, y: 34, icon: "🌸" },
  cafe:   { label: "餐厅", x: 52, y: 25, icon: "🍲" },
  workshop: { label: "工坊", x: 72, y: 43, icon: "🔨" },
  plaza:  { label: "广场", x: 48, y: 58, icon: "⛲" },
  forest: { label: "森林", x: 24, y: 70, icon: "🌲" },
};

// Offsets so multiple residents at same place don't overlap
const CHARACTER_OFFSETS = [
  { dx: -4.5, dy: 7 },
  { dx: 4.5,  dy: 7 },
  { dx: -7,   dy: -2 },
  { dx: 7,    dy: -2 },
  { dx: 0,    dy: 10 },
];

function getResidentStagePosition(resident, indexAtLocation) {
  const base = stagePlaces[resident.locationId] ?? stagePlaces.plaza;
  const offset = CHARACTER_OFFSETS[indexAtLocation % CHARACTER_OFFSETS.length];
  return {
    x: base.x + offset.dx,
    y: base.y + offset.dy,
  };
}

// ── Task Stage Effects (for future animation — currently used for task bubbles) ──

const taskStageEffects = {
  plant:   { effect: "bloom", bubble: "花园变得更有精神了。" },
  cook:    { effect: "steam",  bubble: "餐厅飘出了热气。" },
  repair:  { effect: "spark",  bubble: "工坊传来轻轻的敲打声。" },
  chat:    { effect: "chat",   bubble: "广场上的聊天声多了起来。" },
  forage:  { effect: "leaf",   bubble: "森林里传来树叶沙沙声。" },
  rest:    { effect: "rest",   bubble: "有人在安静地休息。" },
};

function getResidentAvatarImg(resident, size = 40) {
  const src = residentAvatarSrc[resident.id];
  const fallback = escapeHtml(resident.avatar);
  if (src) {
    return `<img class="resident-avatar-img" src="${src}" alt="${escapeHtml(resident.name)}" width="${size}" height="${size}" onerror="this.replaceWith(document.createTextNode('${fallback}'))" />`;
  }
  return fallback;
}
import { getCurrentPhase, getLocation, getResidentsAtLocation, getTask, getTopRelationships, getTownGoals, getTownTips } from "../domain/selectors.js";
import { buildChoiceWorldEffectView } from "../domain/choiceWorldEffect.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Safe text wrapper — returns fallback for null/undefined, otherwise String(value).
 * Use this instead of bare template interpolation for values that may be missing.
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string}
 */
function safeText(value, fallback = "") {
  return value == null ? fallback : String(value);
}

function pct(value) {
  return `${Math.round(value)}%`;
}

function meter(label, value, tone = "green") {
  const safeLabel = escapeHtml(label);
  const safeValue = Math.round(value);
  return `
    <div class="meter" aria-label="${safeLabel} ${safeValue}">
      <div class="meter__top">
        <span>${safeLabel}</span>
        <strong>${safeValue}</strong>
      </div>
      <div class="meter__track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${safeValue}">
        <span class="meter__bar meter__bar--${tone}" style="width:${pct(value)}"></span>
      </div>
    </div>
  `;
}

function renderAgentSummary(agent) {
  if (!agent) return "";
  const needs = agent.needs ?? { rest: 0, social: 0, achievement: 0 };
  const rawReason = agent.decisionReason ?? "";
  const chineseReason = decisionReasonLabels[rawReason] ?? rawReason;
  return `
    <div class="agent-summary">
      <p class="agent-reason">
        <span class="agent-reason__label">💭 想法：</span>${escapeHtml(chineseReason)}
      </p>
      <div class="agent-needs-row">
        <span class="agent-need-badge agent-need-badge--rest" title="休息需求">🌙 休息 ${Math.round(needs.rest)}</span>
        <span class="agent-need-badge agent-need-badge--social" title="社交需求">💬 社交 ${Math.round(needs.social)}</span>
        <span class="agent-need-badge agent-need-badge--achievement" title="成就需求">⭐ 成就 ${Math.round(needs.achievement)}</span>
      </div>
    </div>
  `;
}

function taskOptions(selectedId) {
  return tasks
    .map((task) => `<option value="${escapeHtml(task.id)}" ${task.id === selectedId ? "selected" : ""}>${escapeHtml(task.label)}</option>`)
    .join("");
}

// ── Unified Game HUD ────────────────────────────────────────────────────────────

function renderGameHud(state) {
  const phase = getCurrentPhase(state);
  const phaseSteps = phases
    .map((item, index) => `<span class="phase ${index === state.phaseIndex ? "phase--active" : ""}">${escapeHtml(item.label)}</span>`)
    .join("");

  return `
    <header class="game-hud">
      <div class="game-hud__brand">
        <span class="eyebrow">🏡 治愈系小镇模拟</span>
        <h1 class="game-hud__title">AI 小镇生活</h1>
        <div class="game-hud__links">
          <a class="game-hud__about-link" href="#project-meaning">了解这个小镇 →</a>
          <a class="game-hud__about-link game-hud__about-link--summary"
             href="./docs/V1_PROJECT_SUMMARY_SHOWCASE.html"
             target="_blank"
             rel="noopener noreferrer">V1 项目总结 →</a>
        </div>
      </div>
      <div class="game-hud__time" aria-label="当前天数和阶段">
        <span class="game-hud__day">第 ${state.day} 天</span>
        <strong class="game-hud__phase">${escapeHtml(phase.label)}</strong>
        <div class="phase-track">${phaseSteps}</div>
      </div>
      <div class="game-hud__resources" aria-label="小镇资源">
        ${meter("舒适度", state.town.comfort, "green")}
        <div class="stat-pill"><span>📦 物资</span><strong>${state.town.supplies}</strong></div>
        ${meter("精神", state.town.spirit, "gold")}
      </div>
    </header>
  `;
}

// ── Day Cycle Status Banner ─────────────────────────────────────────────────────

function renderDayCycleStatus(safeUiState, handlers = {}) {
  const dc = safeUiState.dayCycle;
  if (!dc || dc.status === "idle") return "";

  const statusIcons = {
    running: "⚙️",
    waiting_choice: "🎯",
    completed: "✅",
    error: "⚠️",
  };
  const statusClasses = {
    running: "day-cycle-status--running",
    waiting_choice: "day-cycle-status--waiting",
    completed: "day-cycle-status--completed",
    error: "day-cycle-status--error",
  };

  const icon = statusIcons[dc.status] ?? "⚙️";
  const cls = statusClasses[dc.status] ?? "";
  const ttsAudios = safeUiState.ttsAudios ?? {};

  // Completion feedback TTS button
  const cfTextKey = "completion_feedback:current";
  const cfTa = ttsAudios[cfTextKey] ?? {};
  const cfText = "本阶段行动完成";
  const completionTtsBtn = (handlers?.onPlayMimoTts)
    ? (() => {
      if (cfTa.status === "loading") return `<button class="mimo-tts-btn mimo-tts-btn--loading" disabled>🔊…</button>`;
      if (cfTa.status === "playing") return `<button class="mimo-tts-btn mimo-tts-btn--playing" data-action="pause-mimo-tts" data-audio-key="${escapeHtml(cfTextKey)}">⏸️</button>`;
      if (cfTa.status === "paused" || cfTa.status === "ready") return `<button class="mimo-tts-btn mimo-tts-btn--ready" data-action="resume-mimo-tts" data-audio-key="${escapeHtml(cfTextKey)}">▶️</button>`;
      if (cfTa.status === "error") return `<button class="mimo-tts-btn mimo-tts-btn--error" data-action="play-mimo-tts" data-audio-key="${escapeHtml(cfTextKey)}" data-text="${escapeHtml(cfText)}" data-scene="completion_feedback" data-resident-id="" data-beat-id="">⚠️</button>`;
      return `<button class="mimo-tts-btn" data-action="play-mimo-tts" data-audio-key="${escapeHtml(cfTextKey)}" data-text="${escapeHtml(cfText)}" data-scene="completion_feedback" data-resident-id="" data-beat-id="">🔈</button>`;
    })()
    : "";

  const isRunning = dc.status === "running";
  const isWaiting = dc.status === "waiting_choice";
  const isCompleted = dc.status === "completed";
  const isError = dc.status === "error";

  // Day-opening TTS button
  const dayOpenTextKey = "day_opening:current";
  const doTa = ttsAudios[dayOpenTextKey] ?? {};
  const dayOpenText = dc.scenarioId ? `今天的小镇围绕「${dc.scenarioId}」展开。` : "";
  const dayOpenTtsBtn = (isRunning && dayOpenText && handlers?.onPlayMimoTts)
    ? (() => {
      if (doTa.status === "loading") return `<button class="mimo-tts-btn mimo-tts-btn--loading" disabled>🔊…</button>`;
      if (doTa.status === "playing") return `<button class="mimo-tts-btn mimo-tts-btn--playing" data-action="pause-mimo-tts" data-audio-key="${escapeHtml(dayOpenTextKey)}">⏸️</button>`;
      if (doTa.status === "paused" || doTa.status === "ready") return `<button class="mimo-tts-btn mimo-tts-btn--ready" data-action="resume-mimo-tts" data-audio-key="${escapeHtml(dayOpenTextKey)}">▶️</button>`;
      if (doTa.status === "error") return `<button class="mimo-tts-btn mimo-tts-btn--error" data-action="play-mimo-tts" data-audio-key="${escapeHtml(dayOpenTextKey)}" data-text="${escapeHtml(dayOpenText)}" data-scene="day_opening" data-resident-id="" data-beat-id="">⚠️</button>`;
      return `<button class="mimo-tts-btn" data-action="play-mimo-tts" data-audio-key="${escapeHtml(dayOpenTextKey)}" data-text="${escapeHtml(dayOpenText)}" data-scene="day_opening" data-resident-id="" data-beat-id="">🔈 今日场景</button>`;
    })()
    : "";
  const stepText = dc.step || "处理中……";

  return `
    <div class="day-cycle-status ${cls}" aria-live="polite">
      <div class="day-cycle-status__header">
        <span class="day-cycle-status__icon">${icon}</span>
        <span class="day-cycle-status__label">${isRunning ? "🏠 小镇一天" : isWaiting ? "🎯 等待选择" : isCompleted ? "✅ 完成" : "⚠️ 出错"}</span>
      </div>
      <p class="day-cycle-status__step">${escapeHtml(stepText)}</p>
      ${dc.scenarioId && isRunning ? `<p class="day-cycle-status__scenario">🎬 ${escapeHtml(dc.scenarioId)}</p>` : ""}
      ${isError && dc.error ? `<p class="day-cycle-status__error">${escapeHtml(dc.error)}</p>` : ""}
      ${(completionTtsBtn || dayOpenTtsBtn) ? `<div class="day-cycle-status__tts-row">${completionTtsBtn}${dayOpenTtsBtn}</div>` : ""}
    </div>
  `;
}

// ── Left Column: Game Actions + Compact Goals ───────────────────────────────────

function renderGameActions(state, safeUiState, handlers = {}) {
  const nextPhaseLabel = state.phaseIndex === phases.length - 1 ? "🌙 结束今天" : `⏭️ 推进到${phases[state.phaseIndex + 1].label}`;
  const phase = getCurrentPhase(state);
  const isAnimating = safeUiState.isAnimating;
  const animMsg = safeUiState.animationMessage || "";

  // Game guide card
  const guideView = buildGameGuideView(state, safeUiState);
  const guideCardHtml = `
    <div class="game-guide" aria-label="游戏指引">
      <div class="game-guide__header">
        <span>🧭</span>
        <span class="game-guide__title">${safeText(guideView.title, "游戏指引")}</span>
      </div>
      <ul class="game-guide__steps">
        ${guideView.steps.map((step) => `
          <li class="game-guide__step ${step.done ? "game-guide__step--done" : ""} ${safeText(step.label) === safeText(guideView.currentStep) ? "game-guide__step--current" : ""}">
            <span class="game-guide__step-icon">${step.done ? "✅" : "○"}</span>
            <span class="game-guide__step-label">${safeText(step.label)}</span>
          </li>
        `).join("")}
      </ul>
      <p class="game-guide__next-action">💡 ${safeText(guideView.nextActionText, "观察小镇的动向吧")}</p>
    </div>
  `;

  // Animation banner shown while residents are traveling/acting
  const animBanner = isAnimating
    ? `<div class="game-actions__anim-banner" aria-live="polite">🚶 ${escapeHtml(animMsg)}</div>`
    : "";

  // Completion feedback banner after animation finishes
  const completionFeedback = safeUiState.completionFeedback;
  const completionBanner = completionFeedback
    ? `<div class="game-actions__completion-banner" aria-live="polite">✅ ${safeText(completionFeedback.message, "阶段完成")}</div>`
    : "";

  // Buttons disabled during animation (except auto-play toggle and new-town)
  const advancingDisabled = isAnimating ? "disabled" : "";
  const aiLoading = safeUiState.llmStatus === "loading" ? "disabled" : "";
  const eventLoading = safeUiState.eventDirectorStatus === "loading" ? "disabled" : "";
  const broadcastLoading = safeUiState.broadcastStatus === "loading" ? "disabled" : "";

  const dc = safeUiState.dayCycle ?? {};
  const dayCycleRunning = dc.status === "running";
  const dayCycleWaiting = dc.status === "waiting_choice";
  const dayCycleCompleted = dc.status === "completed";
  const dayCycleError = dc.status === "error";
  const dayCycleActive = dayCycleRunning || dayCycleWaiting || dayCycleCompleted || dayCycleError;
  const dayCycleDisabled = dayCycleActive || isAnimating ? "disabled" : "";

  const dayCycleBanner = dayCycleActive ? renderDayCycleStatus(safeUiState, handlers) : "";

  return `
    <div class="game-actions">
      <p class="game-actions__title">🎮 游戏操作</p>
      ${guideCardHtml}
      <div class="game-actions__stats">
        <span class="game-actions__stat">
          <span class="game-actions__stat-label">📅</span>
          <strong>第 ${state.day} 天</strong>
          <span class="game-actions__stat-phase">${escapeHtml(phase.label)}</span>
        </span>
      </div>
      ${animBanner}
      ${completionBanner}
      ${renderDayOpeningReflection(safeUiState.dayOpeningReflection)}
      ${dayCycleBanner}
      <div class="game-actions__section">
        <p class="game-actions__section-label">🏠 一日闭环</p>
        <button class="button button--primary button--day-cycle" type="button" data-action="run-town-day-cycle" ${dayCycleDisabled}>
          ${dayCycleRunning ? "⚙️ 推进中……" : dayCycleWaiting ? "🎯 等待选择……" : dayCycleCompleted ? "✅ 已完成" : dayCycleError ? "⚠️ 出错重试" : "🏠 推进小镇一天"}
        </button>
      </div>
      <div class="game-actions__section">
        <p class="game-actions__section-label">⏭️ 推进</p>
        <button class="button button--primary" type="button" data-action="advance" ${advancingDisabled}>
          ${isAnimating ? "居民行动中..." : escapeHtml(nextPhaseLabel)}
        </button>
        <button class="button button--ghost" type="button" data-action="run-day" ${advancingDisabled}>
          ${isAnimating ? "居民行动中..." : "🌙 结束今天"}
        </button>
      </div>
      <div class="game-actions__section">
        <p class="game-actions__section-label">🤖 AI 管家</p>
        <button class="button button--ai" type="button" data-action="minimax-plan" ${aiLoading || advancingDisabled}>
          ${safeUiState.llmStatus === "loading" ? "🤖 管家思考中..." : "🤖 AI 管家安排"}
        </button>
      </div>
      <div class="game-actions__section">
        <p class="game-actions__section-label">🎭 事件导演</p>
        <button class="button button--event" type="button" data-action="minimax-event" ${eventLoading || advancingDisabled}>
          ${safeUiState.eventDirectorStatus === "loading" ? "🎭 观察中..." : "🎭 生成小镇事件"}
        </button>
      </div>
      <div class="game-actions__section">
        <p class="game-actions__section-label">📻 氛围广播</p>
        <button class="button button--broadcast" type="button" data-action="minimax-broadcast" ${broadcastLoading || advancingDisabled}>
          ${safeUiState.broadcastStatus === "loading" ? "📻 广播中..." : "📻 生成小镇广播"}
        </button>
      </div>
      <div class="game-actions__section">
        <p class="game-actions__section-label">🎙️ 居民语音互动</p>
        <button class="button ${safeUiState.residentVoiceInteraction?.enabled ? "button--voice-on" : "button--voice-off"}" type="button" data-action="toggle-resident-voice">
          ${safeUiState.residentVoiceInteraction?.enabled ? "🔊 居民语音 ON" : "🎙️ 居民语音 OFF"}
        </button>
        ${safeUiState.residentVoiceInteraction?.enabled ? '<p class="game-actions__voice-hint">开启后，可点击居民对白和选择反应播放 MiMo 语音</p>' : ""}
      </div>
      <div class="game-actions__section">
        <p class="game-actions__section-label">💬 居民对话演出</p>
        ${safeUiState.residentConversation?.status === "playing" ? `<span class="conversation-status conversation-status--playing">🔊 对话演出中</span>` : ""}
        ${safeUiState.residentConversation?.status === "paused" ? `<span class="conversation-status conversation-status--paused">⏸️ 对话已暂停</span>` : ""}
        ${(!safeUiState.residentConversation?.enabled || safeUiState.residentConversation?.status === "idle" || safeUiState.residentConversation?.status === "completed" || safeUiState.residentConversation?.status === "error") ? `<button class="button button--conversation-start" type="button" data-action="toggle-conversation">💬 开启对话演出</button>` : ""}
      </div>
      <div class="game-actions__section">
        <p class="game-actions__section-label">⚙️ 其他</p>
        <button class="button ${safeUiState.autoPlay ? "button--live" : "button--ghost"}" type="button" data-action="toggle-auto">
          ${safeUiState.autoPlay ? "⏸️ 暂停" : "▶️ 自动推进"}
        </button>
        <button class="button button--ghost" type="button" data-action="reset-assignments">🔄 重置安排</button>
        <button class="button button--ghost" type="button" data-action="new-town">🏠 新小镇</button>
      </div>
    </div>
  `;
}

// ── Day Opening Reflection ─────────────────────────────────────────────────────────

/**
 * Render the day opening reflection in the left panel.
 * Shown when a new day cycle starts and there is prior player memory.
 * @param {object|null} openingReflection
 * @returns {string} HTML or empty string
 */
function renderDayOpeningReflection(openingReflection) {
  if (!openingReflection || !openingReflection.id) return "";
  const { title, summary, sourceType, memoryDetail } = openingReflection;
  const icon = sourceType === "fallback" ? "☀️" : "🌿";

  // Show a compact memory reference line when available
  const memoryRefLine = memoryDetail
    ? `<span class="day-opening-reflection__memory-ref">📖 ${escapeHtml(memoryDetail.slice(0, 40))}${memoryDetail.length > 40 ? "…" : ""}</span>`
    : "";

  return `
    <div class="day-opening-reflection" aria-label="昨日回响" aria-live="polite">
      <div class="day-opening-reflection__header">
        <span>${icon}</span>
        <span class="day-opening-reflection__title">${safeText(title, "昨日回响")}</span>
      </div>
      <p class="day-opening-reflection__summary">${safeText(summary)}</p>
      ${memoryRefLine}
    </div>
  `;
}

/**
 * Render the recommended resident voice clip when voice interaction is enabled.
 * Always renders a stable container (even when empty) to prevent layout shift.
 * @param {object} voiceState - residentVoiceInteraction from uiState
 * @param {Array} clips - residentVoiceClips array
 * @param {object} ttsAudios - tts audio cache
 * @returns {string} HTML or empty string
 */
function renderRecommendedVoiceClip(voiceState, clips, ttsAudios, conversationStatus) {
  if (!voiceState?.enabled) return "";

  const isConversationActive = conversationStatus === "playing" || conversationStatus === "paused";

  // During conversation, suppress the entire recommended-voice card to reduce noise
  if (isConversationActive) return "";

  const recommendedKey = voiceState.recommendedClipKey ?? "";
  const clip = clips.find((c) => c.key === recommendedKey) ?? clips[0];

  // Always render container — empty state uses --empty modifier class
  const hasClip = Boolean(clip);

  const ta = hasClip ? (ttsAudios[clip.key] ?? {}) : {};
  const isLoading = ta.status === "loading";
  const isPlaying = ta.status === "playing";
  const isPaused = ta.status === "paused";
  const isReady = ta.status === "ready";
  const hasError = ta.status === "error";

  let btn = "";
  if (hasClip) {
    if (isLoading) {
      btn = `<button class="mimo-tts-btn mimo-tts-btn--loading" disabled>🔊…</button>`;
    } else if (isPlaying) {
      btn = `<button class="mimo-tts-btn mimo-tts-btn--playing" data-action="pause-mimo-tts" data-audio-key="${escapeHtml(clip.key)}">⏸️</button>`;
    } else if (isPaused || isReady) {
      btn = `<button class="mimo-tts-btn mimo-tts-btn--ready" data-action="resume-mimo-tts" data-audio-key="${escapeHtml(clip.key)}">▶️</button>`;
    } else if (hasError) {
      btn = `<button class="mimo-tts-btn mimo-tts-btn--error" data-action="play-mimo-tts" data-audio-key="${escapeHtml(clip.key)}" data-text="${escapeHtml(clip.text)}" data-scene="${escapeHtml(clip.scene)}" data-resident-id="${escapeHtml(clip.residentId)}" data-beat-id="">⚠️</button>`;
    } else {
      btn = `<button class="mimo-tts-btn" data-action="play-mimo-tts" data-audio-key="${escapeHtml(clip.key)}" data-text="${escapeHtml(clip.text)}" data-scene="${escapeHtml(clip.scene)}" data-resident-id="${escapeHtml(clip.residentId)}" data-beat-id="">🔈 MiMo 播放</button>`;
    }
  }

  const actionsHtml = btn ? `<div class="recommended-voice__actions">${btn}</div>` : "";

  return `
    <div class="recommended-voice ${!hasClip ? "recommended-voice--empty" : ""}" aria-label="推荐收听" aria-live="polite">
      ${hasClip ? `
      <div class="recommended-voice__header">
        <span>🎧</span>
        <span class="recommended-voice__label">推荐收听：${safeText(clip.title ?? clip.residentName ?? "", "推荐收听")}</span>
        <span class="recommended-voice__provider">MiMo</span>
      </div>
      <p class="recommended-voice__text">${escapeHtml(clip.text ?? "")}</p>
      ${clip.reason ? `<p class="recommended-voice__reason">${escapeHtml(clip.reason)}</p>` : ""}
      ${actionsHtml}
      ` : `
      <p class="recommended-voice__empty">${escapeHtml(voiceState.hint ?? "暂无推荐")}</p>
      `}
    </div>
  `;
}

function renderCompactGoals(state) {
  const goals = getTownGoals(state);
  const completedCount = goals.filter((goal) => goal.value >= goal.target).length;
  const topGoals = goals.slice(0, 3);
  return `
    <div class="compact-goals">
      <div class="compact-goals__head">
        <span>🎯 今日目标</span>
        <span class="panel-badge">${completedCount}/${goals.length}</span>
      </div>
      <div class="goal-list">
        ${topGoals
          .map((goal) => {
            const progress = Math.min(100, Math.round((goal.value / goal.target) * 100));
            return `
              <div class="goal goal--compact ${goal.value >= goal.target ? "goal--done" : ""}">
                <div class="goal__top">
                  <strong>${escapeHtml(goal.label)}</strong>
                  <span>${Math.round(goal.value)}/${goal.target}</span>
                </div>
                <div class="goal__bar" aria-hidden="true"><i style="width:${progress}%"></i></div>
                ${goal.detail ? `<p class="goal__detail">${escapeHtml(goal.detail)}</p>` : ""}
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

// ── LLM Status ────────────────────────────────────────────────────────────────

function renderLlmStatus(uiState) {
  if (!uiState.llmMessage) return "";

  const statusIcon = {
    idle: "🤖",
    loading: "🤖",
    ready: "✨",
    error: "⚠️",
    unconfigured: "⚙️",
  }[uiState.llmStatus] ?? "🤖";

  const title = {
    idle: "AI 小镇管家",
    loading: "AI 管家思考中",
    ready: "AI 管家已安排",
    error: "AI 管家遇到问题",
    unconfigured: "AI 管家待配置",
  }[uiState.llmStatus] ?? "AI 小镇管家";

  const badgeLabel = {
    idle: "待机",
    loading: "思考中",
    ready: "已就绪",
    error: "异常",
    unconfigured: "待配置",
  }[uiState.llmStatus] ?? uiState.llmStatus;

  let message = uiState.llmMessage;

  let hint = "";
  try {
    const parsed = JSON.parse(uiState.llmMessage);
    if (parsed.error) {
      message = parsed.error;
      if (parsed.technicalError && parsed.fallback) {
        hint = "在 config.local.json 中配置 MiniMax-M3 后即可启用。";
      }
    }
  } catch {
    // Not JSON, use as-is
  }

  if (uiState.llmStatus === "error" &&
      (uiState.llmMessage.includes("Failed to fetch") ||
       uiState.llmMessage.includes("NetworkError") ||
       uiState.llmMessage.includes("fetch") ||
       uiState.llmMessage.includes("AI 管家遇到了一点问题") ||
       uiState.llmMessage.includes("AI 管家没有返回") ||
       uiState.llmMessage.includes("AI 管家思考超时"))) {
    // Already friendly
  } else if (uiState.llmStatus === "error" && !message.includes("AI 管家")) {
    message = "AI 管家遇到了一点问题，请稍后重试。";
  }

  return `
    <section class="panel llm-status llm-status--${escapeHtml(uiState.llmStatus)}">
      <div class="panel__head">
        <h2>${statusIcon} ${escapeHtml(title)}</h2>
        <span class="llm-status-badge llm-status-badge--${escapeHtml(uiState.llmStatus)}">${escapeHtml(badgeLabel)}</span>
      </div>
      <p>${escapeHtml(message)}</p>
      ${hint ? `<p class="llm-status__hint">💡 ${escapeHtml(hint)}</p>` : ""}
    </section>
  `;
}

// ── Event Director Status ─────────────────────────────────────────────────────

/**
 * Render the Event Director card — shows event choice entry when available.
 * Uses buildEventChoiceEntryView for clean state separation.
 *
 * @param {object} state
 * @param {object} uiState
 * @returns {string} HTML
 */
function renderEventDirectorStatus(state, uiState) {
  const eventView = buildEventChoiceEntryView(state, uiState);

  // idle / empty state: compact single-line prompt
  if (!eventView.eventId) {
    return `
      <div class="event-director event-director--idle">
        <span class="event-director__idle-icon">🎭</span>
        <span class="event-director__idle-label">小镇事件导演：</span>
        <span class="event-director__idle-text">让 M3 观察小镇，生成一个今天的小事件。</span>
      </div>
    `;
  }

  // chosen state
  if (eventView.status === "chosen") {
    return `
      <section class="panel event-director event-director--chosen">
        <div class="panel__head">
          <h2>✨ 刚刚的选择</h2>
          <span class="llm-status-badge llm-status-badge--ready">已选择</span>
        </div>
        <div class="event-director__chosen-label">
          你选择了：${safeText(eventView.chosenChoiceLabel, "做出了选择")}
        </div>
        ${eventView.resultText ? `<p class="event-director__chosen-result">${safeText(eventView.resultText)}</p>` : ""}
        <div class="event-director__memory-hint">🌿 这件事已被小镇记住</div>
      </section>
    `;
  }

  // loading state
  if (uiState.eventDirectorStatus === "loading") {
    return `
      <section class="panel event-director event-director--loading">
        <div class="panel__head">
          <h2>🎭 小镇事件导演</h2>
          <span class="llm-status-badge llm-status-badge--loading">思考中</span>
        </div>
        <p class="event-director__loading-text">M3 正在观察居民和小镇动态……</p>
      </section>
    `;
  }

  // error state
  if (uiState.eventDirectorStatus === "error") {
    return `
      <section class="panel event-director event-director--error">
        <div class="panel__head">
          <h2>⚠️ 小镇事件导演</h2>
          <span class="llm-status-badge llm-status-badge--error">异常</span>
        </div>
        <p>${escapeHtml(uiState.eventDirectorMessage || "事件导演暂时没有灵感，请稍后再试。")}</p>
        <p class="llm-status__hint">💡 检查 MiniMax 配置或稍后重试。</p>
      </section>
    `;
  }

  // ready state — show event title, summary, place, residents, and choices
  const residentNames = eventView.residentNames;
  const metaLine = residentNames.length > 0
    ? `📍 ${escapeHtml(eventView.placeLabel)} · 👥 ${residentNames.map(escapeHtml).join("、")}`
    : `📍 ${escapeHtml(eventView.placeLabel)}`;

  const choicesHtml = eventView.choices.map((choice) => `
    <button
      class="event-choice"
      type="button"
      data-action="choose-event"
      data-event-id="${escapeHtml(eventView.eventId ?? "")}"
      data-choice-id="${escapeHtml(choice.id)}"
    >
      <span class="event-choice__label">${escapeHtml(choice.label)}</span>
      ${choice.preview ? `<span class="event-choice__preview">${escapeHtml(choice.preview)}</span>` : ""}
    </button>
  `).join("");

  return `
    <section class="panel event-director event-director--ready">
      <div class="panel__head">
        <h2>✨ 小镇事件</h2>
        <span class="llm-status-badge llm-status-badge--ready">待选择</span>
      </div>
      ${eventView.title ? `<p class="event-director__title">${safeText(eventView.title)}</p>` : ""}
      ${eventView.summary ? `<p class="event-director__summary">${safeText(eventView.summary)}</p>` : ""}
      <div class="event-director__meta">${metaLine}</div>
      <div class="event-director__choices">
        <p class="event-director__choices-prompt">你要怎么做？</p>
        <div class="event-director__choice-buttons">
          ${choicesHtml}
        </div>
      </div>
    </section>
  `;
}

// ── Resident Dialogue Panel ──────────────────────────────────────────────────────

/**
 * Render the right-panel resident dialogue/conversation record.
 * No TTS buttons here — voice playback is handled by the compact chip in town-stage.
 * Shows either a session-style conversation record or scene beats.
 * @param {object} params
 * @param {Array} [params.beats] - scene beats (fallback when no conversation active)
 * @param {object} [params.conversationQueue] - conversation queue from residentConversation
 * @param {number} [params.currentLineIndex] - current conversation line index
 * @param {string} [params.visibleText] - current typewriter text
 * @param {object} [params.sessionState] - session from buildResidentConversationSession
 */
function renderResidentDialoguePanel({ beats = [], conversationQueue = [], currentLineIndex = 0, visibleText = "", sessionState = null, ttsAudios = {} } = {}) {
  // Prefer active conversation queue if available
  if (conversationQueue && conversationQueue.length > 0) {
    const participants = sessionState?.participants ?? [];
    const locationLabel = sessionState?.locationLabel ?? "";
    const locationHtml = locationLabel ? `<span class="dialogue-session__location">📍 ${escapeHtml(locationLabel)}</span>` : "";
    const participantNames = participants.map((p) => escapeHtml(p.residentName)).join(" ↔ ");

    const itemsHtml = conversationQueue
      .map((line, idx) => {
        const isCurrent = idx === currentLineIndex;
        const isPast = idx < currentLineIndex;
        // Show the typewriter visibleText for current line, full text for past lines
        const displayText = isCurrent ? (visibleText || line.text) : (isPast ? line.text : "");
        if (!displayText) return ""; // Don't show future lines
        const audioKey = line.audioKey ?? "";
        const voiceStatus = ttsAudios[audioKey]?.status ?? "idle";
        // Only show voice status for current line; historical lines don't show "已就绪"
        const voiceStatusLabel = (() => {
          if (!isCurrent) return "";
          return ({
            loading: "生成中",
            playing: "播放中",
            paused: "已暂停",
            error: "语音异常",
          }[voiceStatus] ?? "");
        })();
        return `<div class="dialogue-beat ${isCurrent ? "dialogue-beat--current" : ""}" data-conversation-audio-key="${escapeHtml(audioKey)}" data-voice-status="${escapeHtml(voiceStatus)}">
          <span class="dialogue-beat__name">${escapeHtml(line.speakerName ?? "居民")}：</span>
          <span class="dialogue-beat__text">${escapeHtml(displayText)}</span>
          ${voiceStatusLabel ? `<span class="dialogue-beat__voice-status">${escapeHtml(voiceStatusLabel)}</span>` : ""}
        </div>`;
      })
      .join("");

    if (!itemsHtml) return "";
    return `
      <div class="panel dialogue-beats-panel">
        <div class="panel__head">
          <h2>💬 居民对话</h2>
        </div>
        ${participantNames ? `<div class="dialogue-session__header">${locationHtml}<span class="dialogue-session__participants">${participantNames}</span></div>` : ""}
        <div class="dialogue-beats-list">
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  // No conversation active — show beats as dialogue items if available
  if (beats && beats.length > 0) {
    const itemsHtml = beats
      .filter((b) => b.dialogue)
      .map((b) => `<div class="dialogue-beat">
        <span class="dialogue-beat__name">${escapeHtml(b.residentName ?? "居民")}：</span>
        <span class="dialogue-beat__text">${escapeHtml(b.dialogue)}</span>
      </div>`)
      .join("");

    if (itemsHtml) {
      return `
        <div class="panel dialogue-beats-panel">
          <div class="panel__head">
            <h2>💬 居民对话</h2>
          </div>
          <div class="dialogue-beats-list">
            ${itemsHtml}
          </div>
        </div>
      `;
    }
  }

  // No conversation and no beats — show empty state
  return `
    <div class="panel dialogue-beats-panel">
      <div class="panel__head">
        <h2>💬 居民对话</h2>
      </div>
      <p class="dialogue-beats-empty">居民们还没有开始聊天</p>
    </div>
  `;
}

// ── Atmosphere Panel ─────────────────────────────────────────────────────────────

const MOOD_LABELS = {
  warm: "温暖",
  calm: "平静",
  lively: "活泼",
  tired: "疲惫",
  hopeful: "充满希望",
  tense: "紧张",
};

function renderAtmospherePanel(state, uiState) {
  const latestBc = uiState.latestBroadcast;
  const statusLabels = {
    idle: "尚未生成",
    loading: "生成中…",
    ready: "已生成",
    error: "生成失败",
  };
  const statusText = statusLabels[uiState.broadcastStatus ?? "idle"] ?? "尚未生成";

  const moodMap = { warm: "温暖", calm: "平静", lively: "活泼", tired: "疲惫", hopeful: "充满希望", tense: "紧张" };
  const placeMap = { garden: "花园", cafe: "咖啡馆", workshop: "工坊", plaza: "广场", forest: "森林" };

  const ba = uiState.broadcastAudio ?? { status: "idle", text: "", audioUrl: null, error: null };
  // Normalize generating → loading for backward compatibility with existing tests
  const baStatus = ba.status === "generating" ? "loading" : (ba.status ?? "idle");

  // TTS button: only handles generation (idle) and re-generation (error/retry)
  // Only disabled during loading to prevent double-generation
  const ttsButtonDisabled = baStatus === "loading" ? "disabled" : "";
  const ttsButtonClass = {
    idle: "button--broadcast",
    loading: "button--ghost",
    ready: "button--broadcast",
    playing: "button--broadcast",
    paused: "button--broadcast",
    error: "button--broadcast",
  }[baStatus] ?? "button--broadcast";
  const ttsButtonLabel = {
    idle: "🔊 MiniMax 生成语音",
    loading: "🔊 MiniMax 生成中…",
    ready: "🔊 MiniMax 生成语音",
    playing: "🔊 MiniMax 生成语音",
    paused: "🔊 MiniMax 生成语音",
    error: "⚠️ MiniMax 重新生成",
  }[baStatus] ?? "🔊 MiniMax 生成语音";

  // Play button: handles play/pause/continue toggle
  // Always clickable when audio exists (ready/paused/playing)
  const hasAudio = ba.audioUrl && baStatus !== "loading";
  const playButtonClass = baStatus === "playing" ? "button--live" : "button--ghost";
  const playButtonLabel = baStatus === "playing" ? "⏸️ MiniMax 暂停" : baStatus === "paused" ? "▶️ MiniMax 继续" : "▶️ MiniMax 播放";
  const playButtonDisabled = !hasAudio || baStatus === "loading" || baStatus === "error" ? "disabled" : "";
  const showPlayButton = hasAudio && baStatus !== "loading" && baStatus !== "error";
  const hasError = baStatus === "error" && ba.error;

  // Friendly error message — never expose API keys or trace IDs
  const friendlyError = hasError
    ? ba.error
        // Strip trace_id / trace-id labels and their values
        .replace(/trace[_-]?id[:\s][^,;\)]*/gi, "[已隐藏]")
        // Replace API key patterns: sk-..., api_key, tp-..., and generic key-like tokens
        .replace(/\b(sk|tp|api[_-]?key)[\w-]*/gi, "[已隐藏]")
        // Collapse any resulting brackets or artifacts
        .replace(/\s+/g, " ")
        .trim()
    : "";
  const debugCodeLabel = hasError && ba.debugCode ? `调试码：${ba.debugCode}` : "";

  // TTS status indicator for the panel badge
  const ttsStatusLine = baStatus !== "idle"
    ? {
        loading: "语音生成中…",
        ready: "可播放",
        playing: "播放中…",
        paused: "已暂停",
        error: "语音生成失败",
      }[baStatus] ?? ""
    : "";

  return `
    <section class="panel atmosphere-panel">
      <div class="panel__head">
        <h2>🎧 小镇氛围</h2>
        <span class="panel-badge">${escapeHtml(statusText)}</span>
        ${latestBc && ttsStatusLine ? `<span class="panel-badge panel-badge--tts">🎙️ MiniMax ${escapeHtml(ttsStatusLine)}</span>` : ""}
      </div>
      ${uiState.activeScenario ? `
        <div class="atmosphere-scenario">
          <span class="atmosphere-scenario__label">🎬 今日场景</span>
          <span class="atmosphere-scenario__name">${escapeHtml(uiState.activeScenario.label)}</span>
          <span class="atmosphere-scenario__tone">${escapeHtml(uiState.activeScenario.tone)}</span>
        </div>
      ` : ""}
      ${renderRecommendedVoiceClip(uiState.residentVoiceInteraction, uiState.residentVoiceClips, uiState.ttsAudios, uiState.residentConversation?.status)}
      ${latestBc ? `
        <div class="atmosphere-broadcast-preview">
          <p class="atmosphere-broadcast-preview__title">${safeText(latestBc.title, "未命名广播")}</p>
          <p class="atmosphere-broadcast-preview__script">${safeText(latestBc.script?.slice(0, 120))}${latestBc.script?.length > 120 ? "…" : ""}</p>
          <div class="atmosphere-broadcast-preview__tags">
            <span class="atmosphere-tag">${escapeHtml(moodMap[latestBc.mood] ?? latestBc.mood ?? "温暖")}</span>
            <span class="atmosphere-tag">${escapeHtml(latestBc.musicMood ?? "")}</span>
            <span class="atmosphere-tag">📍 ${escapeHtml(placeMap[latestBc.placeId] ?? "广场")}</span>
          </div>
          ${latestBc.musicPrompt ? `<p class="atmosphere-broadcast-preview__music">🎵 ${escapeHtml(latestBc.musicPrompt.slice(0, 80))}</p>` : ""}
          ${(latestBc.memoryReferences && latestBc.memoryReferences.length > 0) ?
            `<p class="atmosphere-broadcast-preview__memory-refs">📖 ${escapeHtml(latestBc.memoryReferences.slice(0, 2).join(" · "))}</p>` : ""}
        </div>
        <div class="atmosphere-tts-row">
          <button
            class="button ${ttsButtonClass}"
            type="button"
            data-action="generate-tts"
            ${ttsButtonDisabled}
          >
            ${escapeHtml(ttsButtonLabel)}
          </button>
          ${showPlayButton ? `
            <button class="button ${playButtonClass}" type="button" data-action="play-tts" ${playButtonDisabled}>
              ${escapeHtml(playButtonLabel)}
            </button>
          ` : ""}
          ${hasError && friendlyError ? `<span class="tts-error-hint" title="${escapeHtml(debugCodeLabel || "")}">⚠️ ${escapeHtml(friendlyError)}${debugCodeLabel ? ` <span class="debug-code">(${debugCodeLabel})</span>` : ""}</span>` : ""}
        </div>
      ` : `
        <p class="atmosphere-empty">让 M3 根据今天的小镇状态，写一段早安或晚间广播。</p>
      `}
    </section>
  `;
}

// ── Resident Status helpers ────────────────────────────────────────────────────

function residentStatus(resident) {
  if (resident.energy < 30) return { id: "tired", label: "疲惫 😴" };
  if (resident.mood < 45) return { id: "low-mood", label: "低落 😔" };
  if (resident.mood >= 82) return { id: "happy", label: "开心 😊" };
  return { id: "steady", label: "平稳 🙂" };
}

// ── Town Stage (Map) ──────────────────────────────────────────────────────────

function renderPlaceLabel(placeId, isActive, anim, choiceAffected) {
  const place = stagePlaces[placeId];
  if (!place) return "";
  const activeClass = isActive ? " stage-place-label--active" : "";
  const travelingClass = anim?.traveling ? " stage-place-label--traveling" : "";
  const taskClass = anim ? ` stage-place-label--task stage-place-label--effect-${escapeHtml(anim.effect)}` : "";
  const placeEffectClass = anim?.placeEffect ? ` stage-place-label--place-effect-${escapeHtml(anim.placeEffect)}` : "";
  const choiceAffectedClass = choiceAffected ? " stage-place-label--choice-affected" : "";
  const effectAnchor = anim
    ? `<span class="stage-effect-anchor stage-effect-anchor--${escapeHtml(anim.effect)} stage-effect-anchor--${escapeHtml(anim.placeEffect ?? anim.effect)}" aria-hidden="true"></span>`
    : "";

  return `
    <div class="stage-place-label stage-place-label--${escapeHtml(placeId)}${activeClass}${travelingClass}${taskClass}${placeEffectClass}${choiceAffectedClass}"
         style="left:${place.x}%; top:${place.y}%;"
         aria-label="${escapeHtml(place.label)}">
      <span class="stage-place-label__icon">${place.icon}</span>
      <span class="stage-place-label__name">${escapeHtml(place.label)}</span>
      ${effectAnchor}
    </div>
  `;
}


/**
 * Render a small MiMo voice indicator on a stage character.
 * Only shown when voice interaction is enabled and the resident has a dialogue beat.
 */
function renderCharacterVoiceIndicator(resident, beat, voiceState, ttsAudios) {
  if (!voiceState?.enabled) return "";
  if (!beat?.dialogue) return "";
  const audioKey = 'resident_dialogue:' + resident.id + ':' + (beat.id ?? '');
  const ta = ttsAudios[audioKey] ?? {};
  if (ta.status === 'playing') {
    return `<button class="stage-character__voice-btn stage-character__voice-btn--playing" type="button" data-action="pause-mimo-tts" data-audio-key="${escapeHtml(audioKey)}" title="暂停 ${escapeHtml(resident.name)} 的对白">🔊</button>`;
  }
  if (ta.status === 'loading') {
    return `<button class="stage-character__voice-btn stage-character__voice-btn--loading" type="button" disabled title="加载中">🔊…</button>`;
  }
  if (ta.status === 'paused' || ta.status === 'ready') {
    return `<button class="stage-character__voice-btn stage-character__voice-btn--paused" type="button" data-action="resume-mimo-tts" data-audio-key="${escapeHtml(audioKey)}" title="继续播放 ${escapeHtml(resident.name)} 的对白">▶️</button>`;
  }
  if (ta.status === 'error') {
    return `<button class="stage-character__voice-btn stage-character__voice-btn--error" type="button" data-action="play-mimo-tts" data-audio-key="${escapeHtml(audioKey)}" data-text="${escapeHtml(beat.dialogue ?? '')}" data-scene="resident_dialogue" data-resident-id="${escapeHtml(resident.id)}" data-beat-id="${escapeHtml(beat.id ?? '')}" title="重试播放 ${escapeHtml(resident.name)} 的对白">⚠️</button>`;
  }
  return `<button class="stage-character__voice-btn stage-character__voice-btn--idle" type="button" data-action="play-mimo-tts" data-audio-key="${escapeHtml(audioKey)}" data-text="${escapeHtml(beat.dialogue ?? '')}" data-scene="resident_dialogue" data-resident-id="${escapeHtml(resident.id)}" data-beat-id="${escapeHtml(beat.id ?? '')}" title="播放 ${escapeHtml(resident.name)} 的对白">🔈</button>`;
}

function renderStageCharacter(resident, position, taskLabel, status, isSelected, anim, completionResult, moodView, activeScenario, beat, residentVoiceInteraction = null, ttsAudios = {}, residentConversation = null, conversationRole = null, isChoiceAffected = false, choiceReaction = null) {
  const toX = position.x;
  const toY = position.y;
  const selectedClass = isSelected ? " stage-character--selected" : "";
  const statusClass = ` stage-character--${escapeHtml(status.id)}`;

  let extraClasses = "";
  let extraStyles = "";
  let propHtml = "";

  if (anim) {
    const fromPlace = stagePlaces[anim.fromPlaceId ?? anim.toPlaceId];
    const toPlace = stagePlaces[anim.toPlaceId];
    const fromX = fromPlace?.x ?? toX;
    const fromY = fromPlace?.y ?? toY;

    // Determine direction based on horizontal movement
    let faceDir = "none";
    if (anim.traveling && fromX !== toX) {
      faceDir = toX > fromX ? "right" : "left";
    }

    const gaitClass = anim.gait ? ` stage-character--gait-${escapeHtml(anim.gait)}` : "";
    const faceClass = faceDir !== "none" ? ` stage-character--face-${escapeHtml(faceDir)}` : "";
    const travelClass = anim.traveling ? " stage-character--traveling" : "";
    const actionClass = ` stage-character--${escapeHtml(anim.action)}`;
    const activeClass = " stage-character--active";
    // Presentation class: "is-farming", "is-chatting", "is-resting", etc.
    const presentationClass = anim.presentationClass ? ` stage-character--${escapeHtml(anim.presentationClass)}` : "";
    // Motion class for the sprite: "motion-work", "motion-calm", etc.
    const motionClass = anim.motion ? ` motion-${escapeHtml(anim.motion)}` : "";

    extraClasses = `${activeClass}${travelClass}${gaitClass}${faceClass}${actionClass}${presentationClass}${motionClass}`;
    extraStyles = anim.traveling
      ? `--from-x:${fromX}%; --from-y:${fromY}%; --to-x:${toX}%; --to-y:${toY}%; left:${toX}%; top:${toY}%;`
      : `left:${toX}%; top:${toY}%;`;

    // Prop element shown as a small item near the character
    if (anim.prop) {
      const propClass = anim.propClass ?? "prop--tool";
      propHtml = `<span class="stage-character__prop stage-character__${escapeHtml(propClass)}" aria-hidden="true">${escapeHtml(anim.prop)}</span>`;
    }
  } else {
    extraStyles = `left:${toX}%; top:${toY}%;`;
  }

  const task = taskLabel ? escapeHtml(taskLabel) : "";
  const actionBubble = anim
    ? `<span class="stage-character__action-bubble">${escapeHtml(anim.bubble)}</span>`
    : "";

  // Scene dialogue bubble — hidden for conversation participants (speaker bubble takes over)
  // Non-participants still show their scene beat bubble
  const isParticipant = conversationRole?.isParticipant ?? false;
  const dialogueBubble = (!isParticipant && beat?.dialogue)
    ? (anim
        ? `<span class="stage-character__dialogue stage-character__dialogue--light">${escapeHtml(beat.dialogue.slice(0, 20))}</span>`
        : `<span class="stage-character__dialogue stage-character__dialogue--scenario">${escapeHtml(beat.dialogue.slice(0, 28))}</span>`)
    : "";

  // Conversation bubble — shown when this resident is the current speaker
  // Shows immediately when the current line is activated (text or visibleText), not waiting for audio
  const currentLine = residentConversation?.queue?.[residentConversation?.currentIndex];
  const isSpeaker = conversationRole?.isSpeaker ?? false;
  const isConversationActive = conversationRole?.isConversationActive ?? false;
  const conversationText = residentConversation?.visibleText || currentLine?.text || "";
  const conversationBubble = (isConversationActive && isSpeaker && conversationText)
    ? `<span class="stage-character__dialogue stage-character__dialogue--conversation" data-conversation-visible-text="${escapeHtml(currentLine?.id ?? '')}">${escapeHtml(conversationText)}</span>`
    : "";

  // Speaker / listener CSS classes
  const speakerClass = isSpeaker ? " stage-character--speaking" : "";
  const listenerClass = (isConversationActive && conversationRole?.isListener) ? " stage-character--listening" : "";
  const participantClass = isParticipant ? " stage-character--conversation-participant" : "";

  // Choice reaction: shown on residents affected by a player choice.
  // Use sanitizeChoiceReactionLabel as a safety net to prevent place-personification.
  const choiceAffectedClass = isChoiceAffected ? " stage-character--choice-affected" : "";
  const rawReactionLabel = choiceReaction?.contextLabel ?? choiceReaction?.reactionText ?? "";
  const safeReactionLabel = choiceReaction
    ? sanitizeChoiceReactionLabel(rawReactionLabel, choiceReaction.residentName ?? "居民", "小镇")
    : "";
  const choiceReactionBubble = safeReactionLabel
    ? `<span class="stage-character__choice-reaction">${escapeHtml(safeReactionLabel)}</span>`
    : "";

  // Completion badge shown after animation
  const completionBadge = completionResult
    ? `<span class="stage-character__completion-badge" title="${escapeHtml(completionResult.label)}">${escapeHtml(completionResult.icon)}</span>`
    : "";

  // Mood icon (shown when no completion badge is active)
  const moodIconHtml = (!completionResult && moodView)
    ? `<span class="stage-character__mood ${escapeHtml(moodView.moodCssClass)}" title="${escapeHtml(moodView.moodLabel)}">${moodView.moodIcon}</span>`
    : "";

  return `
    <button
      class="stage-character${selectedClass}${statusClass}${extraClasses}${speakerClass}${listenerClass}${participantClass}${choiceAffectedClass}"
      style="${extraStyles}"
      data-action="select-resident"
      data-resident-id="${escapeHtml(resident.id)}"
      type="button"
      title="${escapeHtml(resident.name)} / ${escapeHtml(task)}"
      aria-label="${escapeHtml(resident.name)}在${escapeHtml(stagePlaces[resident.locationId]?.label ?? "广场")}"
    >
      <span class="stage-character__sprite">
        ${getResidentAvatarImg(resident, 54)}
        ${propHtml}
      </span>
      ${completionBadge}
      ${moodIconHtml}
      <span class="stage-character__name">${escapeHtml(resident.name)}</span>
      ${!anim && task && !isParticipant ? `<span class="stage-character__task">${escapeHtml(getEnhancedTaskLabel(task, activeScenario))}</span>` : ""}
      ${actionBubble}
      ${dialogueBubble}
      ${conversationBubble}
      ${choiceReactionBubble}
      ${renderCharacterVoiceIndicator(resident, beat, residentVoiceInteraction, ttsAudios)}
    </button>
  `;
}

/**
 * Render the choice aftermath summary panel shown in the right side panel.
 * @param {object|null} aftermath
 * @returns {string} HTML or empty string
 */
function renderChoiceAftermath(aftermath, residentVoiceInteraction = null) {
  if (!aftermath || !aftermath.id) return "";
  const { choiceLabel, summary, residentReactions } = aftermath;

  const reactionsHtml = (residentReactions ?? []).map((r) => {
    const voiceEnabled = residentVoiceInteraction?.enabled ?? false;
    const audioKey = "choice_reaction:" + (r.residentId ?? "") + ":" + (aftermath?.id ?? "");
    const btn = voiceEnabled
      ? `<button class="mimo-tts-btn" data-action="play-mimo-tts" data-audio-key="${escapeHtml(audioKey)}" data-text="${escapeHtml(r.reaction ?? "")}" data-scene="choice_reaction" data-resident-id="${escapeHtml(r.residentId ?? "")}" data-beat-id="">🔈 MiMo</button>`
      : "";
    return `<div class="choice-aftermath__reaction"><span class="choice-aftermath__reaction-name">${escapeHtml(r.residentName ?? "")}：</span><span class="choice-aftermath__reaction-text">${escapeHtml(r.reaction ?? "")}</span>${btn}</div>`;
  }).join("");

  return `
    <div class="choice-aftermath" aria-label="居民反应" aria-live="polite">
      <div class="choice-aftermath__header">
        <span>👥</span>
        <span>居民反应</span>
      </div>
      <div class="choice-aftermath__choice-label">
        你选择了：${safeText(choiceLabel, "做出了选择")}
      </div>
      ${summary ? `<p class="choice-aftermath__summary">${escapeHtml(summary)}</p>` : ""}
      ${reactionsHtml ? `
        <div class="choice-aftermath__reactions">
          <div class="choice-aftermath__reaction-header">居民反应：</div>
          ${reactionsHtml}
        </div>
      ` : ""}
      <div class="choice-aftermath__memory">
        🌿 这件事已被小镇记住
      </div>
    </div>
  `;
}

/**
 * Render a stage indicator for the player's choice aftermath.
 * Shows as a floating badge near the relevant place.
 * @param {object|null} aftermath
 * @returns {string} HTML or empty string
 */
function renderChoiceAftermathStageIndicator(aftermath) {
  if (!aftermath || !aftermath.id) return "";
  // Only show if the aftermath is recent (within 30 seconds)
  const age = Date.now() - (aftermath.createdAt ?? 0);
  if (age > 30_000) return "";

  const { stageEffect } = aftermath;
  const icon = stageEffect?.icon ?? "✨";
  const label = stageEffect?.label ?? "你的选择产生了影响";

  return `
    <div class="stage-choice-aftermath" aria-label="选择影响" aria-live="polite">
      <span class="stage-choice-aftermath__icon">${safeText(icon, "✨")}</span>
      <span class="stage-choice-aftermath__label">${safeText(label, "留下了痕迹")}</span>
    </div>
  `;
}

/**
 * Sanitize a place marker label to prevent it from sounding like a person speaking.
 * UI-layer fallback — does not change M3 output or memory.
 * @param {string} label - raw markerLabel from choiceWorldEffect
 * @param {string} placeLabel - display name of the place (e.g. "广场", "花园")
 * @returns {string} safe label
 */
export function sanitizePlaceMarkerLabel(label, placeLabel = "这里") {
  const raw = safeText(label, "").trim();
  if (!raw) return `${placeLabel}留下了新的变化`;

  // Patterns that indicate the place is being treated as a speaking character
  const speechLikePattern = /(回应|说|表示|想到|觉得|明白了|答应|回答|告诉|问|开口|说道)/;
  const startsWithPlaceSpeech =
    raw.startsWith(`${placeLabel}回应`) ||
    raw.startsWith(`${placeLabel}说`) ||
    raw.startsWith(`${placeLabel}表示`) ||
    raw.startsWith(`${placeLabel}想到`) ||
    raw.startsWith(`${placeLabel}觉得`);

  if (speechLikePattern.test(raw) || startsWithPlaceSpeech) {
    return `${placeLabel}留下了新的变化`;
  }

  return raw;
}

/**
 * Sanitize a choice reaction label for the stage character bubble.
 * Acts as a UI-layer safety net — does not change M3 output or memory.
 * @param {string} label - raw contextLabel from choiceWorldEffect
 * @param {string} residentName - display name of the resident
 * @param {string} placeLabel - display name of the place (e.g. "广场", "花园")
 * @returns {string} safe label
 */
export function sanitizeChoiceReactionLabel(label, residentName = "居民", placeLabel = "小镇") {
  const raw = safeText(label, "").trim();
  if (!raw) return `${residentName}注意到了变化`;

  // Pattern: place name followed by a speech verb
  const placeSpeechPattern = new RegExp(`^(${placeLabel}|花园|广场|森林|餐厅|工坊|小镇)(回应|说|表示|觉得|想到|明白|回答|告诉|问|开口|说道)`);
  // Generic reaction patterns
  const genericReactionPattern = /^(明白了|好的|知道了|收到|嗯|好)[。！!]?$/;

  if (placeSpeechPattern.test(raw) || genericReactionPattern.test(raw)) {
    return `${residentName}注意到了变化`;
  }

  return raw;
}

/**
 * Render a place-level marker for the player's choice world effect.
 * Positioned above the specific place on the map (not centered).
 * @param {object} choiceWorldEffect - output of buildChoiceWorldEffectView()
 * @returns {string} HTML or empty string
 */
function renderChoiceWorldMarker(choiceWorldEffect) {
  if (!choiceWorldEffect?.visible) return "";
  // Only show if the aftermath is recent (within 30 seconds)
  const age = Date.now() - (choiceWorldEffect.createdAt ?? 0);
  if (age > 30_000) return "";

  const { placeId, markerIcon, markerLabel } = choiceWorldEffect;
  const place = stagePlaces[placeId];
  if (!place) return "";

  const safeLabel = sanitizePlaceMarkerLabel(markerLabel, place.label);

  return `
    <div
      class="stage-choice-marker stage-choice-marker--warm stage-choice-marker--recent"
      style="left:${place.x}%; top:${place.y - 12}%;"
      aria-label="选择影响"
      aria-live="polite"
    >
      <span class="stage-choice-marker__icon">${safeText(markerIcon, "✨")}</span>
      <span class="stage-choice-marker__label">${escapeHtml(safeLabel)}</span>
    </div>
  `;
}

/**
 * Build a view model for the resident focus feedback shown in the stage bubble
 * when a player explicitly clicks a character on the map.
 */
function buildResidentFocusView(state, uiState) {
  const residentId = uiState.selectedResidentFocus?.residentId || uiState.selectedResidentId;
  if (!residentId) return null;

  const resident = state.residents.find((r) => r.id === residentId);
  if (!resident) return null;

  const task = getTask(resident.assignmentId);
  const location = getLocation(resident.locationId);
  const phase = getCurrentPhase(state);
  const completionById = new Map(
    (uiState.completionFeedback?.residentResults ?? []).map((r) => [r.residentId, r])
  );
  const moodView = buildResidentMoodView(resident, {
    completionById,
    activeAnimations: uiState.activeTaskAnimations ?? [],
  });

  return {
    residentId: resident.id,
    name: resident.name,
    avatar: resident.avatar,
    locationLabel: location?.name ?? "小镇",
    taskLabel: task?.label ?? "休息",
    moodIcon: moodView.moodIcon,
    moodLabel: moodView.moodLabel,
    statusText: moodView.statusText,
    energyLabel: moodView.energyLabel,
    memory: resident.memory?.[0] ?? "",
    phaseLabel: phase.label,
    clickedAt: uiState.selectedResidentFocus?.clickedAt ?? 0,
  };
}

/**
 * Generate a one-line resident observation text for the stage bubble.
 * Deterministic based on residentId + clickedAt to pick a template.
 */
function buildResidentFocusLine(view) {
  if (!view) return "";

  const memoryPart = view.memory
    ? `还记得「${view.memory.slice(0, 18)}${view.memory.length > 18 ? "…" : ""}」`
    : "";

  const templates = [
    `${view.name}正在${view.locationLabel}${view.taskLabel ? `忙着${view.taskLabel}` : "停留"}，${view.moodLabel}，${view.energyLabel}。`,
    `${view.name}抬头看了你一眼：现在是${view.phaseLabel}，我在${view.locationLabel}${view.taskLabel ? `做${view.taskLabel}` : "待一会儿"}。`,
    `${view.name}的状态：${view.statusText}。${memoryPart}`,
  ];

  const sum = String(view.clickedAt || view.residentId).split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const index = sum % templates.length;
  return templates[index].trim();
}

/**
 * Build a stable stage digest based on current phase and scenario.
 * Does NOT change based on events or conversation state — ensures stable layout.
 */
function buildStageDigest(state) {
  const phases = ["早上", "下午", "晚上"];
  const phaseLabel = phases[state.phaseIndex ?? 0] ?? "早上";
  const scenario = state.activeScenario;
  let base = scenario?.label
    ? `${phaseLabel} · ${scenario.label}`
    : (() => {
        const defaults = [
          "清晨的小镇慢慢醒来，居民们开始各自忙碌",
          "午后阳光正好，小镇热闹而温馨",
          "傍晚时分，居民们陆续回到休息的地方",
        ];
        return defaults[state.phaseIndex ?? 0] ?? defaults[0];
      })();
  // Truncate at 120 chars + ellipsis (same as old latestEvent behavior)
  if (base.length > 120) {
    base = base.slice(0, 120) + "…";
  }
  return base;
}

/**
 * Determine the current workbench interaction mode based on UI state.
 * This is a pure UI concern — does NOT write to state.
 *
 * Priority (highest to lowest):
 *   1. task-animation — resident task animation in progress
 *   2. conversation   — resident dialogue演出中
 *   3. voice-playback — audio is playing/loading
 *   4. idle           — no active interaction
 *
 * @param {object} uiState
 * @returns {object} workbenchMode
 */
function buildWorkbenchMode(uiState) {
  const conversationStatus = uiState.residentConversation?.status;
  const isConversationActive =
    conversationStatus === "playing" || conversationStatus === "paused";

  const voiceStatus = uiState.currentVoicePlayback?.status;
  const isVoiceActive =
    voiceStatus === "loading" ||
    voiceStatus === "playing" ||
    voiceStatus === "paused";

  if (uiState.isAnimating) {
    return {
      mode: "task-animation",
      suppressResidentFocus: true,
      suppressSceneBubble: true,
      suppressRecommendedVoice: true,
      compactDialogueStatus: true,
    };
  }

  if (isConversationActive) {
    return {
      mode: "conversation",
      suppressResidentFocus: true,
      suppressSceneBubble: true,
      suppressRecommendedVoice: true,
      compactDialogueStatus: true,
    };
  }

  if (isVoiceActive) {
    return {
      mode: "voice-playback",
      suppressResidentFocus: true,
      suppressSceneBubble: false,
      suppressRecommendedVoice: true,
      compactDialogueStatus: true,
    };
  }

  return {
    mode: "idle",
    suppressResidentFocus: false,
    suppressSceneBubble: false,
    suppressRecommendedVoice: false,
    compactDialogueStatus: false,
  };
}

/**
 * Render the task completion feedback panel.
 * Always rendered as a fixed-height slot; content shown when taskFeedback.visible is true.
 * @param {object} taskFeedback - result of buildTaskCompletionFeedback()
 */
function renderTaskCompletionPanel(taskFeedback) {
  if (!taskFeedback?.visible || !Array.isArray(taskFeedback.completions) || taskFeedback.completions.length === 0) {
    return `<aside class="deed-outcome-panel deed-outcome-panel--empty" aria-label="任务完成" aria-live="polite">
      <span class="deed-outcome-panel__hint">居民们正在各自忙碌</span>
    </aside>`;
  }

  const items = taskFeedback.completions.map((c) => {
    const moodSign = c.moodDelta > 0 ? `+${c.moodDelta}` : `${c.moodDelta}`;
    const energySign = c.energyDelta > 0 ? `+${c.energyDelta}` : `${c.energyDelta}`;
    const moodLabel = `心情 ${moodSign}`;
    const energyLabel = `体力 ${energySign}`;
    return `
      <li class="task-completion-item task-completion-item--${escapeHtml(c.tone)}">
        <span class="task-completion-item__icon">${escapeHtml(c.icon)}</span>
        <span class="task-completion-item__resident">${escapeHtml(c.residentName)}</span>
        <span class="task-completion-item__sep">完成了</span>
        <span class="task-completion-item__task">${escapeHtml(c.taskLabel)}</span>
        <span class="task-completion-item__result">${escapeHtml(c.resultText)}</span>
        <span class="task-completion-item__deltas">${escapeHtml(moodLabel)} · ${escapeHtml(energyLabel)}</span>
      </li>`;
  }).join("");

  return `<aside class="deed-outcome-panel deed-outcome-panel--active" aria-label="任务完成" aria-live="polite">
    <ul class="deed-outcome-panel__list">${items}</ul>
  </aside>`;
}

/**
 * Determine if the resident conversation is in an active performance state.
 * Active means the current line is being shown/played, regardless of audio status.
 * @param {object} conv - residentConversation object
 * @returns {boolean}
 */
function isResidentConversationActive(conv) {
  if (!conv?.enabled) return false;
  if (!Array.isArray(conv.queue) || conv.queue.length === 0) return false;
  if (conv.currentIndex == null || conv.currentIndex < 0) return false;
  // Suppress for idle/completed/error — show for everything else (generating, loading, playing, paused)
  return conv.status !== "idle" && conv.status !== "completed" && conv.status !== "error";
}

/**
 * Render the stage-level conversation performance overlay.
 * Shown at the bottom-center of the stage when a resident dialogue is active.
 * Does NOT show any audio status — only the speaker, target, and dialogue text.
 * Shows immediately when the current line is activated (not waiting for audio).
 * @param {object} state
 * @param {object} uiState - safeUiState
 * @returns {string} HTML or empty string
 */
function renderStageConversationOverlay(state, uiState) {
  const conv = uiState.residentConversation;

  if (!isResidentConversationActive(conv)) return "";

  const line = conv.queue?.[conv.currentIndex];
  if (!line) return "";

  const speaker = state.residents.find((r) => r.id === line.speakerId);
  const participants = conv.sessionState?.participants ?? [];
  const target = participants.find((p) => p.residentId !== line.speakerId);

  const speakerName = line.speakerName ?? speaker?.name ?? "居民";
  const targetName = target?.residentName ?? "";
  // Show visibleText (typewriter) if available, otherwise fall back to line.text immediately
  const text = conv.visibleText || line.text || "";

  if (!text.trim()) return "";

  return `
    <aside class="stage-conversation-overlay" aria-label="当前居民对话">
      <div class="stage-conversation-overlay__speaker">
        <span class="stage-conversation-overlay__avatar">${escapeHtml(speaker?.avatar ?? "💬")}</span>
        <span class="stage-conversation-overlay__name">
          ${escapeHtml(speakerName)}${targetName ? ` → ${escapeHtml(targetName)}` : ""}
        </span>
      </div>
      <p class="stage-conversation-overlay__text">${escapeHtml(text)}</p>
    </aside>
  `;
}

function renderTownStage(state, uiState, handlers = {}) {
  const digest = buildStageDigest(state);
  const phase = getCurrentPhase(state);
  const activeAnimations = uiState.activeTaskAnimations ?? [];
  const completionFeedback = uiState.completionFeedback;

  // Build voice playback view model
  const voiceViewModel = buildVoicePlaybackView(uiState.currentVoicePlayback ?? null);

  // Build a map of completion results by residentId
  const completionByResidentId = new Map(
    (completionFeedback?.residentResults ?? []).map((r) => [r.residentId, r])
  );

  // Build task completion feedback view model
  const taskFeedback = buildTaskCompletionFeedback(state, completionFeedback);

  // Build choice world effect view model
  const choiceWorldEffect = buildChoiceWorldEffectView(state, uiState);

  // Build affected resident lookup map
  const affectedResidentIds = new Set(
    (choiceWorldEffect.affectedResidents ?? []).map((r) => r.residentId)
  );

  // Determine which place has residents (for active labels)
  const activePlaceIds = new Set(state.residents.map((r) => r.locationId));

  // Build place labels
  const placeLabelsHtml = Object.keys(stagePlaces)
    .map((placeId) => {
      const placeAnim = activeAnimations.find((a) => a.placeId === placeId);
      const choiceAffected = choiceWorldEffect.visible && choiceWorldEffect.placeId === placeId;
      return renderPlaceLabel(placeId, activePlaceIds.has(placeId), placeAnim, choiceAffected);
    })
    .join("");

  // Build stage characters — group residents by location for offsetting
  const residentsByLocation = {};
  for (const resident of state.residents) {
    if (!residentsByLocation[resident.locationId]) {
      residentsByLocation[resident.locationId] = [];
    }
    residentsByLocation[resident.locationId].push(resident);
  }

  const charactersHtml = state.residents
    .map((resident) => {
      const locals = residentsByLocation[resident.locationId] ?? [];
      const localIndex = locals.indexOf(resident);
      const pos = getResidentStagePosition(resident, localIndex);
      const task = getTask(resident.assignmentId);
      const status = residentStatus(resident);
      const anim = activeAnimations.find((a) => a.residentId === resident.id);
      const completionResult = completionByResidentId.get(resident.id) ?? null;
      const moodView = buildResidentMoodView(resident, {
        completionById: completionByResidentId,
        activeAnimations,
      });
      const beat = (uiState.residentSceneBeats ?? []).find((b) => b.residentId === resident.id) ?? null;
      // Determine conversation role: speaker, listener, or null
      // Use broader active check that includes generating/loading (same as renderStageConversationOverlay)
      const conversationActive = isResidentConversationActive(uiState.residentConversation);
      const currentLine = uiState.residentConversation?.queue?.[uiState.residentConversation?.currentIndex];
      const currentSpeakerId = currentLine?.speakerId ?? null;
      const sessionState = uiState.residentConversation?.sessionState ?? null;
      const participantIds = sessionState?.participants?.map((p) => p.residentId) ?? [];
      const isParticipant = participantIds.includes(resident.id);
      const isSpeaker = isParticipant && resident.id === currentSpeakerId;
      const isListener = isParticipant && !isSpeaker;
      const conversationForChar = conversationActive && isSpeaker
        ? uiState.residentConversation
        : null;
      // Choice reaction: only primary resident (hasBubble) gets the bubble; others are highlighted via affectedResidentIds
      const allAffected = choiceWorldEffect.affectedResidents ?? [];
      const affectedResidentIds = new Set(allAffected.map((r) => r.residentId));
      const isChoiceAffected = !isParticipant && !anim && affectedResidentIds.has(resident.id);
      const choiceReaction = isChoiceAffected ? allAffected.find((r) => r.hasBubble && r.residentId === resident.id) ?? null : null;
      return renderStageCharacter(
        resident,
        pos,
        task?.label ?? "",
        status,
        resident.id === uiState.selectedResidentId,
        anim,
        completionResult,
        moodView,
        uiState.activeScenario,
        beat,
        uiState.residentVoiceInteraction,
        uiState.ttsAudios,
        conversationForChar,
        { isConversationActive: conversationActive, isSpeaker, isListener, isParticipant },
        isChoiceAffected,
        choiceReaction,
      );
    })
    .join("");

  // Broadcast playing indicator
  const ba = uiState.broadcastAudio ?? { status: "idle" };
  const isPlaying = ba.status === "playing";
  const stagePlayingClass = isPlaying ? " town-stage--broadcast-playing" : "";

  return `
    <section class="town-stage town-stage--${escapeHtml(phase.id)}${stagePlayingClass}" aria-label="小镇地图 - ${escapeHtml(phase.label)}">
      <img
        class="town-stage__background"
        src="./src/assets/map/town-stage-day.svg"
        alt=""
        aria-hidden="true"
      />
      <div class="town-stage__labels" aria-hidden="true">
        ${placeLabelsHtml}
      </div>
      <div class="town-stage__characters">
        ${charactersHtml}
      </div>
      ${(() => {
        const workbenchMode = buildWorkbenchMode(uiState);
        // Place marker only shown during idle (suppressed during conversation/animation/voice)
        const shouldShowChoiceWorldMarker = workbenchMode.mode === "idle" && choiceWorldEffect?.visible;
        return shouldShowChoiceWorldMarker ? renderChoiceWorldMarker(choiceWorldEffect) : "";
      })()}
      ${renderStageConversationOverlay(state, uiState)}
      ${(() => {
        const workbenchMode = buildWorkbenchMode(uiState);

        // During active modes (task-animation, conversation, voice-playback), suppress all bubbles
        if (workbenchMode.suppressSceneBubble && workbenchMode.suppressResidentFocus) {
          return "";
        }

        const canShowResidentFocus =
          !workbenchMode.suppressResidentFocus &&
          uiState.selectedResidentFocus?.residentId &&
          uiState.selectedResidentFocus?.clickedAt > 0;

        if (canShowResidentFocus) {
          const focusView = buildResidentFocusView(state, uiState);
          const focusLine = focusView ? buildResidentFocusLine(focusView) : "";
          if (focusView) {
            return `<aside class="stage-bubble stage-bubble--resident-focus" aria-label="当前观察居民" data-focus-resident-id="${escapeHtml(focusView.residentId)}" data-focus-clicked-at="${escapeHtml(String(focusView.clickedAt))}">
          <span class="stage-bubble__tag">👤 正在观察：${escapeHtml(focusView.name)}</span>
          <p>${escapeHtml(focusLine)}</p>
          <div class="stage-bubble__resident-meta">
            <span>📍 ${escapeHtml(focusView.locationLabel)}</span>
            <span>📋 ${escapeHtml(focusView.taskLabel)}</span>
            <span>${escapeHtml(focusView.moodIcon)} ${escapeHtml(focusView.moodLabel)}</span>
          </div>
        </aside>`;
          }
        }

        // Show current scene bubble only when not suppressed
        if (!workbenchMode.suppressSceneBubble) {
          return `<aside class="stage-bubble stage-bubble--scene" aria-label="当前小镇场景">
          <span class="stage-bubble__tag">🗺️ 当前场景</span>
          <p>${escapeHtml(digest)}</p>
        </aside>`;
        }

        return "";
      })()}
      ${renderTaskCompletionPanel(taskFeedback)}
      ${renderVoicePlaybackChip(voiceViewModel, handlers)}
      <div class="stage-legend" aria-hidden="true">
        <span class="stage-legend__item"><i class="status-dot status-dot--happy"></i>开心</span>
        <span class="stage-legend__item"><i class="status-dot status-dot--steady"></i>平稳</span>
        <span class="stage-legend__item"><i class="status-dot status-dot--tired"></i>疲惫</span>
      </div>
      ${uiState.dayOpeningReflection && uiState.dayOpeningReflection.sourceType !== "fallback" ? `
        <div class="stage-opening-reflection" aria-label="小镇记得昨天的选择" aria-live="polite">
          <span class="stage-opening-reflection__icon">🌿</span>
          <span class="stage-opening-reflection__text">小镇记得昨天的选择</span>
        </div>
      ` : ""}
      ${isPlaying ? `
        <div class="stage-broadcast-indicator" aria-label="广播播放中" aria-live="polite">
          <span class="stage-broadcast-indicator__icon">📻</span>
          <span class="stage-broadcast-indicator__text">广播播放中…</span>
        </div>
      ` : ""}
    </section>
  `;
}

function renderLocationCard(state, location) {
  const place = stagePlaces[location.id];
  const residents = getResidentsAtLocation(state, location.id);
  const residentAvatars = residents.length
    ? residents
        .map((resident) =>
          `<span class="mini-avatar" title="${escapeHtml(resident.name)}">${getResidentAvatarImg(resident, 20)}</span>`
        )
        .join("")
    : "";

  return `
    <div class="location-codex__item">
      <span class="location-codex__icon">${place ? place.icon : "📍"}</span>
      <span class="location-codex__name">${escapeHtml(place ? place.label : location.name)}</span>
      <div class="location-codex__residents">${residentAvatars || '<span class="empty-note">-</span>'}</div>
    </div>
  `;
}

// ── Spotlight (Resident Detail) ────────────────────────────────────────────────

function renderSpotlight(state, uiState) {
  const selected = state.residents.find((resident) => resident.id === uiState.selectedResidentId) ?? state.residents[0];
  if (!selected) return "";

  const task = getTask(selected.assignmentId);
  const location = getLocation(selected.locationId);
  const status = residentStatus(selected);

  const completionById = new Map(
    (uiState.completionFeedback?.residentResults ?? []).map((r) => [r.residentId, r])
  );
  const moodView = buildResidentMoodView(selected, {
    completionById,
    activeAnimations: uiState.activeTaskAnimations ?? [],
  });

  return `
    <section class="panel spotlight">
      <div class="spotlight__glow" aria-hidden="true"></div>
      <div class="panel__head panel__head--spotlight">
        <h2>👤 居民详情</h2>
        <span class="panel-badge">${safeText(location?.name, "小镇")}</span>
      </div>
      <div class="spotlight__header">
        <div class="spotlight__portrait" aria-hidden="true">
          ${getResidentAvatarImg(selected, 96)}
        </div>
        <div class="spotlight__info">
          <h3>${safeText(selected.name, "居民")}</h3>
          <p>${safeText(selected.role, "居民")} · ${safeText(selected.skill, "普通")}</p>
          <span class="spotlight__role-badge">${safeText(selected.personality, "随和")}</span>
        </div>
      </div>

      <div class="spotlight__role-card">
        <div class="spotlight__plan">
          <span>📋 当前安排</span>
          <strong>${safeText(task?.label, "休息")}</strong>
        </div>
        <div class="spotlight__status">
          <span class="status-tag status-tag--${status.id}">${escapeHtml(status.label)}</span>
          <span class="personality-tag">${escapeHtml(selected.personality)}</span>
        </div>
      </div>

      <div class="spotlight__mood-row">
        <span class="spotlight__mood-badge" title="${escapeHtml(moodView.moodLabel)}">
          ${moodView.moodIcon} ${escapeHtml(moodView.moodLabel)}
        </span>
        <span class="spotlight__status-text">${escapeHtml(moodView.statusText)}</span>
        <span class="spotlight__energy-hint">${escapeHtml(moodView.energyLabel)}</span>
      </div>

      ${(() => {
        const aftermath = uiState?.choiceAftermath;
        if (!aftermath?.residentReactions?.length) return "";
        const reaction = (aftermath.residentReactions).find((r) => r.residentId === selected.id);
        if (!reaction) return "";
        return `<div class="spotlight__choice-hint">✨ ${escapeHtml(reaction.reaction ?? "回应了你的选择")}</div>`;
      })()}

      ${renderAgentSummary(selected.agent)}
      ${meter("心情", selected.mood, "rose")}
      ${meter("体力", selected.energy, "blue")}

      <div class="spotlight__memory-wrap">
        <p class="spotlight__memory-label">📝 最近记忆</p>
        <p class="spotlight__memory">${escapeHtml(selected.memory[0] ?? "还没有记忆哦~")}</p>
      </div>
    </section>
  `;
}

// ── Resident Card ──────────────────────────────────────────────────────────────

function renderResidentCard(resident, selectedResidentId, moodView) {
  const task = getTask(resident.assignmentId);
  const location = getLocation(resident.locationId);
  const status = residentStatus(resident);

  const moodLabel = moodView ? moodView.moodLabel : "状态稳定";
  const moodIcon  = moodView ? moodView.moodIcon  : "😐";
  const statusText = moodView ? moodView.statusText : "在小镇里闲逛";
  const energyLabel = moodView ? moodView.energyLabel : "精力一般";

  return `
    <article class="resident ${resident.id === selectedResidentId ? "resident--selected" : ""}" data-resident-card="${escapeHtml(resident.id)}">
      <div class="resident__head">
        <div class="resident__avatar" aria-hidden="true">${getResidentAvatarImg(resident, 40)}</div>
        <div class="resident__info">
          <h3>${safeText(resident.name, "居民")}</h3>
          <p>${safeText(resident.role, "居民")} · ${safeText(resident.skill, "普通")}</p>
        </div>
      </div>
      <p class="resident__personality">${safeText(resident.personality, "随和")}</p>
      <div class="resident__meta">
        <span>📍 ${safeText(location?.name, "小镇")}</span>
        <span>📋 ${safeText(task?.label, "休息")}</span>
      </div>
      <div class="resident__status-row">
        <span class="resident__mood-badge" title="${escapeHtml(moodLabel)}">${moodIcon} ${escapeHtml(moodLabel)}</span>
        <span class="resident__status-text">${escapeHtml(statusText)}</span>
        <span class="resident__energy-hint">${escapeHtml(energyLabel)}</span>
      </div>
      ${renderAgentSummary(resident.agent)}
      ${meter("心情", resident.mood, "rose")}
      ${meter("体力", resident.energy, "blue")}
      <label class="select-label">
        <span>分配任务</span>
        <select data-resident-task="${escapeHtml(resident.id)}" aria-label="为 ${escapeHtml(resident.name)} 分配任务">
          ${taskOptions(resident.assignmentId)}
        </select>
      </label>
      <details>
        <summary>📖 近期记忆</summary>
        <ul class="memory-list">
          ${resident.memory.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </details>
    </article>
  `;
}

// ── Event Feed ────────────────────────────────────────────────────────────────

const TONE_LABELS = {
  cozy: "温暖",
  surprise: "惊喜",
  social: "社交",
  resource: "物资",
  memory: "回忆",
};

function renderM3EventItem(event, residents, latestClass = "", ttsAudios = {}, handlers = {}) {
  const toneLabel = TONE_LABELS[event.tone] ?? event.tone ?? "温暖";
  const placeName = {
    garden: "花园", cafe: "咖啡馆", workshop: "工坊", plaza: "广场", forest: "森林",
  }[event.placeId] ?? "广场";

  const participantHtml = event.residentIds && event.residentIds.length > 0
    ? event.residentIds
        .map((id) => {
          const resident = residents.find((r) => r.id === id);
          if (!resident) return "";
          return `<span class="m3-event__resident" title="${escapeHtml(resident.name)}">${escapeHtml(resident.name)}</span>`;
        })
        .join("")
    : "";

  // Event TTS button — text truncated to 80 chars
  const eventTextKey = `event_prompt:${event.id}`;
  const ta = ttsAudios[eventTextKey] ?? {};
  const eventPromptText = `${event.title ?? ""}。${event.text ?? ""}`.slice(0, 80);
  const eventTtsBtn = (handlers?.onPlayMimoTts)
    ? (() => {
      if (ta.status === "loading") return `<button class="mimo-tts-btn mimo-tts-btn--loading" disabled>🔊…</button>`;
      if (ta.status === "playing") return `<button class="mimo-tts-btn mimo-tts-btn--playing" data-action="pause-mimo-tts" data-audio-key="${escapeHtml(eventTextKey)}">⏸️</button>`;
      if (ta.status === "paused" || ta.status === "ready") return `<button class="mimo-tts-btn mimo-tts-btn--ready" data-action="resume-mimo-tts" data-audio-key="${escapeHtml(eventTextKey)}">▶️</button>`;
      if (ta.status === "error") return `<button class="mimo-tts-btn mimo-tts-btn--error" data-action="play-mimo-tts" data-audio-key="${escapeHtml(eventTextKey)}" data-text="${escapeHtml(eventPromptText)}" data-scene="event_prompt" data-resident-id="" data-beat-id="">⚠️</button>`;
      return `<button class="mimo-tts-btn" data-action="play-mimo-tts" data-audio-key="${escapeHtml(eventTextKey)}" data-text="${escapeHtml(eventPromptText)}" data-scene="event_prompt" data-resident-id="" data-beat-id="">🔈</button>`;
    })()
    : "";

  const hasChoices = Array.isArray(event.choices) && event.choices.length > 0;
  const isChosen = Boolean(event.chosenChoiceId);
  const chosenChoice = hasChoices ? event.choices.find((c) => c.id === event.chosenChoiceId) : null;

  let choicesHtml = "";
  if (hasChoices && !isChosen) {
    choicesHtml = `
      <div class="m3-event__choices">
        <p class="m3-event__choices-prompt">你要怎么做？</p>
        <div class="m3-event__choice-buttons">
          ${event.choices.map((choice) => `
            <button
              class="event-choice"
              type="button"
              data-action="choose-event"
              data-event-id="${escapeHtml(event.id)}"
              data-choice-id="${escapeHtml(choice.id)}"
            >
              <span class="event-choice__label">${escapeHtml(choice.label)}</span>
              <span class="event-choice__preview">${escapeHtml(choice.preview)}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;
  } else if (hasChoices && isChosen && chosenChoice) {
    choicesHtml = `
      <div class="m3-event__chosen">
        <p class="m3-event__chosen-label">已选择：${escapeHtml(chosenChoice.label ?? "")}</p>
        <p class="m3-event__chosen-result">结果：${escapeHtml(chosenChoice.resultText ?? "")}</p>
      </div>
    `;
  }

  return `
    <article class="feed-item feed-item--m3-event${latestClass}">
      <div class="m3-event__header">
        <span class="feed-item__meta">
          🎭 第 ${event.day} 天 · ${escapeHtml(event.phase)}
        </span>
        <span class="m3-event__tone">${escapeHtml(toneLabel)}</span>
      </div>
      ${event.title ? `<p class="m3-event__title">${escapeHtml(event.title)}</p>` : ""}
      <p class="m3-event__text">${safeText(event.text)}</p>
      ${eventTtsBtn ? `<div class="m3-event__tts-row">${eventTtsBtn}</div>` : ""}
      <div class="m3-event__footer">
        <span class="m3-event__place">📍 ${escapeHtml(placeName)}</span>
        ${participantHtml ? `<span class="m3-event__residents">👥 ${participantHtml}</span>` : ""}
      </div>
      ${event.memoryReferences && event.memoryReferences.length > 0 ?
        `<p class="m3-event__memory-refs">📖 ${escapeHtml(event.memoryReferences.slice(0, 2).join(" · "))}</p>` : ""}
      ${event.suggestedFollowUp ? `<p class="m3-event__followup">💡 ${escapeHtml(event.suggestedFollowUp)}</p>` : ""}
      ${choicesHtml}
    </article>
  `;
}


function renderTownBroadcastItem(event, residents, latestClass = "") {
  const moodLabel = {
    warm: "温暖", calm: "平静", lively: "活泼", tired: "疲惫", hopeful: "充满希望", tense: "紧张",
  }[event.mood] ?? "温暖";
  const placeName = {
    garden: "花园", cafe: "咖啡馆", workshop: "工坊", plaza: "广场", forest: "森林",
  }[event.placeId] ?? "广场";

  const participantHtml = event.residentIds && event.residentIds.length > 0
    ? event.residentIds
        .map((id) => {
          const resident = residents.find((r) => r.id === id);
          if (!resident) return "";
          return `<span class="broadcast__resident">${escapeHtml(resident.name)}</span>`;
        })
        .join("")
    : "";

  return `
    <article class="feed-item feed-item--town-broadcast${latestClass}">
      <div class="broadcast__header">
        <span class="feed-item__meta">📻 第 ${event.day} 天 · ${escapeHtml(event.phase)}</span>
        <span class="broadcast__mood-badge">${escapeHtml(moodLabel)}</span>
      </div>
      ${event.title ? `<p class="broadcast__title">${escapeHtml(event.title)}</p>` : ""}
      <p class="broadcast__script">${escapeHtml(event.text ?? event.script ?? "")}</p>
      <div class="broadcast__tags">
        <span class="broadcast__tag">🎵 ${escapeHtml(event.musicMood ?? "")}</span>
        <span class="broadcast__tag">📍 ${escapeHtml(placeName)}</span>
        ${event.durationHint ? `<span class="broadcast__tag">⏱ ${escapeHtml(event.durationHint)}</span>` : ""}
      </div>
      ${participantHtml ? `<div class="broadcast__residents">👥 ${participantHtml}</div>` : ""}
      ${event.musicPrompt ? `
        <details class="broadcast__music-prompt">
          <summary>🎼 建议音乐提示词</summary>
          <p>${escapeHtml(event.musicPrompt)}</p>
        </details>
      ` : ""}
    </article>
  `;
}

function renderPlayerChoiceItem(event, residents, latestClass = "") {
  const placeName = {
    garden: "花园", cafe: "咖啡馆", workshop: "工坊", plaza: "广场", forest: "森林",
  }[event.placeId] ?? "广场";

  const participantHtml = event.residentIds && event.residentIds.length > 0
    ? event.residentIds
        .map((id) => {
          const resident = residents.find((r) => r.id === id);
          if (!resident) return "";
          return `<span class="player-choice__resident">${escapeHtml(resident.name)}</span>`;
        })
        .join("")
    : "";

  return `
    <article class="feed-item feed-item--player-choice${latestClass}">
      <div class="player-choice__header">
        <span class="feed-item__meta">
          🧭 第 ${event.day} 天 · ${escapeHtml(event.phase)}
        </span>
      </div>
      <p class="player-choice__title">你的选择</p>
      <p class="player-choice__label">你选择了：${escapeHtml(event.choiceLabel ?? "")}</p>
      <p class="player-choice__text">${escapeHtml(event.text)}</p>
      <div class="player-choice__footer">
        <span class="player-choice__place">📍 ${escapeHtml(placeName)}</span>
        ${participantHtml ? `<span class="player-choice__residents">👥 ${participantHtml}</span>` : ""}
      </div>
    </article>
  `;
}

const MEMORY_PLACE_NAMES = {
  garden: "花园", cafe: "咖啡馆", workshop: "工坊", plaza: "广场", forest: "森林",
};

function renderTownMemory(state) {
  const memories = [...(state.townMemory ?? [])].reverse().slice(0, 5);

  if (memories.length === 0) {
    return `
      <section class="panel town-memory">
        <div class="panel__head">
          <h2>🧠 小镇记忆</h2>
        </div>
        <p class="town-memory__empty">小镇还没有留下重要记忆。做出选择后，它们会被记录在这里。</p>
      </section>
    `;
  }

  const itemsHtml = memories.map((m) => {
    const placeName = MEMORY_PLACE_NAMES[m.placeId] ?? "广场";
    const residentHtml = (m.residentIds ?? [])
      .map((id) => {
        const resident = state.residents.find((r) => r.id === id);
        return resident ? escapeHtml(resident.name) : "";
      })
      .filter(Boolean)
      .join("、");

    return `
      <div class="town-memory__item">
        <div class="town-memory__meta">
          <span class="town-memory__day">第 ${m.day} 天 · ${escapeHtml(m.phase ?? "")}</span>
          <span class="town-memory__place">📍 ${escapeHtml(placeName)}</span>
        </div>
        ${m.title ? `<p class="town-memory__title">${escapeHtml(m.title)}</p>` : ""}
        <p class="town-memory__text">${escapeHtml(m.text)}</p>
        ${residentHtml ? `<p class="town-memory__residents">👥 ${residentHtml}</p>` : ""}
      </div>
    `;
  }).join("");

  return `
    <section class="panel town-memory">
      <div class="panel__head">
        <h2>🧠 小镇记忆</h2>
        <span class="panel-badge">${memories.length} 条</span>
      </div>
      <div class="town-memory__list">
        ${itemsHtml}
      </div>
    </section>
  `;
}

function renderEventFeed(state, completionFeedback, ttsAudios = {}, handlers = {}) {
  const events = [...state.events].reverse().slice(0, 12);
  const isLatest = completionFeedback != null;
  const typeIcon = { action: "🏃", social: "💬", system: "🔔", report: "📰", "m3-event": "🎭", "town-broadcast": "📻", "player-choice": "🧭" };

  return `
    <section class="panel">
      <div class="panel__head">
        <h2>📟 小镇动态</h2>
        <span class="panel-badge">${events.length} 条</span>
      </div>
      <div class="feed" aria-live="polite">
        ${events
          .map((event, index) => {
            const latestClass = isLatest && index === 0 ? " feed-item--latest" : "";
            if (event.type === "m3-event") {
              return renderM3EventItem(event, state.residents, latestClass, ttsAudios, handlers);
            }
            if (event.type === "town-broadcast") {
              return renderTownBroadcastItem(event, state.residents, latestClass);
            }
            if (event.type === "player-choice") {
              return renderPlayerChoiceItem(event, state.residents, latestClass);
            }
            return `
              <article class="feed-item feed-item--${escapeHtml(event.type)}${latestClass}">
                <span class="feed-item__meta">
                  ${typeIcon[event.type] ?? "📌"} 第 ${event.day} 天 · ${escapeHtml(event.phase)}
                </span>
                <p>${escapeHtml(event.text)}</p>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

// ── Relationships ──────────────────────────────────────────────────────────────

function renderRelationships(state) {
  const pairs = getTopRelationships(state);
  return `
    <section class="panel">
      <div class="panel__head">
        <h2>💕 邻里关系</h2>
        <span class="panel-badge">Top 5</span>
      </div>
      <div class="relations">
        ${pairs
          .map(
            (pair) => `
              <div class="relation">
                <span class="relation__names">${escapeHtml(pair.a.name)} 🤝 ${escapeHtml(pair.b.name)}</span>
                <span class="relation__value">${pair.value}</span>
                <div class="relation__track" aria-hidden="true"><i style="width:${pct(pair.value)}"></i></div>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

// ── Project Meaning (collapsed details) ───────────────────────────────────────

function renderProjectMeaning() {
  return `
    <details class="project-meaning" id="project-meaning">
      <summary class="project-meaning__summary">
        <span class="project-meaning__summary-title">🌟 为什么是 AI 小镇？</span>
        <span class="project-meaning__summary-sub">查看这个原型的探索目标</span>
      </summary>
      <div class="project-meaning__body">
        <div class="project-meaning__header">
          <p class="project-meaning__lead">这不是一个普通的小镇模拟页面，而是一个用 MiniMax-M3 探索 AI 游戏新形态的原型。</p>
        </div>
        <div class="project-meaning__grid">
          <article class="project-meaning__card">
            <div class="project-meaning__icon" aria-hidden="true">🌿</div>
            <h3>一个可以被观察的温柔世界</h3>
            <p>玩家不是在管理冰冷的数据，而是在陪伴一群有心情、有体力、有记忆、有关系的居民度过一天。每一次安排，都会影响他们的状态、互动和小镇的故事。</p>
          </article>
          <article class="project-meaning__card">
            <div class="project-meaning__icon" aria-hidden="true">🤖</div>
            <h3>一个 M3 Agent 能力实验场</h3>
            <p>AI 管家不是简单生成一句话，而是根据居民状态、小镇资源、任务目标和最近记忆，尝试为每个居民做出合理安排。这是对大模型规划、结构化输出、角色一致性和多 Agent 协作能力的真实验证。</p>
          </article>
          <article class="project-meaning__card">
            <div class="project-meaning__icon" aria-hidden="true">🎮</div>
            <h3>一个 AI 游戏方向的产品原型</h3>
            <p>这个项目的目标不是复制传统游戏，而是探索一种新的体验：玩家提供意图，AI 生成生活，居民持续变化，小镇慢慢形成属于自己的故事。它是游戏、陪伴、Agent 和内容生成之间的交叉实验。</p>
          </article>
        </div>
        <div class="project-meaning__closing">
          <p>当前版本仍是原型，但它已经验证了一个方向：AI 不只是游戏里的 NPC 台词生成器，也可以成为小镇生活的规划者、叙事者和观察者。</p>
        </div>
      </div>
    </details>
  `;
}

// ── Reports ────────────────────────────────────────────────────────────────────

function renderReports(state) {
  const [latestReport, ...olderReports] = state.reports;
  if (!latestReport) {
    return `
      <section class="panel report">
        <div class="panel__head"><h2>📰 小镇日报</h2></div>
        <p class="report__empty">📋 晚上阶段结束后，会生成今日日报哦~</p>
      </section>
    `;
  }

  const olderReportsHtml = olderReports.length > 0
    ? `
      <details class="report-history">
        <summary>📜 历史日报（${olderReports.length} 份）</summary>
        <div class="report-history__list">
          ${olderReports.map((r) => `
            <details class="report-history__item">
              <summary>📰 ${escapeHtml(r.title)} · ${escapeHtml(r.phase)}</summary>
              <p class="report__summary">${escapeHtml(r.summary)}</p>
              <div class="report__highlights">
                <p class="report__highlights-label">📝 今日大事：</p>
                <ul>${r.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
              </div>
            </details>
          `).join("")}
        </div>
      </details>
    `
    : "";

  return `
    <section class="panel report report--active">
      <div class="report__header">
        <span class="report__badge">📰 小镇日报</span>
        <h2>${escapeHtml(latestReport.title)}</h2>
        <span class="report__phase-tag">${escapeHtml(latestReport.phase)}</span>
      </div>
      <div class="report__summary-wrap">
        <p class="report__summary">${escapeHtml(latestReport.summary)}</p>
      </div>
      <div class="report__highlights">
        <p class="report__highlights-label">📝 今日大事：</p>
        <ul>
          ${latestReport.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
      ${olderReportsHtml}
    </section>
  `;
}

// ── Event Binding ──────────────────────────────────────────────────────────────

function bindEvents(root, handlers) {
  root.querySelector("[data-action='advance']").addEventListener("click", handlers.onAdvance);
  root.querySelector("[data-action='run-day']").addEventListener("click", handlers.onRunDay);
  root.querySelector("[data-action='toggle-resident-voice']")?.addEventListener("click", handlers.onToggleResidentVoice);
  root.querySelector("[data-action='toggle-auto']").addEventListener("click", handlers.onToggleAutoPlay);
  root.querySelector("[data-action='minimax-plan']").addEventListener("click", handlers.onMiniMaxPlan);
  root.querySelector("[data-action='minimax-event']").addEventListener("click", handlers.onMiniMaxEvent);
  root.querySelector("[data-action='minimax-broadcast']").addEventListener("click", handlers.onMiniMaxBroadcast);
  root.querySelector("[data-action='generate-tts']")?.addEventListener("click", handlers.onGenerateTts);
  root.querySelector("[data-action='play-tts']")?.addEventListener("click", handlers.onPlayTts);
  root.querySelector("[data-action='reset-assignments']").addEventListener("click", handlers.onResetAssignments);
  root.querySelector("[data-action='run-town-day-cycle']")?.addEventListener("click", handlers.onRunTownDayCycle);
  root.querySelector("[data-action='new-town']").addEventListener("click", handlers.onNewTown);
  root.querySelectorAll("[data-action='select-resident']").forEach((button) => {
    button.addEventListener("click", () => {
      handlers.onSelectResident(button.dataset.residentId);
    });
  });
  root.querySelectorAll("[data-resident-select]").forEach((button) => {
    button.addEventListener("click", (event) => {
      handlers.onSelectResident(event.currentTarget.dataset.residentSelect);
    });
  });
  root.querySelectorAll("[data-resident-card]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("select, details, summary")) return;
      handlers.onSelectResident(event.currentTarget.dataset.residentCard);
    });
  });
  root.querySelectorAll("[data-resident-task]").forEach((select) => {
    select.addEventListener("change", (event) => {
      handlers.onAssignTask(event.target.dataset.residentTask, event.target.value);
    });
  });
  root.querySelectorAll("[data-action='choose-event']").forEach((button) => {
    button.addEventListener("click", () => {
      handlers.onChooseEvent(
        button.dataset.eventId,
        button.dataset.choiceId,
      );
    });
  });
  root.querySelectorAll("[data-action='play-mimo-tts']").forEach((button) => {
    button.addEventListener("click", () => {
      handlers.onPlayMimoTts(
        button.dataset.audioKey,
        button.dataset.text,
        button.dataset.scene,
        button.dataset.residentId,
        button.dataset.beatId,
      );
    });
  });
  root.querySelectorAll("[data-action='pause-mimo-tts']").forEach((button) => {
    button.addEventListener("click", () => {
      handlers.onPauseMimoTts(button.dataset.audioKey);
    });
  });
  root.querySelectorAll("[data-action='resume-mimo-tts']").forEach((button) => {
    button.addEventListener("click", () => {
      handlers.onResumeMimoTts(button.dataset.audioKey);
    });
  });
  root.querySelector("[data-action='voice-pause']")?.addEventListener("click", handlers.onVoicePause);
  root.querySelector("[data-action='voice-resume']")?.addEventListener("click", handlers.onVoiceResume);
  root.querySelector("[data-action='voice-stop']")?.addEventListener("click", handlers.onVoiceStop);
  root.querySelectorAll("[data-action='toggle-conversation']").forEach((button) => {
    button.addEventListener("click", handlers.onToggleConversation);
  });
  root.querySelectorAll("[data-action='stop-conversation']").forEach((button) => {
    button.addEventListener("click", handlers.onStopConversation);
  });
  root.querySelector("[data-action='clear-voice-debug']")?.addEventListener("click", () => {
    if (Array.isArray(window.__VOICE_DEBUG__)) window.__VOICE_DEBUG__.length = 0;
    const panel = root.querySelector(".voice-debug-panel");
    if (panel) panel.remove();
  });
}

// ── Main Render ───────────────────────────────────────────────────────────────

export function renderApp(root, state, handlers, uiState = {}) {
  const safeUiState = {
    selectedResidentId: uiState.selectedResidentId ?? state.residents[0]?.id ?? null,
    autoPlay: Boolean(uiState.autoPlay),
    llmStatus: uiState.llmStatus ?? "idle",
    llmMessage: uiState.llmMessage ?? "",
    eventDirectorStatus: uiState.eventDirectorStatus ?? "idle",
    eventDirectorMessage: uiState.eventDirectorMessage ?? "",
    broadcastStatus: uiState.broadcastStatus ?? "idle",
    broadcastMessage: uiState.broadcastMessage ?? "",
    latestBroadcast: uiState.latestBroadcast ?? null,
    broadcastAudio: uiState.broadcastAudio ?? { status: "idle", text: "", audioUrl: null, error: null, traceId: null, generatedAt: null, scriptHash: "" },
    activeTaskAnimations: uiState.activeTaskAnimations ?? [],
    isAnimating: Boolean(uiState.isAnimating),
    animationMessage: uiState.animationMessage ?? "",
    completionFeedback: uiState.completionFeedback ?? null,
    activeScenario: uiState.activeScenario ?? null,
    residentSceneBeats: uiState.residentSceneBeats ?? [],
    dayCycle: uiState.dayCycle ?? { status: "idle", step: "", scenarioId: "", error: "", startedAt: 0, completedAt: 0 },
    ttsAudios: uiState.ttsAudios ?? {},
    currentVoicePlayback: uiState.currentVoicePlayback ?? null,
    choiceAftermath: uiState.choiceAftermath ?? null,
    dayOpeningReflection: uiState.dayOpeningReflection ?? null,
    residentVoiceInteraction: uiState.residentVoiceInteraction ?? { enabled: false, recommendedClipKey: "", lastTriggeredAt: 0, hint: "" },
    residentVoiceClips: Array.isArray(uiState.residentVoiceClips) ? uiState.residentVoiceClips : [],
    residentConversation: uiState.residentConversation ?? { enabled: false, status: "idle", queue: [], currentIndex: 0, currentLineId: "", visibleText: "", typingTimerId: null, autoPlayVoice: true, error: "", runId: "", startedCount: 0 },
    selectedResidentFocus: uiState.selectedResidentFocus ?? {
      residentId: uiState.selectedResidentId ?? state.residents[0]?.id ?? "",
      clickedAt: 0,
    },
  };

  const safeHandlers = {
    onAdvance: handlers.onAdvance ?? (() => {}),
    onRunDay: handlers.onRunDay ?? (() => {}),
    onToggleResidentVoice: handlers.onToggleResidentVoice ?? (() => {}),
    onToggleAutoPlay: handlers.onToggleAutoPlay ?? (() => {}),
    onMiniMaxPlan: handlers.onMiniMaxPlan ?? (() => {}),
    onMiniMaxEvent: handlers.onMiniMaxEvent ?? (() => {}),
    onMiniMaxBroadcast: handlers.onMiniMaxBroadcast ?? (() => {}),
    onGenerateTts: handlers.onGenerateTts ?? (() => {}),
    onPlayTts: handlers.onPlayTts ?? (() => {}),
    onPauseTts: handlers.onPauseTts ?? (() => {}),
    onResetAssignments: handlers.onResetAssignments ?? (() => {}),
    onRunTownDayCycle: handlers.onRunTownDayCycle ?? (() => {}),
    onNewTown: handlers.onNewTown ?? (() => {}),
    onSelectResident: handlers.onSelectResident ?? (() => {}),
    onAssignTask: handlers.onAssignTask ?? (() => {}),
    onChooseEvent: handlers.onChooseEvent ?? (() => {}),
    onPlayMimoTts: handlers.onPlayMimoTts ?? (() => {}),
    onPauseMimoTts: handlers.onPauseMimoTts ?? (() => {}),
    onResumeMimoTts: handlers.onResumeMimoTts ?? (() => {}),
    onVoicePause: handlers.onVoicePause ?? (() => {}),
    onVoiceResume: handlers.onVoiceResume ?? (() => {}),
    onVoiceStop: handlers.onVoiceStop ?? (() => {}),
    onToggleConversation: handlers.onToggleConversation ?? (() => {}),
    onStopConversation: handlers.onStopConversation ?? (() => {}),
  };

  root.innerHTML = `
    <div class="shell">
      ${renderGameHud(state)}

      <main class="layout">
        <div class="left-col">
          ${renderGameActions(state, safeUiState, safeHandlers)}
          ${renderCompactGoals(state)}
        </div>
        <section class="map-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">🗺️ 小镇地图</p>
              <h2>五大地点</h2>
            </div>
          </div>
          ${renderTownStage(state, safeUiState, safeHandlers)}
          <div class="location-codex">
            ${locations.map((location) => renderLocationCard(state, location)).join("")}
          </div>
        </section>
        <aside class="side-panel">
          ${(() => {
            const conversationStatus = safeUiState.residentConversation?.status ?? "idle";
            const isConversationActive = conversationStatus === "playing" || conversationStatus === "paused";

            // Build dialogue panel once — used in both orderings
            const dialoguePanelHtml = renderResidentDialoguePanel({
              beats: safeUiState.residentSceneBeats,
              conversationQueue: safeUiState.residentConversation?.queue ?? [],
              currentLineIndex: safeUiState.residentConversation?.currentIndex ?? 0,
              visibleText: safeUiState.residentConversation?.visibleText ?? "",
              sessionState: safeUiState.residentConversation?.sessionState ?? null,
              ttsAudios: safeUiState.ttsAudios ?? {},
            });

            // During active conversation, dialogue panel comes first so the user
            // always sees it without having to scroll after every re-render.
            if (isConversationActive) {
              return `${dialoguePanelHtml}
${renderLlmStatus(safeUiState)}
${renderEventDirectorStatus(state, safeUiState)}
${renderAtmospherePanel(state, safeUiState)}
${renderChoiceAftermath(safeUiState.choiceAftermath, safeUiState.residentVoiceInteraction)}
${renderSpotlight(state, safeUiState)}`;
            }

            return `${renderLlmStatus(safeUiState)}
${renderEventDirectorStatus(state, safeUiState)}
${renderAtmospherePanel(state, safeUiState)}
${dialoguePanelHtml}
${renderChoiceAftermath(safeUiState.choiceAftermath, safeUiState.residentVoiceInteraction)}
${renderSpotlight(state, safeUiState)}`;
          })()}
        </aside>
      </main>

      <section class="story-section">
        <div class="story-section__grid">
          ${renderEventFeed(state, safeUiState.completionFeedback, safeUiState.ttsAudios, safeHandlers)}
          ${renderRelationships(state)}
          ${renderReports(state)}
        </div>
        ${renderTownMemory(state)}
        <section class="residents-grid">
          <div class="section-head">
            <div>
              <p class="eyebrow">👥 居民</p>
              <h2>每日安排</h2>
            </div>
          </div>
          <div class="resident-list">
            ${state.residents.map((resident) => {
              const completionById = new Map(
                (safeUiState.completionFeedback?.residentResults ?? []).map((r) => [r.residentId, r])
              );
              const moodView = buildResidentMoodView(resident, {
                completionById,
                activeAnimations: safeUiState.activeTaskAnimations ?? [],
              });
              return renderResidentCard(resident, safeUiState.selectedResidentId, moodView);
            }).join("")}
          </div>
        </section>
      </section>

      ${renderProjectMeaning()}
    </div>
    ${renderVoiceDebugPanel()}
  `;

  bindEvents(root, safeHandlers);
}

// ── Voice Debug Panel ──────────────────────────────────────────────────────────────────

/**
 * Lightweight browser debug panel for voice链路 diagnostics.
 * Only visible when localStorage.VOICE_DEBUG === "1" or URL ?voiceDebug=1.
 * Does NOT display keys, base64, or other sensitive data.
 */
function renderVoiceDebugPanel() {
  // Read flag once at render time — does not auto-update without reload
  const showPanel =
    (typeof localStorage !== "undefined" && localStorage.VOICE_DEBUG === "1") ||
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("voiceDebug") === "1");

  if (!showPanel) return "";

  const logs = (typeof window !== "undefined" && Array.isArray(window.__VOICE_DEBUG__))
    ? window.__VOICE_DEBUG__.slice(-10)
    : [];

  if (logs.length === 0) {
    return `<div class="voice-debug-panel"><p class="voice-debug-panel__empty">No voice events yet. Interact with TTS to see logs.</p></div>`;
  }

  const rows = logs.map((entry) => {
    const time = new Date(entry.at).toLocaleTimeString();
    // Build a compact one-line summary of the payload, stripping long strings
    const parts = [];
    const p = entry.payload || {};
    for (const [k, v] of Object.entries(p)) {
      if (v == null) continue;
      const str = String(v);
      // Truncate long strings for display
      parts.push(`${k}=${str.length > 30 ? str.slice(0, 28) + "…" : str}`);
    }
    return `<div class="voice-debug-panel__entry">
      <span class="voice-debug-panel__time">${escapeHtml(time)}</span>
      <span class="voice-debug-panel__event">${escapeHtml(entry.event)}</span>
      <span class="voice-debug-panel__detail">${escapeHtml(parts.join(" | "))}</span>
    </div>`;
  }).join("");

  return `<div class="voice-debug-panel" aria-label="Voice diagnostics panel">
    <p class="voice-debug-panel__title">🔍 Voice Debug (last ${logs.length}) <button class="voice-debug-panel__clear" data-action="clear-voice-debug">✕</button></p>
    ${rows}
  </div>`;
}

// ── Event Choice Entry View Model ─────────────────────────────────────────────────

const PLACE_NAMES = { garden: "花园", cafe: "餐厅", workshop: "工坊", plaza: "广场", forest: "森林" };

/**
 * Build a view model for the event choice entry shown in the Event Director card.
 * Finds the most recent unchosen m3-event from state.events.
 *
 * Pure function — does NOT modify state or call APIs.
 *
 * @param {object} state
 * @param {object} uiState
 * @returns {object} view model
 */
export function buildEventChoiceEntryView(state, uiState) {
  const events = state?.events ?? [];
  // Find most recent m3-event that has choices and hasn't been chosen yet
  const latestM3Event = [...events].reverse().find(
    (e) => e.type === "m3-event" && Array.isArray(e.choices) && e.choices.length > 0
  );

  // If no event found, return empty status
  if (!latestM3Event) {
    return {
      visible: true,
      status: "empty",
      eventId: null,
      title: "",
      summary: "",
      placeLabel: "",
      residentNames: [],
      choices: [],
      chosenChoiceLabel: "",
      resultText: "",
      memoryHint: "",
    };
  }

  const hasChoices = Array.isArray(latestM3Event.choices) && latestM3Event.choices.length > 0;
  const isChosen = Boolean(latestM3Event.chosenChoiceId);
  const chosenChoice = hasChoices ? latestM3Event.choices.find((c) => c.id === latestM3Event.chosenChoiceId) : null;

  // Resident names
  const residents = state?.residents ?? [];
  const residentNames = (latestM3Event.residentIds ?? [])
    .map((id) => residents.find((r) => r.id === id)?.name ?? "")
    .filter(Boolean);

  const placeLabel = PLACE_NAMES[latestM3Event.placeId] ?? "小镇";

  // If already chosen, return chosen status
  if (isChosen && chosenChoice) {
    return {
      visible: true,
      status: "chosen",
      eventId: latestM3Event.id,
      title: latestM3Event.title ?? "",
      summary: latestM3Event.text ?? "",
      placeLabel,
      residentNames,
      choices: [],
      chosenChoiceLabel: chosenChoice.label ?? "",
      resultText: chosenChoice.resultText ?? "",
      memoryHint: "🌿 这件事已被小镇记住",
    };
  }

  // Return ready status with up to 3 choices
  const visibleChoices = (latestM3Event.choices ?? []).slice(0, 3).map((c) => ({
    id: c.id ?? "",
    label: c.label ?? "",
    preview: c.preview ?? "",
  }));

  return {
    visible: true,
    status: "ready",
    eventId: latestM3Event.id,
    title: latestM3Event.title ?? "",
    summary: latestM3Event.text ?? "",
    placeLabel,
    residentNames,
    choices: visibleChoices,
    chosenChoiceLabel: "",
    resultText: "",
    memoryHint: "",
  };
}

// ── Game Guide View Model ─────────────────────────────────────────────────────────

/**
 * Build a view model for the game guide card shown in the left panel.
 * Determines the current step and next action recommendation based on state.
 *
 * Pure function — does NOT modify state or call APIs.
 *
 * @param {object} state
 * @param {object} uiState
 * @returns {object} view model
 */
export function buildGameGuideView(state, uiState) {
  const llmStatus = uiState?.llmStatus ?? "idle";
  const hasPlan = llmStatus === "ready" || llmStatus === "idle"; // has been planned at least once
  const phaseIndex = state?.phaseIndex ?? 0;
  const hasAdvanced = phaseIndex > 0 || (state?.events?.length ?? 0) > 1;

  // Build steps with done state
  const steps = [
    { id: "plan", label: "AI 管家安排", done: hasPlan },
    { id: "advance", label: "推进时间", done: hasAdvanced },
    { id: "event", label: "生成事件", done: false },
    { id: "choice", label: "做出选择", done: false },
    { id: "broadcast", label: "生成广播", done: false },
    { id: "dialogue", label: "居民对话", done: false },
    { id: "end-day", label: "结束今天", done: false },
  ];

  // Find first undone step
  const currentStepObj = steps.find((s) => !s.done) ?? steps[steps.length - 1];

  // Determine next action text based on current state
  let nextActionText = "先生成一个小镇事件，让玩家参与一次选择。";

  if (llmStatus === "loading") {
    nextActionText = "AI 管家正在观察居民状态……";
  } else if (!hasPlan) {
    nextActionText = "让 AI 管家安排居民，看看今天小镇要怎么过。";
  } else if (!hasAdvanced) {
    nextActionText = "推进小镇时间，观察居民们在做什么。";
  } else {
    // Check if there's an m3-event with choices
    const events = state?.events ?? [];
    const latestM3Event = [...events].reverse().find(
      (e) => e.type === "m3-event" && Array.isArray(e.choices) && e.choices.length > 0
    );
    if (!latestM3Event) {
      nextActionText = "生成一个小镇事件，参与今天的小插曲。";
    } else if (!latestM3Event.chosenChoiceId) {
      nextActionText = "选择一个事件选项，影响小镇的发展。";
    } else if (!uiState?.latestBroadcast) {
      nextActionText = "生成小镇广播，听听今天的小镇氛围。";
    } else if (!uiState?.residentConversation?.enabled) {
      nextActionText = "开启居民对话，看看居民们怎么互动。";
    } else {
      nextActionText = "今天的主要流程已走完，可以结束今天让小镇进入下一天。";
    }
  }

  return {
    visible: true,
    title: "今日指引",
    currentStep: currentStepObj.label,
    nextActionText,
    steps,
  };
}

// ── Choice Aftermath View Model ─────────────────────────────────────────────────────

/**
 * Build a view model for the player choice aftermath.
 * Pure function — does NOT modify state or call APIs.
 * @param {object} state
 * @param {object} uiState
 * @returns {object} view model
 */
export function buildChoiceAftermathView(state, uiState) {
  const aftermath = uiState?.choiceAftermath;
  if (!aftermath || !aftermath.id) {
    return { visible: false };
  }

  const residents = state?.residents ?? [];
  const placeId = aftermath.stageEffect?.placeId ?? null;
  const location = placeId ? (getLocation(placeId) ?? {}) : {};
  const placeLabel = location?.name ?? "小镇";

  const affectedResidents = (aftermath.residentReactions ?? []).map((r) => {
    const resident = residents.find((res) => res.id === r.residentId);
    return {
      residentId: r.residentId ?? "",
      residentName: r.residentName ?? "",
      reactionText: r.reaction ?? "",
      moodHint: r.emotion ?? "",
    };
  });

  return {
    visible: true,
    choiceLabel: aftermath.choiceLabel ?? "",
    resultText: aftermath.summary ?? "",
    affectedResidents,
    placeId: placeId ?? "",
    placeLabel,
    memoryHint: "🌿 这件事已被小镇记住",
    tone: "warm",
  };
}

// ── Voice Playback View Model ───────────────────────────────────────────────────────

/**
 * Build a view model for the voice playback chip.
 * Normalizes currentVoicePlayback into the shape needed by the compact chip.
 * @param {object|null} cvp - currentVoicePlayback state
 * @returns {object} view model for the compact chip
 */
export function buildVoicePlaybackView(cvp) {
  if (!cvp || cvp.status === "idle") {
    return { visible: false, type: "", status: "idle", speakerName: "", targetName: "", text: "", canPause: false, canResume: false, canStop: false };
  }

  const status = cvp.status ?? "loading";
  const sourceType = cvp.sourceType ?? cvp.scene ?? "";
  const isConversation = sourceType === "conversation" || sourceType === "resident-dialogue";
  const isBroadcast = sourceType === "town_broadcast";

  // Conversation audio is local to the stage bubble + dialogue panel — suppress the global chip
  if (isConversation) {
    return { visible: false, type: sourceType, status, speakerName: "", targetName: "", text: "", canPause: false, canResume: false, canStop: false, error: "" };
  }

  // Determine chip title and subtitle based on source type
  let speakerName = "";
  let targetName = "";
  let text = cvp.textPreview ?? "";

  if (isBroadcast) {
    speakerName = "小镇广播";
    targetName = "";
    text = cvp.textPreview ?? "";
  } else {
    speakerName = cvp.title ?? cvp.sourceType ?? "语音";
    targetName = "";
    text = cvp.textPreview ?? "";
  }

  return {
    visible: true,
    type: sourceType,
    status,
    speakerName,
    targetName,
    text,
    canPause: status === "playing",
    canResume: status === "paused",
    canStop: status === "playing" || status === "paused",
    error: status === "error" ? (cvp.error || "播放失败") : "",
  };
}

// ── Voice Compact Playback Chip ─────────────────────────────────────────────────────

const VOICE_PLAYBACK_ICONS = {
  town_broadcast: "📻",
  conversation: "💬",
  "resident-dialogue": "💬",
  event_prompt: "🎭",
  completion_feedback: "✅",
  day_opening: "🏠",
  default: "🔊",
};

/**
 * Render the compact voice playback chip inside town-stage.
 * This is an absolute-positioned overlay — does NOT push layout.
 * @param {object} viewModel - output of buildVoicePlaybackView()
 * @param {object} handlers
 */
function renderVoicePlaybackChip(viewModel, handlers) {
  if (!viewModel.visible) {
    return `<div class="voice-playback-chip voice-playback-chip--idle" aria-live="polite" role="status"></div>`;
  }

  const { status, speakerName, targetName, text, canPause, canResume, canStop, error, type } = viewModel;

  const statusClass = ({
    loading: "voice-playback-chip--loading",
    playing: "voice-playback-chip--playing",
    paused:  "voice-playback-chip--paused",
    error:   "voice-playback-chip--error",
  }[status] || "voice-playback-chip--loading");

  const icon = VOICE_PLAYBACK_ICONS[type] ?? VOICE_PLAYBACK_ICONS.default;

  // Compact single-line format: 💬 小花 → 阿远：台词…
  let mainHtml = "";
  if (status === "error") {
    mainHtml = `<span class="voice-playback-chip__error">${escapeHtml(error)}</span>`;
  } else if (type === "town_broadcast") {
    mainHtml = `<span class="voice-playback-chip__broadcast">📻 小镇广播：${escapeHtml(text ?? "语音播放中")}</span>`;
  } else {
    const speaker = speakerName ? `<strong>${escapeHtml(speakerName)}</strong>` : "";
    const arrow = targetName ? ` → ` : "";
    const target = targetName ? `<em>${escapeHtml(targetName)}</em>` : "";
    const colon = (speaker || target) ? "：" : "";
    const lineText = text ? escapeHtml(text) : "";
    mainHtml = `<span class="voice-playback-chip__compact">${icon} ${speaker}${arrow}${target}${colon}${lineText}</span>`;
  }

  return `
    <div class="voice-playback-chip ${statusClass}" aria-live="polite" role="status">
      ${mainHtml}
      <div class="voice-playback-chip__actions">
        ${canPause  ? `<button class="btn-chip" data-action="voice-pause">暂停</button>` : ""}
        ${canResume ? `<button class="btn-chip" data-action="voice-resume">继续</button>` : ""}
        ${canStop   ? `<button class="btn-chip" data-action="voice-stop">停止</button>` : ""}
      </div>
    </div>
  `;
}
