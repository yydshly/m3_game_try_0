# AI Town Life

A lightweight, friendly multi-agent AI-driven town life simulation prototype.

The V1 prototype validates a complete playable loop: residents move through daily phases, receive AI-generated tasks, perform on an illustrated stage, generate short dialogues, receive town broadcasts and events, and let players make choices that the town remembers the next day.

## Why This Project Exists

AI Town Life is not only a cozy town simulation prototype. It is also an experiment in using MiniMax-M3 as a planning brain, narrative director, broadcast writer, dialogue generator, and memory system for an AI-driven game world.

The project explores three questions:

1. Can a lightweight web game make AI agent behavior visible and playable?
2. Can MiniMax-M3 act as a town planner, event director, broadcast narrator, and memory anchor?
3. Can a small town simulation become a practical prototype for a new kind of AI game experience?

The V1 prototype validates an important direction: large language models can be more than NPC dialogue generators. They can act as planners, narrators, observers, and memory keepers inside living game systems.

## 项目意义

这个项目不是单纯的小镇模拟页面，而是一个 AI 游戏方向实验。它试图验证：大模型是否可以成为游戏世界中的规划者、叙事者和观察者，而不仅仅是 NPC 台词生成器。

## V1 技术验证完成状态

V1 技术验证版已冻结。本版本不是一个功能完整的商业游戏，而是一个经过完整闭环验证的 AI 小镇生活原型。

### V1 已验证的能力

V1 验证了以下技术能力可在轻量 Web 原型中跑通：

**小镇 UI 主界面** — 插画式小镇舞台、居民状态、任务安排、地图演出
**居民任务与移动动画** — 5 位居民 × 5 个地点 × 6 种任务，CSS 关键帧移动动画
**任务完成反馈** — 头顶徽章（🌸 🍲 🔧 💬 🌿 💤）+ 右侧面板状态
**M3 小镇规划** — AI Director 根据小镇状态选择生活场景，安排居民任务
**M3 小镇事件** — MiniMax-M3 作为叙事导演生成事件，包含标题、文案、选项
**M3 小镇广播** — MiniMax-M3 生成广播标题与文案，附音乐氛围提示词
**玩家事件选择** — 二选一，结果即时反馈 + 记忆链路闭环
**选择后的小镇反馈** — choiceAftermath 右侧面板 + 地图浮动徽章
**居民记忆** — 每位居民最近 8 条记忆，自然语言摘要注入 M3 prompt
**小镇记忆** — 玩家选择记忆链路，优先级注入广播/事件 prompt
**居民对话队列** — M3 生成短对白 + 本地 fallback，按序演出
**点击居民后的观察反馈** — 心情表情、关系状态、近期记忆
**地点拟人化** — 地点事件气泡演出（bloom / steam / spark / chat / leaf / rest）
**对话顺序修复** — 居民对话按 phaseIndex 递增排序，语音播放顺序稳定
**舞台演出闭环** — 移动动画 → 任务气泡 → 地点特效 → 完成徽章，全链路锁步

### V1 已验证的 AI 小镇闭环

本版本验证了一个完整可玩的 AI 游戏闭环：

```
居民有状态（体力、心情、记忆）
  → AI 规划居民行动
    → 舞台动画呈现行动
      → AI 生成事件
        → 玩家做选择
          → 选择影响居民和小镇
            → 小镇记住选择
              → 后续广播/事件/对话引用状态和记忆
```

**MiniMax-M3 在 V1 中的角色已验证：**

- **规划者** — AI Director 根据小镇状态 + 记忆选择生活场景，安排居民任务
- **叙事导演** — M3 生成小镇事件，包含标题、文案、地点、涉及居民、选项
- **广播员** — M3 生成小镇广播文案与音乐氛围提示词
- **记忆引用者** — buildPromptMemoryNarrative 将选择记忆和居民记忆注入 prompt

V1 证明了：在轻量 DOM/Web 原型中，M3 可以驱动一个完整的"规划→演出→事件→选择→记忆"游戏循环，而不仅仅是生成 NPC 对话。

