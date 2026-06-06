# V1 可玩原型验收文档

## 1. V1 原型目标

V1 是一个**可玩的 AI 小镇生活原型**，验证以下核心假设：

- AI 可以作为小镇的**规划者**：MiniMax-M3 根据居民状态、记忆、需求生成任务安排
- AI 可以作为小镇的**叙事导演**：MiniMax-M3 生成小镇广播和事件，创造情境
- AI 可以作为小镇的**记忆锚点**：玩家选择被记住，并影响后续 AI 内容生成
- 所有 AI 能力在**纯前端**中可验证，无需修改核心游戏数值

## 2. 玩家主流程

```
玩家打开页面
  → 观察小镇舞台（5 位居民在 5 个地点）
  → 点击「推进小镇一天」或「推进」或「自动推进」
  → 居民移动 + 任务动画 + 完成徽章
  → 点击「生成小镇广播」→ M3 生成广播文案 → MiniMax TTS 语音
  → 点击「生成小镇事件」→ M3 生成事件 + 选项
  → 玩家选择 → 即时反馈 + 记忆写入
  → 再次推进一天 → 「昨日回响」引用上次选择
  → 后续广播/事件/居民对白自然引用昨日记忆
```

关键约束：**玩家选择不直接修改 mood / energy / supplies**，只记录叙事性记忆。

## 3. AI 能力清单

| 能力 | 实现方式 | 验收方式 |
|------|---------|---------|
| AI Director 场景选择 | `selectTownLifeScenario()` 规则引擎 | 8 种场景可切换 |
| AI 管家任务规划 | MiniMax-M3 `/api/minimax/plan` | 返回 5 位居民任务分配 |
| 居民对白生成 | MiniMax-M3 `/api/minimax/resident-dialogue` | M3 对白或 fallback 对白 |
| 小镇广播生成 | MiniMax-M3 `/api/minimax/broadcast` | 广播文案含 memoryNarrative |
| 小镇事件生成 | MiniMax-M3 `/api/minimax/event` | 事件含标题、文案、选项 |
| 第二天开场回响 | `buildDayOpeningReflection()` | 回响出现在左上面板和地图 |
| 选择记忆写入 | `applyChoiceMemory()` | townMemory + residentMemory |

## 4. 记忆连续性验收

### 验收标准

1. 玩家做出选择后，`townMemory` 中出现 `player-choice` 类型条目
2. 再次推进一天时，左侧一日闭环区域显示「🌿 昨日回响」
3. 地图舞台右上角显示「🌿 小镇记得昨天的选择」
4. AI Director context 中 `openingReflection.summary` 非空
5. 居民对白 prompt 中包含 `openingReflectionText`
6. 广播 prompt 中包含 `openingReflectionText`

### 验证命令

```bash
npm run choice-aftermath-check   # 选择后果状态 + UI
npm run day-reflection-check      # 昨日回响完整链路
npm run memory-continuity-check   # memoryNarrative → broadcast/event
```

## 5. TTS 验收

### 验收标准

| TTS 场景 | Provider | 验收方式 |
|---------|---------|---------|
| 小镇广播 | MiniMax speech-2.8-hd | 点击「生成语音广播」→ 播放成功 |
| 居民对白 | MiMo mimo-v2.5-tts | 对白旁播放按钮 → 播放成功 |
| 事件提示 | MiMo mimo-v2.5-tts | 事件旁播放按钮 → 播放成功 |
| 任务完成反馈 | MiMo mimo-v2.5-tts | 完成反馈旁播放按钮 → 播放成功 |
| 今日场景开场白 | MiMo mimo-v2.5-tts | 今日场景旁播放按钮 → 播放成功 |

### 验证命令

```bash
npm run tts-check                # MiniMax TTS 配置
npm run mimo-tts-check           # MiMo TTS 配置 + 端点
npm run mimo-tts-integration-check  # MiMo dry-run 验证
npm run broadcast-tts-check      # 广播 TTS 按钮状态机
npm run tts-playback-check       # TTS 播放状态
npm run voice-playback-check     # 全局语音播放条
```

### TTS 明确不做

- 多角色连续播报（按场景独立播放）
- 声音克隆 / Voice Design
- WebSocket 流式 TTS
- 背景音乐生成（music_generation）

### V1 Stable Checkpoint：voice-stable（2026-06-06）

本 checkpoint 固化以下语音模块能力，验证通过 38 项 voice-lifecycle-check 断言。

**已稳定能力：**

