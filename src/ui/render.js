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

function renderHeader(state) {
  const phase = getCurrentPhase(state);
  const phaseSteps = phases
    .map((item, index) => `<span class="phase ${index === state.phaseIndex ? "phase--active" : ""}">${escapeHtml(item.label)}</span>`)
    .join("");

  return `
    <header class="hero">
      <div class="hero__left">
        <p class="eyebrow">🏡 治愈系小镇模拟</p>
        <h1>AI 小镇生活</h1>
        <p class="hero__copy">为居民安排一天的活动，看着小镇的故事慢慢展开~</p>
      </div>
      <figure class="hero-art" aria-hidden="true">
        <img src="./src/assets/town-scene.svg" alt="" />
      </figure>
      <div class="day-card" aria-label="当前天数和阶段">
        <span class="day-card__label">第 ${state.day} 天</span>
        <strong class="day-card__phase">${escapeHtml(phase.label)}</strong>
        <div class="phase-track">${phaseSteps}</div>
      </div>
    </header>
  `;
}

function renderTownStats(state) {
  return `
    <section class="stats" aria-label="小镇状态">
      ${meter("舒适度", state.town.comfort, "green")}
      <div class="stat-pill"><span>📦 物资</span><strong>${state.town.supplies}</strong></div>
      ${meter("精神", state.town.spirit, "gold")}
    </section>
  `;
}