### 当前版本边界（V1 限制）

以下不是 bug，是 V1 有意设定的边界：

- **还不是完整商业游戏** — 原型验证技术可行性，不在 V1 解决游戏目标问题
- **玩法目标较弱** — 玩家每天回来做什么，由 V2 游戏设计回答
- **长期成长线较弱** — 居民关系线还没有系统化，V2 需要设计关系演进机制
- **事件后果还偏轻** — 选择只写记忆，不直接修改数值；V2 需要设计有意义的后果
- **玩家长期动机还需要设计** — 这是一个游戏设计问题，不是技术问题
- **对话仍是模板/轻生成混合** — 本地 fallback 基于任务类型 × 场景矩阵，不是完整自由对话
- **地图和人物表现仍是轻量 SVG/DOM 原型** — 不是美术级资产，V2 需要明确风格方向
- **TTS 和音乐不是当前主线** — MiniMax TTS 已验证可用，但 V1 不做多角色连续语音剧

### 为什么 V1 可以收口

V1 的核心目标是验证"M3 是否能作为小镇世界中的规划者、叙事导演、广播员和记忆引用者"。

这个目标已经达成。技术可行性的证明已经完成，继续堆功能（更多地图、更多居民、TTS 连续剧、背景音乐生成）不会自动让一个没有核心玩法循环的原型变成游戏。

### V2 方向：从技术原型进入游戏设计

V1 之后不应继续盲目堆技术功能（TTS 连续剧、背景音乐、自由对话、更多地图、更多居民）。下一个核心问题是：**玩家每天为什么回来？**

**V2 应优先回答的设计问题：**

```
玩家每天为什么回来？
一天的核心目标是什么？
居民关系如何推进？
玩家选择如何产生长期后果？
AI 事件导演如何避免随机散乱？
小镇记忆如何影响未来事件？
居民状态如何影响行为和剧情？
什么时候是陪伴，什么时候是挑战，什么时候是成长？
```

V2 的核心交付物不是更多技术能力，而是一套游戏设计文档：玩家目标、核心循环、关系系统、事件导演规则、长期记忆后果机制。

V2 优先做游戏设计，不继续堆技术功能。

---

## V1 技术探索完成与项目冻结说明

**AI 小镇生活 V1 技术探索原型已冻结。**

当前项目是 AI 小镇生活 V1 技术探索原型，已完成核心技术验证。**不建议继续在当前代码库上直接堆功能进入 V2 开发。** 后续如果继续，应先进行完整游戏设计，再决定是重构、复用模块还是新建项目。

V1 代码适合作为参考样机和经验沉淀，详见：

**[AI 小镇生活 V1 复盘与后续游戏设计规划](docs/V1_RETROSPECTIVE_AND_GAME_DESIGN_PLAN.md)**

---

## V1 主循环

V1 实现了完整的可玩闭环：

```
玩家点击「推进小镇一天」
  → AI Director 根据小镇状态选择今日生活场景
  → 居民任务推进（早上/下午/晚上）
  → 地图舞台演出（居民移动 + 任务动画 + 气泡反馈）
  → 居民生成短对白（M3 或本地 fallback）
  → 小镇广播生成（M3）
  → 小镇事件生成（M3）
  → 玩家选择事件选项
  → 选择后果即时演出 + choiceAftermath 反馈
  → 写入 townMemory / residentMemory（选择记忆链路）
  → 第二天开场生成「昨日回响」
  → 后续广播 / 事件 / 居民对白引用昨日回响
```

关键约束：玩家选择**不直接修改** mood / energy / supplies 等数值，只记录记忆，用于后续 AI 内容生成的叙事引用。

## 当前已完成能力（V1）

### AI Director

- 根据居民任务分布、心情、小镇记忆自动选择 8 种生活场景（邻里互助、花园日、集市采购、设施修理、安静阅读、节日准备、天气变化、居民心情）
- 为 M3 广播和事件提供叙事上下文（townMemory、residentMemory、recentChoices、openingReflection）

