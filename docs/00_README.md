# AI 小镇生活 UI 资源包

用途：辅助 Claude Code / M3 将当前 `m3_game_try_0` 项目 UI 改造成接近参考图的治愈系小镇模拟游戏界面。

## 包含内容

- `reference/desktop-target.png`：桌面端视觉目标参考图
- `reference/mobile-target.png`：移动端视觉目标参考图
- `01_VISUAL_SPEC.md`：视觉规范
- `02_TASK_BREAKDOWN.md`：任务拆分
- `03_CLAUDE_CODE_PROMPT.md`：可直接粘贴给 Claude Code 的执行指令
- `04_CSS_TOKENS.css`：建议复制进 `src/styles.css` 顶部的设计变量
- `05_RENDER_STRUCTURE_GUIDE.md`：`render.js` 结构改造建议
- `copy_to_project/src/assets/ui/`：可直接复制到项目中的轻量 SVG 资源

## 使用方式

1. 把 `reference/` 两张图给 Claude Code 作为视觉目标。
2. 把 `03_CLAUDE_CODE_PROMPT.md` 的内容粘贴给 Claude Code。
3. 让 Claude Code 先执行 P0/P1，不要一次性做完所有细节。
4. 每完成一轮，本地打开 `http://127.0.0.1:4173` 截图。
5. 把截图发给 ChatGPT，我继续按差距下发修正任务。
