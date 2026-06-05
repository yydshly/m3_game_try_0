# 03_CLAUDE_CODE_PROMPT - 可直接粘贴给 Claude Code / M3

你现在接手项目：

Repo: https://github.com/yydshly/m3_game_try_0.git
项目名: AI Town Life

当前目标：
以 `docs/ui-reference/desktop-target.png` 和 `docs/ui-reference/mobile-target.png` 为视觉目标，将当前页面升级为“治愈系小镇模拟游戏”主界面。

这不是普通美化任务，而是游戏 UI 落地任务。

## 一、开始前检查

请先执行：

```bash
git status
git branch --show-current
git log --oneline -5
npm run check
npm run agent-check
```

如当前不在功能分支，请新建：

```bash
git checkout -b feature/game-like-ui-target
```

## 二、硬约束

必须遵守：

1. 不引入 React / Vue / Svelte。
2. 不引入第三方依赖。
3. 不新增 npm 包。
4. 不改动 MiniMax API 核心逻辑。
5. 不改动 simulation 核心规则。
6. 优先只改：
   - `src/ui/render.js`
   - `src/styles.css`
   - 必要时少量改 `src/app.js`
7. 不提交：
   - `config.local.json`
   - API Key
   - `node_modules`
8. 每一阶段改完都要保证页面能打开。

## 三、视觉目标

请认真参考：

- `docs/ui-reference/desktop-target.png`
- `docs/ui-reference/mobile-target.png`

目标效果：

- 第一眼像游戏，而不是后台
- 中央小镇地图是主视觉
- 左侧是今日目标和操作按钮
- 右侧是居民角色详情
- 底部是小镇动态和日报
- 顶部是游戏 HUD
- 整体温暖、治愈、可爱、手账感

## 四、请按阶段执行，不要一次性乱改

### P1：CSS 设计系统

先在 `src/styles.css` 顶部建立设计变量：

- 奶油白 / 暖米色 / 草绿 / 阳光黄 / 天空蓝 / 柔紫 / 玫瑰粉
- 圆角
- 阴影
- transition
- panel/card/button/meter 基础样式

### P2：布局改造

重构 `renderApp()` 的主结构，让页面形成：

```text
顶部：HUD
左侧：今日目标 + 操作按钮 + AI 管家
中间：小镇地图
右侧：居民详情
底部：小镇动态 + 邻里关系 + 小镇日报
```

推荐 class：

```html
<main class="game-shell">
  <section class="game-hud">...</section>
  <section class="game-board">
    <aside class="game-left">...</aside>
    <section class="game-main">...</section>
    <aside class="game-right">...</aside>
  </section>
  <section class="game-story">...</section>
</main>
```

### P3：地图游戏化

强化 `town-stage`：

- 草地背景
- 小路/路径装饰
- 地点节点卡片
- 居民角色气泡
- 最新动态气泡
- 中文图例：开心 / 平稳 / 疲惫 / 低落

### P4：角色面板游戏化

强化 Resident Spotlight：

文案：
- `Resident Spotlight` → `👤 居民详情`
- `Current plan` → `当前安排`
- `Mood` → `心情`
- `Energy` → `体力`
- `Recent memory` → `📝 最近记忆`
- `decisionReason` → `当前想法`

展示：
- 头像
- 姓名
- 职业
- 性格
- 心情条
- 体力条
- Agent Needs：🌙休息 / 💬社交 / ⭐成就
- 当前任务
- 当前想法
- 最近记忆

### P5：操作区游戏化

按钮文案：

- `Advance` → `推进阶段`
- `Run Day` → `结束今天`
- `Auto Play` → `▶️ 自动推进`
- `Pause Auto` → `⏸️ 暂停`
- `MiniMax Plan` → `🤖 AI 管家安排`
- `Default Plans` → `重置安排`
- `New Town` → `🏠 新小镇`

按钮样式：
- 推进阶段：绿色主按钮
- AI 管家：蓝色按钮
- 结束今天：紫色按钮
- 按钮 hover 上浮
- active scale(0.97)

### P6：故事区游戏化

- `Event Feed` → `📟 小镇动态`
- `Relationships` → `💕 邻里关系`
- `Daily Report` → `📰 小镇日报`

事件图标：

- action: 🏃
- social: 💬
- system: 🔔
- report: 📰

日报样式：
- 独立背景
- 虚线边框
- 小报纸感
- 摘要高亮
- 查看详情按钮或视觉 CTA

### P7：移动端

`@media (max-width: 900px)`：

- 单列
- 顶部 HUD 可换行
- 地图优先显示
- 左右栏依次堆叠
- 按钮触控友好
- 不横向溢出

## 五、AI 管家错误文案

如果 MiniMax API Key 未配置，不要显示技术错误。前端展示应更友好：

```text
AI 管家暂时还没准备好，你可以先手动安排居民今天的生活。
```

保留 console 或内部错误可以，但 UI 不要吓用户。

## 六、验收

运行：

```bash
npm run check
npm run agent-check
npm run smoke
npm run render-check
npm run dev
```

打开：

```text
http://127.0.0.1:4173
```

验收标准：

1. 第一眼像游戏
2. 顶部 HUD 明显
3. 地图是主视觉
4. 五个地点清晰
5. 居民像角色
6. 操作按钮像游戏按钮
7. 居民详情像角色面板
8. 小镇动态像故事流
9. 日报有仪式感
10. 移动端可用
11. 所有脚本通过

## 七、提交

完成后：

```bash
git status
git diff --stat
git diff
git add src/ui/render.js src/styles.css src/app.js
git commit -m "style: implement game-like town UI target"
```

如果 `src/app.js` 未改动，不要强行 add。

## 八、完成后输出

请输出：

1. 改了哪些文件
2. 页面结构如何变化
3. 哪些地方最接近参考图
4. 哪些英文文案改成中文
5. 哪些视觉元素已实现
6. 验证脚本通过情况
7. 截图路径或本地预览说明
8. 未完成项