### 居民任务与舞台演出

- 5 位居民 × 5 个地点 × 6 种任务类型
- 纯 DOM/CSS 任务动画层（travel + work/chat/rest + 气泡 + 地点特效）
- CSS 关键帧居民移动动画（采集 = run，休息 = slow，低体力慢行）
- 任务完成徽章（🌸 🍲 🔧 💬 🌿 💤）
- `prefers-reduced-motion` 动画降级

### 居民对白

- M3 生成每位居民 12-28 字短对白 + 动作提示
- 本地 fallback（基于任务类型 × 场景矩阵，无 M3 调用）
- MiMo TTS 语音播放（每个居民独立按钮）

### 小镇广播

- M3 生成小镇广播（标题、文案、氛围、音乐提示词）
- memoryNarrative 注入广播 prompt，引用近期记忆
- MiniMax speech-2.8-hd TTS 合成 + 全局语音播放条

### 小镇事件与玩家选择

- M3 生成小镇事件（标题、文案、基调、地点、涉及居民、选项）
- 玩家二选一，结果写入 choiceAftermath 即时反馈
- 选择写入 townMemory + residentMemory，选择记忆链路闭环

### 记忆系统

- townMemory：玩家选择记忆（player-choice 类型）
- residentMemory：每位居民最近 8 条记忆
- buildPromptMemoryNarrative：为 M3 prompt 生成自然语言记忆摘要
- choiceAftermath 即时 UI 反馈（右侧面板 + 地图舞台浮动徽章）

### 第二天开场回响

- `buildDayOpeningReflection()`：优先级 choiceAftermath > townMemory player-choice > residentMemory > fallback
- 左侧一日闭环区域显示「🌿 昨日回响」
- 地图舞台右上角显示「🌿 小镇记得昨天的选择」
- M3 广播/事件/居民对白 prompt 注入 openingReflection，自然引用不机械复述

### 全局语音播放条

- MiniMax 广播 TTS 与 MiMo 场景 TTS 共用统一状态
- 播放/暂停/停止控制，自动拦截二次播放
- day-opening 场景复用 MiMo 播放按钮

### 验证脚本

所有验证脚本均可在无 MiniMax API Key 的情况下运行（使用模拟数据）：

| 脚本 | 验证内容 |
|------|---------|
| `check` | 3 阶段推进 → day 2 + 日报 |
| `agent-check` | ResidentAgent model: needs 0-100, decisionReason |
| `smoke` | HTTP server 200 |
| `render-check` | DOM 完整性 |
| `config-check` | API Style 配置 |
| `day-cycle-check` | 一日闭环状态机 |
| `ai-director-check` | AI Director context + 场景规则 |
| `resident-dialogue-check` | 对白生成 + fallback |
| `broadcast-tts-check` | MiniMax TTS 按钮状态机 |
| `mimo-tts-check` | MiMo TTS 配置 + 端点 |
| `choice-aftermath-check` | choiceAftermath 状态 + UI |
| `day-reflection-check` | 昨日回响完整链路 |
| `memory-continuity-check` | memoryNarrative → broadcast/event |
| `tts-check` | MiniMax TTS 配置 |
| `voice-playback-check` | 全局语音播放条 |
| `completion-feedback-check` | 任务完成反馈 |
| `stage-acting-check` | 舞台演出 CSS 类 |
| `event-director-check` | 事件导演 M3 解析 |
| `event-choice-check` | 事件选项 normalized |
| `memory-reference-check` | 记忆引用 prompt |
| `resident-feedback-check` | 心情表情渲染 |
| `stage-check` | 地图舞台 DOM 完整性 |
| `animation-check` | 任务动画 DOM |
| `travel-animation-check` | 居民移动动画 |
| `animation-sync-check` | 动画锁步 |
| `mimo-tts-integration-check` | MiMo TTS dry-run |

## Run Locally

```powershell
cd ai-town-life
node scripts/server.mjs
```

Open:

```text
http://127.0.0.1:4173
```

