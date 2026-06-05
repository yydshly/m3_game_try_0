# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Town Life is a lightweight multi-agent town simulation. Residents move through 3 daily phases (morning/afternoon/evening), perform tasks at 5 locations, maintain mood/energy, form relationships, and generate daily reports.

## Commands

```bash
npm run dev        # Start dev server at http://127.0.0.1:4173
npm run check      # Smoke test: advance 3 phases, verify day 2 and report
npm run agent-check # Validate ResidentAgent model: needs clamped 0-100, decisionReason set
npm run smoke      # HTTP server availability check
npm run render-check # DOM render integrity check (stage, residents, legend, etc.)
npm run mobile     # Start with 0.0.0.0 binding for phone access on same LAN
```

## Architecture

```
src/
  app.js              # Entry point; loadState/upgradeState, commit/render loop
  data/seed.js        # Static seed: 5 residents, 5 locations, 6 tasks, 3 phases
  domain/
    agent.js          # ResidentAgent model: needs (rest/social/achievement), goals, decisionReason
    simulation.js     # advancePhase(), chooseAgentTask(), assignTask(), applyAgentPlan()
    selectors.js       # Derived data: getTownTips, getTownGoals, getTopRelationships
    state.js          # createInitialState(), upgradeState() for localStorage migration
  services/
    minimaxClient.js   # requestMiniMaxPlan() — sends compactState to /api/minimax/plan
    narrator.js        # narrateAction(), createDailyReport(), describeMemory()
    persistence.js     # localStorage read/write with isValidState() guard
  ui/
    render.js          # renderApp() — pure DOM rendering, bindEvents() for user actions
```

**Key boundaries:**
- `domain/` has no DOM dependency — can run in Node.js or test runner
- `services/narrator.js` is the LLM integration point (currently rule-based)
- `services/minimaxClient.js` requires a server-side `/api/minimax/plan` endpoint; falls back gracefully if unavailable
- `ui/render.js` never mutates state directly — emits events to app.js handlers

## ResidentAgent Model

Each resident has an `agent` sub-object:

```js
resident.agent = {
  needs: { rest: 0-100, social: 0-100, achievement: 0-100 },
  goals: { shortTerm: string, longTerm: string },
  decisionReason: string  // e.g. "energy low, needs rest", "follows preferred task"
}
```

`chooseAgentTask()` returns `{task, reason}` — reason is set as `resident.agent.decisionReason` in `advancePhase()`. Needs are updated by `updateAgentNeeds()` each phase and clamped to [0, 100].

`ensureResidentAgent()` is called on every resident load to guarantee the agent field exists (handles old localStorage state that predates the agent model).

## State Shape

```js
{
  day: number, phaseIndex: number,        // day 1+, phase 0-2
  town: { comfort, supplies, spirit },     // 0-100 each
  residents: [{ id, name, mood, energy, locationId, assignmentId,
                memory: string[], agent: ResidentAgent, ... }],
  relationships: { [residentId]: { [otherId]: number } },
  events: [{ id, day, phase, type, text }],
  reports: [{ id, day, title, phase, summary, highlights }]
}
```

## MiniMax Integration

MiniMax is called via POST `/api/minimax/plan` with a `compactState()` payload. The server responds with `{ assignments: [{residentId, taskId, reason}], townNote? }`. `applyAgentPlan()` merges assignments into state, setting `agent.decisionReason` and prepending to memory.

## Data Flow

1. `app.js` loads state from localStorage (or creates fresh)
2. User action → handler in `app.js` → domain mutation → `commit()` → `saveState()` + `render()`
3. `advancePhase()`: each resident picks task via `chooseAgentTask()`, state is updated, `processSocialEvents()` applies relationship changes
4. After evening phase (`phaseIndex === 2`): daily report is prepended, `day++`, `phaseIndex=0`, energy/mood restored

## Validation Scripts

- `scripts/check.mjs` — 3-phase advance → day 2, 1 report, 5 residents
- `scripts/agent-check.mjs` — agent fields exist, needs in [0,100], decisionReason non-empty, reports generated
- `scripts/smoke.mjs` — HTTP server returns 200 for index and assets
- `scripts/render-check.mjs` — DOM contains stage, 5 residents, 5 places, legend, etc.