function renderGoals(state) {
  const goals = getTownGoals(state);
  const completedCount = goals.filter((goal) => goal.value >= goal.target).length;
  return `
    <section class="panel goals">
      <div class="panel__head">
        <h2>🎯 今日目标</h2>
        <span class="panel-badge">${completedCount}/${goals.length}</span>
      </div>
      <div class="goal-list">
        ${goals
          .map((goal) => {
            const progress = Math.min(100, Math.round((goal.value / goal.target) * 100));
            return `
              <article class="goal ${goal.value >= goal.target ? "goal--done" : ""}">
                <div class="goal__top">
                  <strong>${escapeHtml(goal.label)}</strong>
                  <span>${Math.round(goal.value)}/${goal.target}</span>
                </div>
                <div class="goal__bar" aria-hidden="true"><i style="width:${progress}%"></i></div>
                <p>${escapeHtml(goal.detail)}</p>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderTips(state) {
  const tips = getTownTips(state);
  return `
    <section class="panel tips">
      <div class="panel__head">
        <h2>🏠 管家提示</h2>
      </div>
      <div class="tip-list">
        ${tips
          .map(
            (tip) => `
              <article class="tip">
                <strong>${escapeHtml(tip.title)}</strong>
                <p>${escapeHtml(tip.text)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderLlmStatus(uiState) {
  if (!uiState.llmMessage) return "";
  const statusIcon = uiState.llmStatus === "error" ? "⚠️" : uiState.llmStatus === "loading" ? "🤖" : "✨";
  const badgeLabel = { idle: "待机", loading: "思考中", ready: "就绪", error: "异常" };
  const friendlyMessage = (() => {
    if (uiState.llmStatus === "loading") return "🤖 AI 管家正在观察小镇状态……";
    if (uiState.llmStatus === "ready") return "✨ AI 管家已给出今天的安排建议~";
    if (uiState.llmStatus === "error") {
      if (uiState.llmMessage.includes("Failed to fetch") || uiState.llmMessage.includes("NetworkError") || uiState.llmMessage.includes("fetch")) {
        return "🤖 AI 管家暂时还没准备好，你可以先手动安排居民今天的生活~";
      }
      return "🤖 AI 管家遇到了一点问题：" + uiState.llmMessage;
    }
    return uiState.llmMessage;
  })();
  return `
    <section class="panel llm-status llm-status--${escapeHtml(uiState.llmStatus)}">
      <div class="panel__head">
        <h2>${statusIcon} AI 小镇管家</h2>
        <span class="llm-status-badge llm-status-badge--${escapeHtml(uiState.llmStatus)}">${badgeLabel[uiState.llmStatus] ?? uiState.llmStatus}</span>
      </div>
      <p>${escapeHtml(friendlyMessage)}</p>
    </section>
  `;
}

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
      class="stage-resident stage-resident--${escapeHtml(status.id)}"
      data-resident-select="${escapeHtml(resident.id)}"
      type="button"
      title="${escapeHtml(resident.name)} / ${escapeHtml(task.label)} / ${escapeHtml(status.label)}"
      style="--x:${current.x + offset.x}%; --y:${current.y + offset.y}%; --from-x:${previous.x + offset.x}%; --from-y:${previous.y + offset.y}%;"
      aria-label="${escapeHtml(resident.name)} 在 ${escapeHtml(getLocation(resident.locationId).name)} / ${escapeHtml(task.label)} / ${escapeHtml(status.label)}"
      aria-pressed="${resident.id === selectedResidentId ? "true" : "false"}"
    >
      <em>${escapeHtml(task.icon)}</em>
      <span class="resident-icon-wrap">${getResidentAvatarImg(resident, 40)}</span>
      <i>${escapeHtml(resident.name)}</i>
      <b>${escapeHtml(task.label)}</b>
    </button>
  `;
}

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
        return `<span class="mini-avatar" title="${escapeHtml(resident.name)} - ${escapeHtml(task?.label ?? "")}">${getResidentAvatarImg(resident, 24)}</span>`;
      }).join("")
    : `<span class="empty-note">暂无居民</span>`;

  return `
    <article class="location location--${escapeHtml(location.tone)}">
      <div class="location__icon" aria-hidden="true">${escapeHtml(location.icon)}</div>
      <div class="location__info">
        <h3>${escapeHtml(location.name)}</h3>
        <p>${escapeHtml(location.description)}</p>
        <div class="location__residents" aria-label="这里的居民">${residentList}</div>
      </div>
    </article>
  `;
}

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
        <div class="spotlight__avatar" aria-hidden="true">${getResidentAvatarImg(selected, 72)}</div>
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

function renderEventFeed(state) {
  const events = [...state.events].reverse().slice(0, 12);
  const typeIcon = { action: "🏃", social: "💬", system: "🔔", report: "📰" };

  return `
    <section class="panel">
      <div class="panel__head">
        <h2>📟 小镇动态</h2>
        <span class="panel-badge">${events.length} 条</span>
      </div>
      <div class="feed" aria-live="polite">
        ${events
          .map(
            (event) => `
              <article class="feed-item feed-item--${escapeHtml(event.type)}">
                <span class="feed-item__meta">
                  ${typeIcon[event.type] ?? "📌"} 第 ${event.day} 天 · ${escapeHtml(event.phase)}
                </span>
                <p>${escapeHtml(event.text)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

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

function bindEvents(root, handlers) {
  root.querySelector("[data-action='advance']").addEventListener("click", handlers.onAdvance);
  root.querySelector("[data-action='run-day']").addEventListener("click", handlers.onRunDay);
  root.querySelector("[data-action='toggle-auto']").addEventListener("click", handlers.onToggleAutoPlay);
  root.querySelector("[data-action='minimax-plan']").addEventListener("click", handlers.onMiniMaxPlan);
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

export function renderApp(root, state, handlers, uiState = {}) {
  const safeUiState = {
    selectedResidentId: uiState.selectedResidentId ?? state.residents[0]?.id ?? null,
    autoPlay: Boolean(uiState.autoPlay),
    llmStatus: uiState.llmStatus ?? "idle",
    llmMessage: uiState.llmMessage ?? "",
  };
  const nextPhaseLabel = state.phaseIndex === phases.length - 1 ? "🌙 结束今天" : `⏭️ 推进到${phases[state.phaseIndex + 1].label}`;

  root.innerHTML = `
    <div class="shell">
      ${renderHeader(state)}
      ${renderTownStats(state)}
      <main class="layout">
        <section class="map-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">🗺️ 小镇地图</p>
              <h2>五大地点</h2>
            </div>
            <div class="actions">
              <button class="button button--ghost" type="button" data-action="reset-assignments">🔄 重置安排</button>
              <button class="button button--ghost" type="button" data-action="run-day">🌙 结束今天</button>
              <button class="button button--ai" type="button" data-action="minimax-plan" ${safeUiState.llmStatus === "loading" ? "disabled" : ""}>
                ${safeUiState.llmStatus === "loading" ? "🤖 管家思考中..." : "🤖 AI 管家安排"}
              </button>
              <button class="button ${safeUiState.autoPlay ? "button--live" : "button--ghost"}" type="button" data-action="toggle-auto">
                ${safeUiState.autoPlay ? "⏸️ 暂停" : "▶️ 自动推进"}
              </button>
              <button class="button button--ghost" type="button" data-action="new-town">🏠 新小镇</button>
              <button class="button button--primary" type="button" data-action="advance">${escapeHtml(nextPhaseLabel)}</button>
            </div>
          </div>
          ${renderTownStage(state, safeUiState)}
          <div class="locations">
            ${locations.map((location) => renderLocationCard(state, location)).join("")}
          </div>
        </section>
        <aside class="side">
          ${renderLlmStatus(safeUiState)}
          ${renderSpotlight(state, safeUiState)}
          ${renderGoals(state)}
          ${renderTips(state)}
          ${renderEventFeed(state)}
          ${renderRelationships(state)}
          ${renderReports(state)}
        </aside>
      </main>
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
    </div>
  `;

  bindEvents(root, handlers);
}