Any static file server can also host this directory.

## Enable MiniMax Agent Mode

The UI works without MiniMax, but the `🤖 AI 管家安排` button needs a server-side API key.

Recommended local setup:

```powershell
cd ai-town-life
Copy-Item config.example.json config.local.json
```

Edit `config.local.json`:

```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 4173
  },
  "minimax": {
    "apiStyle": "anthropic",
    "apiKey": "YOUR_API_KEY_HERE",  // placeholder — replace with your actual key
    "model": "MiniMax-M3",
    "anthropicBaseUrl": "https://api.minimaxi.com/anthropic",
    "timeoutMs": 30000
  }
}
```

Then run:

```powershell
node scripts/server.mjs
```

`config.local.json` is ignored by git so your key does not get committed.

Environment variables still work and take priority over `config.local.json`.

PowerShell example:

```powershell
cd ai-town-life
$env:ANTHROPIC_API_KEY="YOUR_API_KEY_HERE"
$env:MINIMAX_MODEL="MiniMax-M3"
$env:MINIMAX_API_STYLE="anthropic"
node scripts/server.mjs
```

Then open:

```text
http://127.0.0.1:4173
```

Click `🤖 AI 管家安排`. The server sends the current town state to MiniMax and applies the returned resident task plan.

### M3 Town Event Director

The `🎭 生成小镇事件` button asks MiniMax-M3 to observe the current town state and generate a small, cozy event for the town event feed. Events are written into the story timeline without modifying game stats — making the feature safe and observable.

Click `🎭 生成小镇事件` in the left panel. The event appears in 小镇动态 with its title, text, tone, involved residents, place, and a suggested follow-up.

## M3 小镇事件导演

除了安排居民任务，AI 小镇生活还可以让 MiniMax-M3 根据当前状态生成一个小镇事件。第一版只把事件写入小镇动态，不直接修改资源或居民数值，用来验证 M3 是否适合作为轻量叙事导演。

## Town Atmosphere and Broadcast

AI Town Life includes a lightweight atmosphere layer. MiniMax-M3 can generate a short town broadcast based on the current day, phase, residents, town resources, recent events, and reports.

The first version only generates text and a suggested music mood. It does not generate real audio or background music yet. This keeps the feature fast, safe, and easy to inspect before adding TTS or music generation.

Click `📻 生成小镇广播` in the left panel. The broadcast appears in 小镇动态 with its title, script, mood, music mood, place, residents, and a music prompt suggestion.

## Event Choices

M3-generated town events can include two gentle player choices. The first version records the selected choice into the event feed without changing game stats. This keeps the system safe and observable while validating a core game loop: AI creates a situation, the player responds, and the town remembers the response.

## Choice Memory Link

Player choices are recorded beyond the event feed. When a player responds to an M3-generated event, the project records the choice as town memory and, when relevant, as resident memory.

The first version does not change resources, mood, energy, or relationships. It only makes the town remember what happened, so future planning, broadcasts, and events can reference the player's past decisions.

## Illustrated Town Stage

The central map has been upgraded into an illustrated town stage. The stage uses a layered SVG background with a painted grass field, winding paths, buildings, a fountain, trees, and decorative elements. Place labels float on the scene as game-style wooden plaques, and residents appear as illustrated character tokens with task bubbles overhead.

## Task Animation Layer

The illustrated town stage now supports a lightweight task animation layer. When the player advances the phase, residents show temporary action states (`work`, `chat`, `rest`), task feedback bubbles above their heads, and the active place plays a gentle effect (bloom, steam, spark, chat, leaf, or rest). Animations last ~3 seconds and are driven purely by DOM/CSS — no canvas or game engine required.

This prepares the project for future walking animation, sprite sheets, and richer scene choreography.

## Resident Travel Animation

The task animation layer now supports lightweight resident travel. When the player advances the phase, residents can visually move from their previous place to their new task place using CSS-based position animation.

