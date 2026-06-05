import { locations, phases, tasks } from "../data/seed.js";
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
      <div class="meter__top"><span>${safeLabel}</span><strong>${safeValue}</strong></div>
      <div class="meter__track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${safeValue}">
        <span class="meter__bar meter__bar--${tone}" style="width:${pct(value)}"></span>
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
      <div>
        <p class="eyebrow">Multi-Agent Cozy Sim</p>
        <h1>AI Town Life</h1>
        <p class="hero__copy">Arrange a relaxed day for the residents, then watch jobs, moods, memories, and relationships evolve.</p>
      </div>
      <figure class="hero-art" aria-hidden="true">
        <img src="./src/assets/town-scene.svg" alt="" />
      </figure>
      <div class="day-card" aria-label="Current day and phase">
        <span>Day ${state.day}</span>
        <strong>${escapeHtml(phase.label)}</strong>
        <div class="phase-track">${phaseSteps}</div>
      </div>
    </header>
  `;
}

function renderTips(state) {
  const tips = getTownTips(state);
  return `
    <section class="panel tips">
      <div class="panel__head">
        <h2>Town Tips</h2>
        <span>Auto</span>
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
  return `
    <section class="panel llm-status llm-status--${escapeHtml(uiState.llmStatus)}">
      <div class="panel__head">
        <h2>MiniMax Agent</h2>
        <span>${escapeHtml(uiState.llmStatus)}</span>
      </div>
      <p>${escapeHtml(uiState.llmMessage)}</p>
    </section>
  `;
}

function renderTownStats(state) {
  return `
    <section class="stats" aria-label="Town stats">
      ${meter("Comfort", state.town.comfort, "green")}
      <div class="stat-pill"><span>Supplies</span><strong>${state.town.supplies}</strong></div>
      ${meter("Spirit", state.town.spirit, "gold")}
    </section>
  `;
}

