# 05_RENDER_STRUCTURE_GUIDE - render.js 改造建议

## 推荐整体结构

将 `renderApp()` 输出调整为：

```html
<main class="game-shell">
  ${renderGameHud(state, controls, uiState)}

  <section class="game-board">
    <aside class="game-left">
      ${renderGoals(state)}
      ${renderControlPanel(state, controls, uiState)}
      ${renderTips(state)}
      ${renderLlmStatus(uiState)}
    </aside>

    <section class="game-main">
      ${renderTownStage(state, uiState)}
      ${renderLocationOverview(state)}
    </section>

    <aside class="game-right">
      ${renderSpotlight(state, uiState)}
    </aside>
  </section>

  <section class="game-story">
    ${renderEventFeed(state)}
    ${renderRelationships(state)}
    ${renderReports(state)}
  </section>
</main>
```

## 建议新增/拆分函数

- `renderGameHud(state, controls, uiState)`
- `renderControlPanel(state, controls, uiState)`
- `renderNeedBadges(resident)`
- `renderEventIcon(type)`
- `renderPhaseLabel(state)`
- `friendlyLlmMessage(uiState)`

## 注意事项

1. 保留原有事件绑定 data-action / data-resident-task / data-resident-select。
2. 不要破坏 controls 回调。
3. 所有用户可见文本走 escapeHtml。
4. UI 文案中文化。
5. 不要在 render.js 写复杂业务逻辑。
6. Agent 字段可能缺失时要兜底。

## Agent needs 兜底示例

```js
const needs = resident.agent?.needs ?? { rest: 0, social: 0, achievement: 0 };
```

## AI 错误文案兜底

```js
function friendlyLlmMessage(uiState) {
  if (uiState.llmStatus === "error") {
    return "AI 管家暂时还没准备好，你可以先手动安排居民今天的生活。";
  }
  return uiState.llmMessage;
}
```