Before moving, the system records each resident's `locationId` before the phase advances. After `advancePhase()` runs, the new `locationId` becomes the `toPlaceId`. The difference produces a `traveling: true` flag and CSS custom properties (`--from-x`, `--from-y`, `--to-x`, `--to-y`) that drive a `characterTravel` keyframe animation.

Gait is inferred from the task: `forage` = run, `rest` = slow, everything else = walk. Low-energy residents (<30) also move slowly. Direction is computed from horizontal coordinates: if `toX > fromX` the character faces right, otherwise left.

This is still not a full pathfinding or sprite-sheet system. It is a DOM/CSS travel layer that prepares the town stage for future walking sprites, directional movement, and richer scene choreography.

## Animation Timing Sync

The town stage now synchronizes phase progression with resident animation. While residents are traveling or performing a task, phase advancement is locked to prevent visual state from being interrupted.

Auto play waits for the current travel and task animation cycle to finish before scheduling the next phase. This keeps the simulation state and the visible town stage aligned.

The lock is controlled by `uiState.isAnimating`. When an animation starts, `isAnimating` is set to `true` and a banner reads "居民正在行动中……". All major buttons (advance, run-day, AI plan, event, broadcast) are disabled until the animation completes. Auto play uses recursive `setTimeout` instead of `setInterval`, scheduling the next phase only after `TASK_ANIMATION_DURATION_MS` (3250ms) plus a buffer.

## Task Completion Feedback

After residents finish their travel and task animations, the town stage shows short completion feedback. Each resident gets a small completion badge (🌸 🍲 🔧 💬 🌿 💤) above their head, the action panel displays "✅ 本阶段行动完成", and the latest event in the feed receives a brief highlight.

This feedback is visual only. It does not change simulation resources, mood, energy, relationships, or MiniMax API behavior.

## 小镇氛围与广播

AI 小镇生活新增了轻量氛围层。MiniMax-M3 可以根据当前天数、阶段、居民状态、小镇资源、最近事件和日报生成一段小镇广播文案，并附上建议音乐氛围提示词。

点击左侧 `📻 生成小镇广播`，广播出现在小镇动态中，包含标题、文案、氛围、地点和音乐提示词。

### 当前 TTS 能力边界

**MiniMax TTS（speech-2.8-hd）**
- 用于小镇广播语音合成
- 点击 `🔊 生成语音广播` → MiniMax TTS → 全局语音播放条播放
- 只合成广播，不合成其他内容

**MiMo TTS（mimo-v2.5-tts / Token Plan）**
- 用于居民对白、事件提示、任务完成反馈、今日场景开场白
- 每个场景独立按钮播放，不自动连续播报
- Token Plan 端点验证通过（dry-run）

**当前明确不做**
- 多角色连续播报（多角色剧本式 TTS）
- 声音克隆 / Voice Design
- WebSocket 流式 TTS
- 背景音乐生成（music_generation）
- 实时语音交互

## 事件选择

M3 生成的小镇事件可以带两个温和选择。当前版本只把玩家选择写入小镇动态，不直接修改资源、心情或关系。这样可以先验证一个核心体验：AI 创造情境，玩家做出回应，小镇记住这个回应。

## 选择记忆联动

玩家对 M3 小镇事件做出的选择，不只会出现在小镇动态中，也会写入小镇记忆，并在相关居民的记忆中留下记录。

当前版本不直接改变资源、心情、体力或关系，只先验证一个关键体验：小镇会记住玩家的决定，后续 AI 管家、事件和广播可以基于这些记忆继续生成内容。

## 插画式小镇舞台

中央地图已经从卡片式地图升级为插画式小镇舞台。舞台使用分层 SVG 背景，包含草地、弯曲道路、建筑、喷泉、树木和装饰元素。地点以游戏风格木牌悬浮在场景中，居民以角色令牌形式出现，头顶显示任务气泡。

## 任务动画层

插画式小镇舞台新增了轻量任务动画层。玩家推进阶段时，居民会显示临时行动状态（work / chat / rest）、头顶任务反馈气泡，所在地点播放轻量特效（bloom / steam / spark / chat / leaf / rest）。动画持续约 3 秒，纯 DOM/CSS 实现，无需游戏引擎。