function renderGoals(state) {
  const goals = getTownGoals(state);
  return `
    <section class="panel goals">
      <div class="panel__head">
        <h2>Town Goals</h2>
        <span>${goals.filter((goal) => goal.value >= goal.target).length}/${goals.length}</span>
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

function renderLocationCard(state, location) {
  const residents = getResidentsAtLocation(state, location.id);
  const residentList = residents.length
    ? residents.map((resident) => `<span class="mini-avatar" title="${escapeHtml(resident.name)}">${escapeHtml(resident.avatar)}</span>`).join("")
    : `<span class="empty-note">No resident</span>`;

  return `
    <article class="location location--${escapeHtml(location.tone)}">
      <div class="location__icon" aria-hidden="true">${escapeHtml(location.icon)}</div>
      <div>
        <h3>${escapeHtml(location.name)}</h3>
        <p>${escapeHtml(location.description)}</p>
        <div class="location__residents" aria-label="Residents here">${residentList}</div>
      </div>
    </article>
  `;
}

function residentOffset(index) {
  const offsets = [
    { x: -3, y: -5 },
    { x: 3, y: -4 },
    { x: -5, y: 3 },
    { x: 5, y: 4 },
    { x: 0, y: 7 },
  ];
  return offsets[index % offsets.length];
}

function locationPosition(locationId) {
  return getLocation(locationId)?.position ?? { x: 50, y: 50 };
}

function residentStatus(resident) {
  if (resident.energy < 30) {
    return { id: "tired", label: "Tired" };
  }
  if (resident.mood < 45) {
    return { id: "low-mood", label: "Low mood" };
  }
  if (resident.mood >= 82) {
    return { id: "happy", label: "Happy" };
  }
  return { id: "steady", label: "Steady" };
}

function renderStageResident(state, resident, selectedResidentId) {
  const residentsAtLocation = getResidentsAtLocation(state, resident.locationId);
  const index = residentsAtLocation.findIndex((item) => item.id === resident.id);
  const offset = residentOffset(index);
  const current = locationPosition(resident.locationId);
  const previous = locationPosition(resident.previousLocationId ?? resident.locationId);
  const task = getTask(resident.assignmentId);
  const status = residentStatus(resident);

  return `
    <button
      class="stage-resident stage-resident--${escapeHtml(status.id)}"
      data-resident-select="${escapeHtml(resident.id)}"
      type="button"
      title="${escapeHtml(resident.name)} / ${escapeHtml(task.label)} / ${escapeHtml(status.label)}"
      style="--x:${current.x + offset.x}%; --y:${current.y + offset.y}%; --from-x:${previous.x + offset.x}%; --from-y:${previous.y + offset.y}%;"
      aria-label="${escapeHtml(resident.name)} at ${escapeHtml(getLocation(resident.locationId).name)}, ${escapeHtml(task.label)}, ${escapeHtml(status.label)}"
      aria-pressed="${resident.id === selectedResidentId ? "true" : "false"}"
    >
      <em>${escapeHtml(task.icon)}</em>
      <span>${escapeHtml(resident.avatar)}</span>
      <i>${escapeHtml(resident.name)}</i>
      <b>${escapeHtml(task.label)}</b>
    </button>
  `;
}

function renderTownStage(state, uiState) {
  const latestEvent = [...state.events].reverse().find((event) => event.type !== "system");
  const phase = getCurrentPhase(state);
  return `
    <div class="town-stage town-stage--${escapeHtml(phase.id)}" aria-label="Animated town stage for ${escapeHtml(phase.label)}">
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
      ${locations
        .map(
          (location) => `
            <article
              class="stage-place stage-place--${escapeHtml(location.tone)}"
              style="--x:${location.position.x}%; --y:${location.position.y}%;"
              aria-label="${escapeHtml(location.name)} place"
            >
              <span>${escapeHtml(location.icon)}</span>
              <strong>${escapeHtml(location.name)}</strong>
            </article>
          `,
        )
        .join("")}
      ${state.residents.map((resident) => renderStageResident(state, resident, uiState.selectedResidentId)).join("")}
      ${
        latestEvent
          ? `<aside class="stage-bubble" aria-live="polite"><span>Latest</span><p>${escapeHtml(latestEvent.text)}</p></aside>`
          : ""
      }
      <div class="stage-legend" aria-hidden="true">
        <span><i class="status-dot status-dot--happy"></i>Happy</span>
        <span><i class="status-dot status-dot--steady"></i>Steady</span>
        <span><i class="status-dot status-dot--tired"></i>Tired</span>
      </div>
    </div>
  `;
}

function renderSpotlight(state, uiState) {
  const selected = state.residents.find((resident) => resident.id === uiState.selectedResidentId) ?? state.residents[0];
  if (!selected) return "";

  const task = getTask(selected.assignmentId);
  const location = getLocation(selected.locationId);
  return `
    <section class="panel spotlight">
      <div class="panel__head">
        <h2>Resident Spotlight</h2>
        <span>${escapeHtml(location.name)}</span>
      </div>
      <div class="spotlight__body">
        <div class="avatar spotlight__avatar" aria-hidden="true">${escapeHtml(selected.avatar)}</div>
        <div>
          <h3>${escapeHtml(selected.name)}</h3>
          <p>${escapeHtml(selected.role)} / ${escapeHtml(selected.skill)}</p>
        </div>
      </div>
      <div class="spotlight__plan">
        <span>Current plan</span>
        <strong>${escapeHtml(task.label)}</strong>
      </div>
      <div class="spotlight__status">
        <span>${escapeHtml(residentStatus(selected).label)}</span>
        <span>${escapeHtml(selected.personality)}</span>
      </div>
      ${meter("Mood", selected.mood, "rose")}
      ${meter("Energy", selected.energy, "blue")}
      <p class="spotlight__memory">${escapeHtml(selected.memory[0] ?? "No memory yet.")}</p>
    </section>
  `;
}

function renderResidentCard(resident, selectedResidentId) {
  const task = getTask(resident.assignmentId);
  const location = getLocation(resident.locationId);
  return `
    <article class="resident ${resident.id === selectedResidentId ? "resident--selected" : ""}" data-resident-card="${escapeHtml(resident.id)}">
      <div class="resident__head">
        <div class="avatar" aria-hidden="true">${escapeHtml(resident.avatar)}</div>
        <div>
          <h3>${escapeHtml(resident.name)}</h3>
          <p>${escapeHtml(resident.role)} / ${escapeHtml(resident.skill)}</p>
        </div>
      </div>
      <p class="resident__personality">${escapeHtml(resident.personality)}</p>
      <div class="resident__meta">
        <span>Location: ${escapeHtml(location.name)}</span>
        <span>Plan: ${escapeHtml(task.label)}</span>
      </div>
      ${meter("Mood", resident.mood, "rose")}
      ${meter("Energy", resident.energy, "blue")}
      <label class="select-label">
        <span>Assign task</span>
        <select data-resident-task="${escapeHtml(resident.id)}" aria-label="Assign task to ${escapeHtml(resident.name)}">
          ${taskOptions(resident.assignmentId)}
        </select>
      </label>
      <details>
        <summary>Recent memory</summary>
        <ul class="memory-list">
          ${resident.memory.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </details>
    </article>
  `;
}

function renderEventFeed(state) {
  const events = [...state.events].reverse().slice(0, 12);
  return `
    <section class="panel">
      <div class="panel__head">
        <h2>Event Feed</h2>
        <span>${events.length} items</span>
      </div>
      <div class="feed" aria-live="polite">
        ${events
          .map(
            (event) => `
              <article class="feed-item feed-item--${escapeHtml(event.type)}">
                <span>Day ${event.day} - ${escapeHtml(event.phase)}</span>
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
        <h2>Relationships</h2>
        <span>Top 5</span>
      </div>
      <div class="relations">
        ${pairs
          .map(
            (pair) => `
              <div class="relation">
                <span>${escapeHtml(pair.a.name)} - ${escapeHtml(pair.b.name)}</span>
                <strong>${pair.value}</strong>
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
  const report = state.reports[0];
  if (!report) {
    return `
      <section class="panel report">
        <div class="panel__head"><h2>Daily Report</h2></div>
        <p class="empty-note">A report will appear after the evening phase ends.</p>
      </section>
    `;
  }

  return `
    <section class="panel report">
      <div class="panel__head">
        <h2>${escapeHtml(report.title)}</h2>
        <span>${escapeHtml(report.phase)}</span>
      </div>
      <p>${escapeHtml(report.summary)}</p>
      <ul>
        ${report.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
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
  const nextPhaseLabel = state.phaseIndex === phases.length - 1 ? "End Today" : `Go to ${phases[state.phaseIndex + 1].label}`;

  root.innerHTML = `
    <div class="shell">
      ${renderHeader(state)}
      ${renderTownStats(state)}
      <main class="layout">
        <section class="map-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Town Map</p>
              <h2>Places</h2>
            </div>
            <div class="actions">
              <button class="button button--ghost" type="button" data-action="reset-assignments">Default Plans</button>
              <button class="button button--ghost" type="button" data-action="run-day">Run Day</button>
              <button class="button button--ai" type="button" data-action="minimax-plan" ${safeUiState.llmStatus === "loading" ? "disabled" : ""}>
                ${safeUiState.llmStatus === "loading" ? "Planning..." : "MiniMax Plan"}
              </button>
              <button class="button ${safeUiState.autoPlay ? "button--live" : "button--ghost"}" type="button" data-action="toggle-auto">
                ${safeUiState.autoPlay ? "Pause Auto" : "Auto Play"}
              </button>
              <button class="button button--ghost" type="button" data-action="new-town">New Town</button>
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
            <p class="eyebrow">Residents</p>
            <h2>Daily Plans</h2>
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
