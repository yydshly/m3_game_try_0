# AI Town Life

A lightweight, friendly multi-agent town life simulation prototype.

The first release focuses on a complete playable loop without external dependencies: residents, places, tasks, mood, energy, relationships, memories, event feed, town tips, and daily reports. Later, `services/narrator.js` can be replaced with a real LLM or multi-agent backend without rewriting the UI.

## Why This Project Exists

AI Town Life is not only a cozy town simulation prototype. It is also an experiment in using MiniMax-M3 as a planning brain for AI-driven game worlds.

The project explores three questions:

1. Can a lightweight web game make AI agent behavior visible and playable?
2. Can MiniMax-M3 plan resident actions based on state, memory, needs, and town goals?
3. Can a small town simulation become a practical prototype for a new kind of AI game experience?

The current version is still a prototype, but it already validates an important direction: large language models can be more than NPC dialogue generators. They can act as planners, narrators, and observers inside living game systems.

## 项目意义

这个项目不是单纯的小镇模拟页面，而是一个 AI 游戏方向实验。它试图验证：大模型是否可以成为游戏世界中的规划者、叙事者和观察者，而不仅仅是 NPC 台词生成器。

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
    "apiKey": "your_real_key_here",
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
$env:ANTHROPIC_API_KEY="your_real_key_here"
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

## 小镇氛围与广播

AI 小镇生活新增了轻量氛围层。MiniMax-M3 可以根据当前天数、阶段、居民状态、小镇资源、最近事件和日报生成一段小镇广播文案。

当前版本只生成广播文字和建议音乐氛围，不生成真实音频，这样先验证广播内容是否有游戏魅力，再逐步接入 TTS 和背景音乐生成。

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

## Product Roadmap

1. Resident detail modal and town calendar.
2. Building upgrades, town events, and achievements.
3. Replace `narrator.js` with an LLM narration service.
4. User-created residents and places.
5. Exportable daily reports and shareable town state.