当前版本为后续行走动画、角色帧动画和更复杂的场景调度做准备。

## 居民移动动画

任务动画层新增了轻量居民移动能力。玩家推进阶段时，居民可以从上一阶段所在地点移动到当前任务地点，然后再显示任务气泡和地点特效。

实现方式是：在 `advancePhase()` 推进前记录居民 `locationId`，推进后对比新旧地点得到 `fromPlaceId` → `toPlaceId`，产生 `traveling: true` 标志和 CSS 变量（`--from-x`、`--from-y`、`--to-x`、`--to-y`），驱动 `characterTravel` 关键帧动画。

步态根据任务推断：采集 = run，休息 = slow，其余 = walk。体力低于 30 的居民也会慢走。方向根据水平坐标计算：目标在右侧则面朝右，否则面朝左。

当前版本仍不是完整寻路或帧动画系统，而是基于 DOM/CSS 的位置移动层，为后续行走帧动画、方向动作和更复杂的场景调度做准备。

## 动画节奏锁步

小镇舞台新增了动画节奏锁步。居民移动或执行任务时，阶段推进会暂时锁定，避免动画还没播放完就进入下一阶段。

自动推进会等待当前移动与任务动画完成后，再安排下一次推进，使 simulation 状态和视觉舞台保持一致。

锁由 `uiState.isAnimating` 控制。动画开始时 `isAnimating` 设为 `true`，并显示"居民正在行动中……"横幅。在此期间，推进阶段、结束今天、AI 管家、事件导演、氛围广播按钮均被禁用。自动推进从 `setInterval` 改为递归 `setTimeout`，只在 `TASK_ANIMATION_DURATION_MS`（3250ms）加上缓冲后才安排下一次推进。

## 任务完成反馈

居民完成移动和任务动画后，小镇舞台会显示短暂的完成反馈。居民头顶出现小徽章（🌸 🍲 🔧 💬 🌿 💤），操作区显示"✅ 本阶段行动完成"，小镇动态的最新事件会轻微高亮。

当前反馈只属于视觉表现，不改变资源、心情、体力、关系或 MiniMax API 行为。

### API Style Configuration

Two API styles are supported:

| Style | Endpoint | Use Case |
|-------|----------|----------|
| `anthropic` (default) | `${anthropicBaseUrl}/v1/messages` | MiniMax-M3 with Anthropic Messages API |
| `openai` | `${baseUrl}/chat/completions` | MiniMax-M2.1 OpenAI-compatible API |

Set via `MINIMAX_API_STYLE` environment variable or `minimax.apiStyle` in config.

### Environment Variables

```text
ANTHROPIC_API_KEY        MiniMax API key (takes priority)
MINIMAX_API_KEY          MiniMax API key (fallback)
MINIMAX_API_STYLE        "anthropic" or "openai" (default: anthropic)
MINIMAX_MODEL            Model name (default: MiniMax-M3)
ANTHROPIC_BASE_URL       Anthropic endpoint (default: https://api.minimaxi.com/anthropic)
MINIMAX_BASE_URL         OpenAI endpoint (default: https://api.minimax.io/v1)
```

Do not put real API keys in frontend files, config.example.json, or README. Keep them only in `config.local.json` or environment variables.

## Open On Phone

Use this when your phone and computer are on the same Wi-Fi network:

```powershell
cd ai-town-life
npm run mobile
```

The terminal prints one or more LAN URLs, for example:

```text
Mobile/LAN URLs:
  http://192.168.1.23:4173
```

Open that URL on your phone browser.

To print the phone URLs again without starting another server:

```powershell
npm run mobile-info
```

If the phone cannot open it:

- Make sure the phone and computer are on the same Wi-Fi.
- Use the LAN URL printed by the terminal, not `127.0.0.1`.
- Allow Node.js through Windows Firewall for private networks.
- Some public or office Wi-Fi networks block device-to-device access; use a personal hotspot or deploy to Netlify/Vercel instead.

