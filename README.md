# AI Town Life

AI 小镇生活是一个轻量 Web 原型，验证 **MiniMax-M3 能否作为小镇游戏世界中的规划者、事件导演、广播员和记忆引用者**。

---

## V1 技术探索完成与冻结状态

**AI 小镇生活 V1 技术探索原型已冻结。**

V1 已完成核心技术验证。本版本不是一个功能完整的商业游戏，而是一个经过完整闭环验证的 AI 小镇生活原型。当前代码适合作为参考样机和经验沉淀，**不建议继续在当前代码库上直接堆功能进入 V2 开发**。后续若继续，应先做完整游戏设计，再决定是重构、复用模块还是新建项目。

### 入口

- 游戏主界面顶部：**V1 项目总结 →**（新标签页打开）
- [AI 小镇生活 V1 项目总结展示页](docs/V1_PROJECT_SUMMARY_SHOWCASE.html)
- [AI 小镇生活 V1 复盘与后续游戏设计规划](docs/V1_RETROSPECTIVE_AND_GAME_DESIGN_PLAN.md)

---

## V1 验证了什么

```
居民有状态（体力、心情、记忆）
  → AI 规划居民行动
    → 舞台动画呈现行动
      → AI 生成事件
        → 玩家做选择
          → 小镇记住选择
            → 后续广播/事件/对话引用状态和记忆
```

**MiniMax-M3 在 V1 中验证了四个角色：**

- **规划者** — AI Director 根据小镇状态 + 记忆选择生活场景，安排居民任务
- **叙事导演** — M3 生成小镇事件（标题、文案、地点、涉及居民、选项）
- **广播员** — M3 生成小镇广播文案与音乐氛围提示词
- **记忆引用者** — buildPromptMemoryNarrative 将选择记忆和居民记忆注入 prompt

---

## V1 已完成能力

| 能力 | 说明 |
|------|------|
| 小镇 UI 主界面 | 插画式小镇舞台、居民状态、任务安排、地图演出 |
| 居民任务与移动 | 5 位居民 × 5 个地点 × 6 种任务，CSS 关键帧移动动画 |
| 任务完成反馈 | 头顶徽章（🌸 🍲 🔧 💬 🌿 💤）+ 右侧面板状态 |
| M3 小镇规划 | AI Director 选择生活场景，安排居民任务 |
| M3 小镇事件 | M3 生成事件（标题、文案、地点、选项），玩家二选一 |
| M3 小镇广播 | M3 生成广播文案，附音乐氛围提示词 |
| 玩家选择反馈 | choiceAftermath 即时反馈 + 地图浮动徽章 |
| 居民记忆 | 每位居民最近 8 条记忆，自然语言摘要注入 M3 prompt |
| 小镇记忆 | 玩家选择记忆链路，优先级注入广播/事件 prompt |
| 居民对话队列 | M3 生成短对白 + 本地 fallback，按序演出 |
| 点击居民反馈 | 心情表情、关系状态、近期记忆 |
| 地点特效 | bloom / steam / spark / chat / leaf / rest 动画 |
| 对话顺序稳定 | 保持对话模板原始问答顺序，避免 seed 轮转打乱语义 |
| 舞台演出锁步 | 移动 → 任务气泡 → 地点特效 → 完成徽章，动画锁步 |
| 第二天开场回响 | 「🌿 昨日回响」注入广播/事件 prompt |
| MiniMax TTS | 广播语音合成 + 全局语音播放条 |
| MiMo TTS | 居民对白场景语音，每个居民独立按钮 |

---

## V1 当前边界

以下不是 bug，是 V1 有意设定的边界：

- **还不是完整商业游戏** — 原型验证技术可行性，不在 V1 解决游戏目标问题
- **玩法目标较弱** — 玩家每天回来做什么，由 V2 游戏设计回答
- **长期成长线较弱** — 居民关系线还没有系统化，V2 需要设计关系演进机制
- **事件后果还偏轻** — 选择只写记忆，不直接修改数值；V2 需要设计有意义的后果
- **玩家长期动机还需要设计** — 这是游戏设计问题，不是技术问题
- **对话仍是模板/轻生成混合** — 本地 fallback 基于任务类型 × 场景矩阵，不是完整自由对话
- **地图和人物仍是轻量原型** — 不是美术级资产，V2 需要明确风格方向
- **TTS 和音乐不是当前主线** — V1 不做多角色连续语音剧，不做背景音乐生成

---

## 如何运行

```powershell
cd ai-town-life
node scripts/server.mjs
# 打开 http://127.0.0.1:4173
```

无需 API Key 即可运行完整闭环（使用本地 fallback 数据）。

如需启用 AI 管家安排：

```powershell
Copy-Item config.example.json config.local.json
# 编辑 config.local.json，填入 API Key
node scripts/server.mjs
```

---

## 查看项目总结