| 能力 | 状态 |
|------|------|
| MiniMax 小镇广播 TTS（生成/播放/暂停/继续） | ✅ 稳定 |
| MiMo 居民对白 TTS（生成/播放） | ✅ 稳定 |
| MiMo 推荐收听语音（生成/播放） | ✅ 稳定 |
| MiMo ready 状态重播（不重新请求 API） | ✅ 稳定 |
| MiMo 居民切换播放（不串状态） | ✅ 稳定 |
| MiniMax / MiMo 互切（互不干扰） | ✅ 稳定 |
| 全局语音播放条（provider 标签正确） | ✅ 稳定 |
| MiniMax 广播 TTS dry-run 验证 | ✅ 稳定 |
| MiMo dry-run 验证 | ✅ 稳定 |
| 错误状态隔离（不串 dayCycle） | ✅ 稳定 |
| API Key 不泄露（前台脱敏） | ✅ 稳定 |

**当前 TTS 分工：**

- `MiniMax speech-2.8-hd`：小镇广播（`town_broadcast`）
- `MiMo mimo-v2.5-tts`：居民对白、事件提示、选择反应、任务完成反馈、场景开场白

**暂不继续扩展：**

- 语音缓存持久化（localStorage sessionStorage）
- 播放进度条
- 多角色连续播报
- 声音克隆 / 音色绑定
- WebSocket 流式语音

**voice-lifecycle-check 覆盖的 38 项断言：**

```bash
npm run voice-lifecycle-check   # 38 passed
npm run voice-playback-check    # 98 passed
npm run mimo-tts-check         # 141 passed
npm run mimo-ui-voice-contract-check  # 13 passed
npm run voice-ui-e2e-check     # 49 passed
npm run voice-regression-check  # 39 passed
npm run voice-handler-self-call-check  # 14 passed
npm run voice-api-debug-check   # 45 passed
```

**后续开发约束：**

语音模块当前已稳定，后续新增功能不得顺手修改以下文件底层逻辑：

- `src/services/mimoClient.js`（MiMo 请求构造）
- `src/services/minimaxTts.js`（MiniMax TTS）
- `src/app.js` 中的 `playMimoAudio / resumeMimoAudio / pauseMimoAudio / stopAllMimoAudio`
- `src/app.js` 中的 `playBroadcastAudio / pauseBroadcastAudio / stopBroadcastAudio`
- `src/ui/render.js` 中的 TTS 按钮渲染函数

## 6. UI / 舞台演出验收

### 验收标准

- 地图舞台渲染 5 个地点标签 + 5 位居民角色令牌
- 推进阶段时居民出现移动动画（CSS position transition）
- 推进阶段时出现任务气泡（bloom / steam / spark / chat / leaf / rest）
- 任务完成后出现完成徽章（🌸 🍲 🔧 💬 🌿 💤）
- `prefers-reduced-motion` 下动画被禁用
- choiceAftermath 浮动徽章出现在地图舞台
- 全局语音播放条在播放时可见

### 验证命令

```bash
npm run render-check             # DOM 渲染完整性
npm run stage-check             # 地图舞台 DOM
npm run animation-check         # 任务动画 DOM
npm run travel-animation-check  # 居民移动动画
npm run animation-sync-check    # 动画锁步
npm run completion-feedback-check # 任务完成反馈
npm run stage-acting-check      # 舞台演出 CSS 类
```

## 7. 安全边界

### 明确禁止

- 真实 API Key 提交到仓库（`.env`、`config.local.json`、`config.json` 均在 .gitignore）
- base64 音频数据提交
- 测试音频文件提交
- 新增 Phaser / Pixi / Canvas 依赖
- 新增 `music_generation` 接口调用
- 修改 MiniMax speech-t2a-http 模型
- 修改 MiMo Token Plan 端点
- 修改 MiniMax M3 任务规划核心接口
- 修改 mood / energy / needs 计算逻辑

### 验证命令

```bash
npm run v1-acceptance-check  # 综合安全检查
git status                 # 检查无敏感文件
```

## 8. 暂缓能力

以下能力在 V1 中暂不实现：

- 移动端布局优化
- 背景音乐生成
- Sprite Sheet 帧动画
- 居民自由聊天输入框
- 完整关系对话系统
- Phaser / Pixi / Canvas 重构
- 多角色连续语音剧
- 居民固定音色绑定
- 语音缓存持久化（session/localStorage）
- 语音播放进度条
- WebSocket 流式语音

## 9. 下一阶段建议

**建议 A（叙事深化）**：让选择后果直接影响居民心情或能量（小幅、可视化），使记忆系统有更强的游戏感受反馈。

**建议 B（广播角色化）**：让不同居民轮流朗读广播片段，实现多角色连续 TTS 播报的简化版本。

**建议 C（事件链）**：让一个 M3 事件的选择结果作为下一个事件的输入变量，实现事件间的叙事连锁。