## Open From A Different Network

LAN URLs such as `192.168.x.x` only work when the phone and computer are on the same local network.

If the phone is not on the same network, use one of these:

1. Deploy as a static site.
   This is the best option for this project because it has no backend dependency. Netlify, Vercel, or GitHub Pages can host it directly.

2. Use a temporary public tunnel.
   Start the local server, then expose it with a tunnel tool:

```powershell
node scripts/server.mjs
```

In another terminal:

```powershell
cloudflared tunnel --url http://127.0.0.1:4173
```

or:

```powershell
ngrok http 4173
```

or:

```powershell
npx localtunnel --port 4173
```

Print a quick reminder:

```powershell
npm run remote-info
```

For sharing with others or testing repeatedly on phone, deploy to Netlify/Vercel/GitHub Pages instead of relying on a tunnel.

## Check

```powershell
node scripts/check.mjs
```

The check initializes a town, advances morning, afternoon, and evening, then verifies that the app reaches day 2 and creates one daily report.

## Features

- 5 residents and 5 town places
- Morning, afternoon, and evening phases
- Animated 2D town stage with moving resident tokens
- In-stage task badges, resident status colors, and compact HUD legend
- Resident spotlight panel driven by stage/card selection
- One-click `Run Day` progression
- `Auto Play` mode for watching the town evolve without manual clicks
- Town goal tracker with progress bars
- Optional MiniMax planning button for LLM-driven resident assignments
- Per-resident task assignment
- Rule-driven resident behavior based on task, energy, preference, and town state
- Mood, energy, comfort, supplies, and spirit updates
- Relationship changes when residents meet in the same place
- Event feed, recent memories, relationship ranking, town tips, and daily report
- localStorage persistence with recovery if saved state is incompatible
- No runtime dependencies, suitable for static deployment

## Architecture

```text
src/
  app.js                 # App entry, state commits, render fallback
  assets/
    town-scene.svg       # Visual asset, favicon, manifest icon
  data/
    seed.js              # Initial residents, places, tasks
  domain/
    simulation.js        # Phase advancement and state updates
    selectors.js         # Derived UI data and town tips
    state.js             # Initial state
  services/
    narrator.js          # Event copy and daily reports
    persistence.js       # localStorage read/write/validation
  ui/
    render.js            # DOM rendering and UI event binding
```

Module boundaries:

- `domain/` does not depend on the DOM and can move to a server or test runner.
- `services/narrator.js` is the future LLM integration point.
- `ui/render.js` displays state and emits user events, but does not mutate domain state directly.

## Deploy

### Netlify

`netlify.toml` is included. Use:

```text
Base directory: ai-town-life
Build command: empty
Publish directory: .
```

### GitHub Pages

Publish the contents of `ai-town-life` as a static site. `.nojekyll` is included so asset paths stay untouched.

### Vercel

Import as a static site:

```text
Framework Preset: Other
Output Directory: .
```

## 暂缓能力（V1 明确不做）

以下能力在本版本中暂不实现，留给后续阶段：

- **移动端布局优化** — 当前桌面优先，暂不优化手机布局
- **背景音乐生成** — music_generation 接口暂不接入
- **Sprite Sheet 帧动画** — 当前为 DOM/CSS 动画，后续可升级
- **居民自由聊天输入框** — 当前为预设对白，暂无 NL 输入
- **完整关系系统** — 当前为数值好感度，暂无对话式关系发展
- **Phaser / Pixi / Canvas 重构** — 当前纯 DOM/CSS，无需游戏引擎
- **多角色连续语音剧** — TTS 当前按场景独立播放，不做连续剧本式播报
- **居民固定音色绑定** — MiMo 当前为默认音色，暂无角色音色设计

## Product Roadmap

1. Resident detail modal and town calendar.
2. Building upgrades, town events, and achievements.
3. Replace `narrator.js` with an LLM narration service.
4. User-created residents and places.
5. Exportable daily reports and shareable town state.