- **游戏内**：主界面顶部点击 **V1 项目总结 →**（新标签页打开 `docs/V1_PROJECT_SUMMARY_SHOWCASE.html`）
- **直接打开**：[docs/V1_PROJECT_SUMMARY_SHOWCASE.html](docs/V1_PROJECT_SUMMARY_SHOWCASE.html)
- **详细复盘**：[docs/V1_RETROSPECTIVE_AND_GAME_DESIGN_PLAN.md](docs/V1_RETROSPECTIVE_AND_GAME_DESIGN_PLAN.md)

---

## 验证脚本

所有脚本可在无 API Key 情况下运行：

```powershell
node scripts/render-check.mjs   # DOM 完整性 + V1 入口断言
node scripts/check.mjs           # 3 阶段推进 → day 2 + 日报
node scripts/agent-check.mjs     # ResidentAgent model: needs 0-100, decisionReason
node scripts/smoke.mjs           # HTTP server 200
```

---

## 架构

```
src/
  app.js              # 入口，状态提交，render fallback
  data/seed.js        # 5 位居民、5 个地点、6 种任务、3 个阶段
  domain/
    simulation.js     # advancePhase()，chooseAgentTask()，assignTask()
    selectors.js      # getTownTips，getTownGoals，getTopRelationships
    state.js          # createInitialState()，upgradeState()
  services/
    minimaxClient.js  # requestMiniMaxPlan()，fallback 模式
    narrator.js       # 事件文案、日报、内存描述
    persistence.js    # localStorage 读写
  ui/
    render.js         # 纯 DOM 渲染，bindEvents()
```

- `domain/` 不依赖 DOM，可独立运行于 Node.js
- `services/narrator.js` 是未来 LLM 集成点
- `ui/render.js` 只渲染状态，不直接修改状态

---

## Roadmap 状态

V1 技术探索已完成，当前路线已冻结。

本仓库不再直接推进功能型 V2。居民详情、建筑升级、用户自定义居民等方向属于历史想法，不在当前代码库继续开发。

如果未来重启，应先完成游戏设计文档，再决定新建项目、重构或复用部分模块。

---

## V1 历史能力记录

以下为 V1 开发过程中逐步实现的能力记录，按时间顺序保留，供后续参考。

### AI Director

根据居民任务分布、心情、小镇记忆自动选择 8 种生活场景（邻里互助、花园日、集市采购、设施修理、安静阅读、节日准备、天气变化、居民心情），为 M3 广播和事件提供叙事上下文。

### 插画式小镇舞台

中央地图升级为分层 SVG 背景（草地、道路、建筑、喷泉、树木），地点以游戏风格木牌悬浮，居民以角色令牌形式出现，头顶任务气泡。

### 任务动画层

纯 DOM/CSS 任务动画：travel + work/chat/rest + 气泡 + 地点特效（bloom/steam/spark/chat/leaf/rest）。动画持续约 3 秒，`prefers-reduced-motion` 降级支持。

### 居民移动动画

`advancePhase()` 推进前记录 `locationId`，推进后对比 `fromPlaceId → toPlaceId`，产生 `traveling: true` 标志和 CSS 变量（`--from-x/--from-y/--to-x/--to-y`），驱动 `characterTravel` 关键帧动画。步态根据任务推断：采集=run，休息=slow，其余=walk；体力低于 30 也慢走。

### 动画节奏锁步

`uiState.isAnimating` 控制锁步：动画开始时 `true`，显示"居民正在行动中……"横幅，所有推进按钮禁用。递归 `setTimeout` 在 `TASK_ANIMATION_DURATION_MS`（3250ms）后安排下一阶段。

### 小镇氛围与广播

MiniMax-M3 根据天数、阶段、居民状态、小镇资源、最近事件生成广播文案（标题、文案、氛围、音乐提示词）。**MiniMax TTS**（speech-2.8-hd）合成语音，**MiMo TTS**（mimo-v2.5-tts）用于居民对白场景。**当前明确不做**：多角色连续语音剧、声音克隆、WebSocket 流式 TTS、背景音乐生成。

### 事件选择与记忆联动

M3 生成事件带两个温和选择，玩家二选一后写入 `townMemory`（player-choice 类型）和 `residentMemory`。`buildDayOpeningReflection()` 优先级：choiceAftermath > townMemory player-choice > residentMemory > fallback。广播/事件/对白 prompt 均注入 `openingReflection`。

### API Style Configuration

| Style | Endpoint | Use Case |
|-------|----------|----------|
| `anthropic`（默认） | `${anthropicBaseUrl}/v1/messages` | MiniMax-M3 + Anthropic Messages API |
| `openai` | `${baseUrl}/chat/completions` | MiniMax-M2.1 OpenAI-compatible API |

通过 `MINIMAX_API_STYLE` 环境变量或 `config.local.json` 设置。

### 手机访问

```powershell
npm run mobile   # 打印 LAN URL
```
手机和电脑在同一 Wi-Fi 下，打开显示的 LAN URL 即可。

### 部署

- **Netlify**：`netlify.toml` 已包含，Publish directory 为 `.`
- **GitHub Pages**：发布 `ai-town-life` 目录，`.nojekyll` 已包含
- **Vercel**：Framework Preset 选择 Other，Output Directory 为 `.`
