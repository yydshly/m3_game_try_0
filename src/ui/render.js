import { locations, phases, tasks } from "../data/seed.js";

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
      <div class="game-actions__section">
        <p class="game-actions__section-label">⏭️ 推进</p>
        <button class="button button--primary" type="button" data-action="advance">${escapeHtml(nextPhaseLabel)}</button>
        <button class="button button--ghost" type="button" data-action="run-day">🌙 结束今天</button>
      </div>
      <div class="game-actions__section">
        <p class="game-actions__section-label">🤖 AI 管家</p>
        <button class="button button--ai" type="button" data-action="minimax-plan" ${safeUiState.llmStatus === "loading" ? "disabled" : ""}>
          ${safeUiState.llmStatus === "loading" ? "🤖 管家思考中..." : "🤖 AI 管家安排"}
        </button>
      </div>
      <div class="game-actions__section">
        <p class="game-actions__section-label">🎭 事件导演</p>
        <button class="button button--event" type="button" data-action="minimax-event" ${safeUiState.eventDirectorStatus === "loading" ? "disabled" : ""}>
          ${safeUiState.eventDirectorStatus === "loading" ? "🎭 观察中..." : "🎭 生成小镇事件"}
        </button>
      </div>
      <div class="game-actions__section">
        <p class="game-actions__section-label">📻 氛围广播</p>
        <button class="button button--broadcast" type="button" data-action="minimax-broadcast" ${safeUiState.broadcastStatus === "loading" ? "disabled" : ""}>
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
    idle: { icon: "🎭", label: "idle", text: "让 M3 观察小镇，生成一个今天的小事件。" },
    loading: { icon: "🎭", label: "思考中", text: "M3 正在观察居民和小镇动态……" },
    ready: { icon: "✨", label: "已就绪", text: uiState.eventDirectorMessage || "小镇事件已加入动态。" },
    error: { icon: "⚠️", label: "异常", text: uiState.eventDirectorMessage || "事件导演暂时没有灵感，请稍后再试。" },
  };
  const info = statusLabels[uiState.eventDirectorStatus] ?? statusLabels.idle;
  const isError = uiState.eventDirectorStatus === "error";

  return `
    <section class="panel event-director event-director--${escapeHtml(uiState.eventDirectorStatus ?? "idle")}">
      <div class="panel__head">
        <h2>${info.icon} 小镇事件导演</h2>
        <span class="llm-status-badge llm-status-badge--${escapeHtml(uiState.eventDirectorStatus ?? "idle")}">${escapeHtml(info.label)}</span>
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
    loading: "正在生成……",
    ready: "已生成",
    error: "生成失败",
  };
  const statusText = statusLabels[uiState.broadcastStatus ?? "idle"] ?? "尚未生成";

  const moodMap = { warm: "温暖", calm: "平静", lively: "活泼", tired: "疲惫", hopeful: "充满希望", tense: "紧张" };
  const placeMap = { garden: "花园", cafe: "咖啡馆", workshop: "工坊", plaza: "广场", forest: "森林" };

  return `
    <section class="panel atmosphere-panel">
      <div class="panel__head">
        <h2>🎧 小镇氛围</h2>
        <span class="panel-badge">${escapeHtml(statusText)}</span>
      </div>
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

function renderStageResident(state, resident, selectedResidentId) {
  const residentsAtLocation = getResidentsAtLocation(state, resident.locationId);
  const index = residentsAtLocation.findIndex((item) => item.id === resident.id);
  const offsets = [
    { x: -3, y: -5 }, { x: 3, y: -4 }, { x: -5, y: 3 }, { x: 5, y: 4 }, { x: 0, y: 7 }
  ];
  const offset = offsets[index % offsets.length];
  const getLocationPos = (locId) => getLocation(locId)?.position ?? { x: 50, y: 50 };
  const current = getLocationPos(resident.locationId);
  const previous = getLocationPos(resident.previousLocationId ?? resident.locationId);
  const task = getTask(resident.assignmentId);
  const status = residentStatus(resident);

  return `
    <button
      class="stage-resident stage-resident--${escapeHtml(status.id)}${resident.id === selectedResidentId ? " stage-resident--selected" : ""}"
      data-resident-select="${escapeHtml(resident.id)}"
      type="button"
      title="${escapeHtml(resident.name)} / ${escapeHtml(task.label)} / ${escapeHtml(status.label)}"
      style="--x:${current.x + offset.x}%; --y:${current.y + offset.y}%; --from-x:${previous.x + offset.x}%; --from-y:${previous.y + offset.y}%;"
      aria-label="${escapeHtml(resident.name)} 在 ${escapeHtml(getLocation(resident.locationId).name)} / ${escapeHtml(task.label)}"
      aria-pressed="${resident.id === selectedResidentId ? "true" : "false"}"
    >
      <span class="char-chip">
        <span class="char-avatar">${getResidentAvatarImg(resident, 36)}</span>
        <span class="char-text">
          <span class="char-name">${escapeHtml(resident.name)}</span>
          <span class="char-task">${escapeHtml(task.label)}</span>
        </span>
      </span>
    </button>
  `;
}

// ── Town Stage (Map) ──────────────────────────────────────────────────────────

