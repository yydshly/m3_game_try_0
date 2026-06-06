import { locations, phases, tasks } from "../data/seed.js";
import { buildResidentMoodView } from "../domain/residentMood.js";

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
        <a class="game-hud__about-link" href="#project-meaning">了解这个小镇 →</a>
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

// ── Left Column: Game Actions + Compact Goals ───────────────────────────────────

function renderGameActions(state, safeUiState) {
  const nextPhaseLabel = state.phaseIndex === phases.length - 1 ? "🌙 结束今天" : `⏭️ 推进到${phases[state.phaseIndex + 1].label}`;
  const phase = getCurrentPhase(state);
  const isAnimating = safeUiState.isAnimating;
  const animMsg = safeUiState.animationMessage || "";

  // Animation banner shown while residents are traveling/acting
  const animBanner = isAnimating
    ? `<div class="game-actions__anim-banner" aria-live="polite">🚶 ${escapeHtml(animMsg)}</div>`
    : "";

  // Completion feedback banner after animation finishes
  const completionFeedback = safeUiState.completionFeedback;
  const completionBanner = completionFeedback
    ? `<div class="game-actions__completion-banner" aria-live="polite">✅ ${escapeHtml(completionFeedback.message)}</div>`
    : "";

  // Buttons disabled during animation (except auto-play toggle and new-town)
  const advancingDisabled = isAnimating ? "disabled" : "";
  const aiLoading = safeUiState.llmStatus === "loading" ? "disabled" : "";
  const eventLoading = safeUiState.eventDirectorStatus === "loading" ? "disabled" : "";
  const broadcastLoading = safeUiState.broadcastStatus === "loading" ? "disabled" : "";

  return `
    <div class="game-actions">
      <p class="game-actions__title">🎮 游戏操作</p>
      <div class="game-actions__stats">
        <span class="game-actions__stat">
          <span class="game-actions__stat-label">📅</span>
          <strong>第 ${state.day} 天</strong>
          <span class="game-actions__stat-phase">${escapeHtml(phase.label)}</span>
        </span>
      </div>
      ${animBanner}
      ${completionBanner}
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

function renderEventDirectorStatus(uiState) {
  const statusLabels = {
    idle: { icon: "🎭", label: "待机", text: "让 M3 观察小镇，生成一个今天的小事件。" },
    loading: { icon: "🎭", label: "思考中", text: "M3 正在观察居民和小镇动态……" },
    ready: { icon: "✨", label: "已就绪", text: uiState.eventDirectorMessage || "小镇事件已加入动态。" },
    error: { icon: "⚠️", label: "异常", text: uiState.eventDirectorMessage || "事件导演暂时没有灵感，请稍后再试。" },
  };
  const info = statusLabels[uiState.eventDirectorStatus] ?? statusLabels.idle;
  const isError = uiState.eventDirectorStatus === "error";
  const isIdle = uiState.eventDirectorStatus === "idle";

  // Idle state: compact single-line style
  if (isIdle) {
    return `
      <div class="event-director event-director--idle">
        <span class="event-director__idle-icon">${info.icon}</span>
        <span class="event-director__idle-label">小镇事件导演：</span>
        <span class="event-director__idle-text">${escapeHtml(info.text)}</span>
      </div>
    `;
  }

  return `
    <section class="panel event-director event-director--${escapeHtml(uiState.eventDirectorStatus ?? "ready")}">
      <div class="panel__head">
        <h2>${info.icon} 小镇事件导演</h2>
        <span class="llm-status-badge llm-status-badge--${escapeHtml(uiState.eventDirectorStatus ?? "ready")}">${escapeHtml(info.label)}</span>
      </div>
      <p>${escapeHtml(info.text)}</p>
      ${isError && uiState.eventDirectorMessage ? `<p class="llm-status__hint">💡 检查 MiniMax 配置或稍后重试。</p>` : ""}
    </section>
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

  // TTS button: only handles generation (idle) and re-generation (error)
  // Disabled when audio already exists (ready/paused/playing) to prevent double-generation
  const ttsButtonDisabled = (baStatus === "loading" || baStatus === "ready" || baStatus === "playing" || baStatus === "paused") ? "disabled" : "";
  const ttsButtonClass = {
    idle: "button--broadcast",
    loading: "button--ghost",
    ready: "button--broadcast",
    playing: "button--live",
    paused: "button--broadcast",
    error: "button--broadcast",
  }[baStatus] ?? "button--broadcast";
  const ttsButtonLabel = {
    idle: "生成语音广播",
    loading: "正在生成…",
    ready: "播放广播",
    playing: "暂停广播",
    paused: "播放广播",
    error: "重新生成",
  }[baStatus] ?? "生成语音广播";
  const ttsButtonIcon = {
    idle: "🔊",
    loading: "🔊",
    ready: "▶️",
    playing: "⏸️",
    paused: "▶️",
    error: "⚠️",
  }[baStatus] ?? "🔊";

  // Play button: visible when audio exists, not loading, and not currently playing
  // (allows replay after audio ended or resume after pause — not shown during playback)
  const hasAudio = ba.audioUrl && baStatus !== "loading";
  const showPlayButton = hasAudio && baStatus !== "playing";
  const playButtonLabel = baStatus === "paused" ? "继续" : "播放";
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
        ${latestBc && ttsStatusLine ? `<span class="panel-badge panel-badge--tts">🎙️ ${escapeHtml(ttsStatusLine)}</span>` : ""}
      </div>
      ${uiState.activeScenario ? `
        <div class="atmosphere-scenario">
          <span class="atmosphere-scenario__label">🎬 今日场景</span>
          <span class="atmosphere-scenario__name">${escapeHtml(uiState.activeScenario.label)}</span>
          <span class="atmosphere-scenario__tone">${escapeHtml(uiState.activeScenario.tone)}</span>
        </div>
      ` : ""}
      ${latestBc ? `
        <div class="atmosphere-broadcast-preview">
          <p class="atmosphere-broadcast-preview__title">${escapeHtml(latestBc.title)}</p>
          <p class="atmosphere-broadcast-preview__script">${escapeHtml(latestBc.script?.slice(0, 120))}${latestBc.script?.length > 120 ? "…" : ""}</p>
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
            title="${friendlyError || ""}"
          >
            ${ttsButtonIcon} ${escapeHtml(ttsButtonLabel)}
          </button>
          ${showPlayButton ? `
            <button class="button button--ghost" type="button" data-action="play-tts">
              ▶️ ${escapeHtml(playButtonLabel)}
            </button>
          ` : ""}
          ${baStatus === "playing" ? `
            <button class="button button--live" type="button" data-action="play-tts">
              ⏸️ 暂停
            </button>
          ` : ""}
          ${hasError && friendlyError ? `<span class="tts-error-hint">⚠️ ${escapeHtml(friendlyError)}</span>` : ""}
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

function renderPlaceLabel(placeId, isActive, anim) {
  const place = stagePlaces[placeId];
  if (!place) return "";
  const activeClass = isActive ? " stage-place-label--active" : "";
  const travelingClass = anim?.traveling ? " stage-place-label--traveling" : "";
  const taskClass = anim ? ` stage-place-label--task stage-place-label--effect-${escapeHtml(anim.effect)}` : "";
  const placeEffectClass = anim?.placeEffect ? ` stage-place-label--place-effect-${escapeHtml(anim.placeEffect)}` : "";
  const effectAnchor = anim
    ? `<span class="stage-effect-anchor stage-effect-anchor--${escapeHtml(anim.effect)} stage-effect-anchor--${escapeHtml(anim.placeEffect ?? anim.effect)}" aria-hidden="true"></span>`
    : "";

  return `
    <div class="stage-place-label stage-place-label--${escapeHtml(placeId)}${activeClass}${travelingClass}${taskClass}${placeEffectClass}"
         style="left:${place.x}%; top:${place.y}%;"
         aria-label="${escapeHtml(place.label)}">
      <span class="stage-place-label__icon">${place.icon}</span>
      <span class="stage-place-label__name">${escapeHtml(place.label)}</span>
      ${effectAnchor}
    </div>
  `;
}

function renderStageCharacter(resident, position, taskLabel, status, isSelected, anim, completionResult, moodView, activeScenario) {
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
      class="stage-character${selectedClass}${statusClass}${extraClasses}"
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
      ${!anim && task ? `<span class="stage-character__task">${escapeHtml(getEnhancedTaskLabel(task, activeScenario))}</span>` : ""}
      ${actionBubble}
    </button>
  `;
}

function renderTownStage(state, uiState) {
  const latestEvent = [...state.events].reverse().find((event) => event.type !== "system");
  const phase = getCurrentPhase(state);
  const activeAnimations = uiState.activeTaskAnimations ?? [];
  const completionFeedback = uiState.completionFeedback;

  // Build a map of completion results by residentId
  const completionByResidentId = new Map(
    (completionFeedback?.residentResults ?? []).map((r) => [r.residentId, r])
  );

  // Determine which place has residents (for active labels)
  const activePlaceIds = new Set(state.residents.map((r) => r.locationId));

  // Build place labels
  const placeLabelsHtml = Object.keys(stagePlaces)
    .map((placeId) => {
      const placeAnim = activeAnimations.find((a) => a.placeId === placeId);
      return renderPlaceLabel(placeId, activePlaceIds.has(placeId), placeAnim);
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
      ${
        latestEvent
          ? `
          <aside class="stage-bubble" aria-live="polite">
            <span class="stage-bubble__tag">📌 最新动态</span>
            <p>${escapeHtml(latestEvent.text.slice(0, 120))}${latestEvent.text.length > 120 ? "…" : ""}</p>
          </aside>`
          : ""
      }
      <div class="stage-legend" aria-hidden="true">
        <span class="stage-legend__item"><i class="status-dot status-dot--happy"></i>开心</span>
        <span class="stage-legend__item"><i class="status-dot status-dot--steady"></i>平稳</span>
        <span class="stage-legend__item"><i class="status-dot status-dot--tired"></i>疲惫</span>
      </div>
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
        <span class="panel-badge">${escapeHtml(location.name)}</span>
      </div>
      <div class="spotlight__header">
        <div class="spotlight__portrait" aria-hidden="true">
          ${getResidentAvatarImg(selected, 96)}
        </div>
        <div class="spotlight__info">
          <h3>${escapeHtml(selected.name)}</h3>
          <p>${escapeHtml(selected.role)} · ${escapeHtml(selected.skill)}</p>
          <span class="spotlight__role-badge">${escapeHtml(selected.personality)}</span>
        </div>
      </div>

      <div class="spotlight__role-card">
        <div class="spotlight__plan">
          <span>📋 当前安排</span>
          <strong>${escapeHtml(task.label)}</strong>
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
          <h3>${escapeHtml(resident.name)}</h3>
          <p>${escapeHtml(resident.role)} · ${escapeHtml(resident.skill)}</p>
        </div>
      </div>
      <p class="resident__personality">${escapeHtml(resident.personality)}</p>
      <div class="resident__meta">
        <span>📍 ${escapeHtml(location.name)}</span>
        <span>📋 ${escapeHtml(task.label)}</span>
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

function renderM3EventItem(event, residents, latestClass = "") {
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
        <p class="m3-event__chosen-label">已选择：${escapeHtml(chosenChoice.label)}</p>
        <p class="m3-event__chosen-result">结果：${escapeHtml(chosenChoice.resultText)}</p>
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
      <p class="m3-event__text">${escapeHtml(event.text)}</p>
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

function renderEventFeed(state, completionFeedback) {
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
              return renderM3EventItem(event, state.residents, latestClass);
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
  root.querySelector("[data-action='toggle-auto']").addEventListener("click", handlers.onToggleAutoPlay);
  root.querySelector("[data-action='minimax-plan']").addEventListener("click", handlers.onMiniMaxPlan);
  root.querySelector("[data-action='minimax-event']").addEventListener("click", handlers.onMiniMaxEvent);
  root.querySelector("[data-action='minimax-broadcast']").addEventListener("click", handlers.onMiniMaxBroadcast);
  root.querySelector("[data-action='generate-tts']")?.addEventListener("click", handlers.onGenerateTts);
  root.querySelector("[data-action='play-tts']")?.addEventListener("click", handlers.onPlayTts);
  root.querySelector("[data-action='reset-assignments']").addEventListener("click", handlers.onResetAssignments);
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
  };

  root.innerHTML = `
    <div class="shell">
      ${renderGameHud(state)}

      <main class="layout">
        <div class="left-col">
          ${renderGameActions(state, safeUiState)}
          ${renderCompactGoals(state)}
        </div>
        <section class="map-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">🗺️ 小镇地图</p>
              <h2>五大地点</h2>
            </div>
          </div>
          ${renderTownStage(state, safeUiState)}
          <div class="location-codex">
            ${locations.map((location) => renderLocationCard(state, location)).join("")}
          </div>
        </section>
        <aside class="side-panel">
          ${renderLlmStatus(safeUiState)}
          ${renderEventDirectorStatus(safeUiState)}
          ${renderAtmospherePanel(state, safeUiState)}
          ${renderSpotlight(state, safeUiState)}
        </aside>
      </main>

      <section class="story-section">
        <div class="story-section__grid">
          ${renderEventFeed(state, safeUiState.completionFeedback)}
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
  `;

  bindEvents(root, handlers);
}