function renderTownStage(state, uiState) {
  const latestEvent = [...state.events].reverse().find((event) => event.type !== "system");
  const phase = getCurrentPhase(state);

  return `
    <div class="town-stage town-stage--${escapeHtml(phase.id)}" aria-label="小镇地图 - ${escapeHtml(phase.label)}">
      <div class="stage-sky" aria-hidden="true">
        <span class="cloud cloud--one"></span>
        <span class="cloud cloud--two"></span>
        <span class="sun"></span>
      </div>
      <div class="stage-particles" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="stage-path stage-path--one" aria-hidden="true"></div>
      <div class="stage-path stage-path--two" aria-hidden="true"></div>
      <img class="town-path-overlay" src="./src/assets/ui/town-paths.svg" alt="" aria-hidden="true" />
      ${locations
        .map(
          (location) => `
            <article
              class="stage-place stage-place--${escapeHtml(location.tone)}"
              style="--x:${location.position.x}%; --y:${location.position.y}%;"
              aria-label="${escapeHtml(location.name)}"
            >
              <span class="place-icon">
                <img src="${LOCATION_ICONS[location.id] ?? ""}" alt="${escapeHtml(location.name)}" width="44" height="44" />
              </span>
              <strong>${escapeHtml(location.name)}</strong>
            </article>
          `,
        )
        .join("")}
      ${state.residents.map((resident) => renderStageResident(state, resident, uiState.selectedResidentId)).join("")}
      ${
        latestEvent
          ? `
          <aside class="stage-bubble" aria-live="polite">
            <span class="stage-bubble__tag">📌 最新动态</span>
            <p>${escapeHtml(latestEvent.text)}</p>
          </aside>`
          : ""
      }
      <div class="stage-legend" aria-hidden="true">
        <span class="stage-legend__item"><i class="status-dot status-dot--happy"></i>开心</span>
        <span class="stage-legend__item"><i class="status-dot status-dot--steady"></i>平稳</span>
        <span class="stage-legend__item"><i class="status-dot status-dot--tired"></i>疲惫</span>
      </div>
    </div>
  `;
}

function renderLocationCard(state, location) {
  const residents = getResidentsAtLocation(state, location.id);
  const residentList = residents.length
    ? residents.map((resident) => {
        const task = getTask(resident.assignmentId);
        return `<span class="mini-avatar" title="${escapeHtml(resident.name)} - ${escapeHtml(task?.label ?? "")}">${getResidentAvatarImg(resident, 22)}</span>`;
      }).join("")
    : "";

  return `
    <article class="location location--${escapeHtml(location.tone)}">
      <div class="location__icon">
        <img src="${LOCATION_ICONS[location.id] ?? ""}" alt="${escapeHtml(location.name)}" />
      </div>
      <div class="location__info">
        <h3>${escapeHtml(location.name)}</h3>
        <div class="location__residents" aria-label="这里的居民">${residentList || '<span class="empty-note">-</span>'}</div>
      </div>
    </article>
  `;
}

// ── Spotlight (Resident Detail) ────────────────────────────────────────────────

function renderSpotlight(state, uiState) {
  const selected = state.residents.find((resident) => resident.id === uiState.selectedResidentId) ?? state.residents[0];
  if (!selected) return "";

  const task = getTask(selected.assignmentId);
  const location = getLocation(selected.locationId);
  const status = residentStatus(selected);

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

function renderResidentCard(resident, selectedResidentId) {
  const task = getTask(resident.assignmentId);
  const location = getLocation(resident.locationId);
  const status = residentStatus(resident);

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

function renderM3EventItem(event, residents) {
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

  return `
    <article class="feed-item feed-item--m3-event">
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
      ${event.suggestedFollowUp ? `<p class="m3-event__followup">💡 ${escapeHtml(event.suggestedFollowUp)}</p>` : ""}
    </article>
  `;
}


function renderTownBroadcastItem(event, residents) {
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
    <article class="feed-item feed-item--town-broadcast">
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

function renderEventFeed(state) {
  const events = [...state.events].reverse().slice(0, 12);
  const typeIcon = { action: "🏃", social: "💬", system: "🔔", report: "📰", "m3-event": "🎭", "town-broadcast": "📻" };

  return `
    <section class="panel">
      <div class="panel__head">
        <h2>📟 小镇动态</h2>
        <span class="panel-badge">${events.length} 条</span>
      </div>
      <div class="feed" aria-live="polite">
        ${events
          .map((event) => {
            if (event.type === "m3-event") {
              return renderM3EventItem(event, state.residents);
            }
            if (event.type === "town-broadcast") {
              return renderTownBroadcastItem(event, state.residents);
            }
            return `
              <article class="feed-item feed-item--${escapeHtml(event.type)}">
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
  root.querySelector("[data-action='reset-assignments']").addEventListener("click", handlers.onResetAssignments);
  root.querySelector("[data-action='new-town']").addEventListener("click", handlers.onNewTown);
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
          <div class="locations">
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
          ${renderEventFeed(state)}
          ${renderRelationships(state)}
          ${renderReports(state)}
        </div>
        <section class="residents-grid">
          <div class="section-head">
            <div>
              <p class="eyebrow">👥 居民</p>
              <h2>每日安排</h2>
            </div>
          </div>
          <div class="resident-list">
            ${state.residents.map((resident) => renderResidentCard(resident, safeUiState.selectedResidentId)).join("")}
          </div>
        </section>
      </section>

      ${renderProjectMeaning()}
    </div>
  `;

  bindEvents(root, handlers);
}
