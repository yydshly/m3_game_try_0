// v1-acceptance-check — validates V1 playable prototype documentation and safety
// This script verifies README, V1 acceptance doc, and safety boundaries.
// No code changes — purely documentation and safety checks.

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// ── README exists ───────────────────────────────────────────────────────────────
console.log("\n── README exists ──");
{
  const fs = await import("fs");
  assert(fs.existsSync("./README.md"), "README.md exists");
}

// ── README: AI town project positioning ───────────────────────────────────────
console.log("\n── README: project positioning ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./README.md", "utf8");
  assert(content.includes("AI 驱动的") || content.includes("AI-driven"), "README describes AI town project");
  assert(content.includes("AI 可以作为小镇的规划者") || content.includes("MiniMax-M3 as a planning"), "README mentions AI as planner/narrator");
}

// ── README: V1 main loop ─────────────────────────────────────────────────────
console.log("\n── README: V1 main loop ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./README.md", "utf8");
  assert(content.includes("V1 主循环") || content.includes("V1 main loop") || content.includes("玩家点击"), "README describes V1 main loop");
  assert(content.includes("AI Director") && content.includes("生活场景"), "README mentions AI Director life scenarios");
  assert(content.includes("推进小镇一天") || content.includes("推进"), "README mentions advancing town day");
}

// ── README: AI Director ───────────────────────────────────────────────────────
console.log("\n── README: AI Director ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./README.md", "utf8");
  assert(content.includes("AI Director") || content.includes("生活场景"), "README mentions AI Director or life scenarios");
}

// ── README: one-day loop ─────────────────────────────────────────────────────
console.log("\n── README: one-day loop ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./README.md", "utf8");
  assert(content.includes("一日闭环") || content.includes("day cycle") || content.includes("推进"), "README mentions one-day loop");
}

// ── README: resident dialogue ─────────────────────────────────────────────────
console.log("\n── README: resident dialogue ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./README.md", "utf8");
  assert(content.includes("居民对白") || content.includes("dialogue"), "README mentions resident dialogue");
}

// ── README: town broadcast ────────────────────────────────────────────────────
console.log("\n── README: town broadcast ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./README.md", "utf8");
  assert(content.includes("小镇广播") || content.includes("broadcast"), "README mentions town broadcast");
}

// ── README: player choice ────────────────────────────────────────────────────
console.log("\n── README: player choice ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./README.md", "utf8");
  assert(content.includes("玩家选择") || content.includes("player choice"), "README mentions player choice");
}

// ── README: townMemory / residentMemory ──────────────────────────────────────
console.log("\n── README: memory system ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./README.md", "utf8");
  assert(content.includes("townMemory") || content.includes("residentMemory") || content.includes("记忆"), "README mentions memory system");
}

// ── README: next-day reflection ──────────────────────────────────────────────
console.log("\n── README: next-day reflection ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./README.md", "utf8");
  assert(content.includes("昨日回响") || content.includes("opening reflection") || content.includes("第二天开场"), "README mentions next-day reflection");
}

// ── README: MiniMax TTS ──────────────────────────────────────────────────────
console.log("\n── README: MiniMax TTS ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./README.md", "utf8");
  assert(content.includes("MiniMax") && (content.includes("TTS") || content.includes("语音")), "README mentions MiniMax TTS");
}

// ── README: MiMo TTS ─────────────────────────────────────────────────────────
console.log("\n── README: MiMo TTS ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./README.md", "utf8");
  assert(content.includes("MiMo") && (content.includes("TTS") || content.includes("语音")), "README mentions MiMo TTS");
}

// ── README: deferred capabilities ────────────────────────────────────────────
console.log("\n── README: deferred capabilities ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./README.md", "utf8");
  assert(
    (content.includes("暂缓") || content.includes("V1 明确不做") || content.includes("deferred")) &&
    (content.includes("移动端") || content.includes("背景音乐") || content.includes("Sprite")),
    "README mentions deferred capabilities"
  );
}

// ── V1 acceptance doc exists ─────────────────────────────────────────────────
console.log("\n── V1 acceptance doc exists ──");
{
  const fs = await import("fs");
  assert(fs.existsSync("./docs/V1_PLAYABLE_PROTOTYPE_ACCEPTANCE.md"), "docs/V1_PLAYABLE_PROTOTYPE_ACCEPTANCE.md exists");
}

// ── V1 acceptance doc: V1 prototype goal ─────────────────────────────────────
console.log("\n── V1 acceptance doc: V1 prototype goal ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./docs/V1_PLAYABLE_PROTOTYPE_ACCEPTANCE.md", "utf8");
  assert(content.includes("V1 原型目标") || content.includes("V1 prototype"), "V1 doc describes V1 prototype goal");
}

// ── V1 acceptance doc: player main flow ──────────────────────────────────────
console.log("\n── V1 acceptance doc: player main flow ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./docs/V1_PLAYABLE_PROTOTYPE_ACCEPTANCE.md", "utf8");
  assert(content.includes("玩家主流程") || content.includes("玩家打开页面") || content.includes("main flow"), "V1 doc describes player main flow");
}

// ── V1 acceptance doc: AI capability list ─────────────────────────────────────
console.log("\n── V1 acceptance doc: AI capability list ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./docs/V1_PLAYABLE_PROTOTYPE_ACCEPTANCE.md", "utf8");
  assert(content.includes("AI 能力清单") || content.includes("能力清单"), "V1 doc lists AI capabilities");
}

// ── V1 acceptance doc: TTS acceptance ─────────────────────────────────────────
console.log("\n── V1 acceptance doc: TTS acceptance ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./docs/V1_PLAYABLE_PROTOTYPE_ACCEPTANCE.md", "utf8");
  assert(content.includes("TTS 验收") || content.includes("TTS"), "V1 doc covers TTS acceptance");
}

// ── V1 acceptance doc: memory continuity ─────────────────────────────────────
console.log("\n── V1 acceptance doc: memory continuity ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./docs/V1_PLAYABLE_PROTOTYPE_ACCEPTANCE.md", "utf8");
  assert(content.includes("记忆连续性") || content.includes("memory continuity"), "V1 doc covers memory continuity");
}

// ── V1 acceptance doc: safety boundaries ──────────────────────────────────────
console.log("\n── V1 acceptance doc: safety boundaries ──");
{
  const fs = await import("fs");
  const content = fs.readFileSync("./docs/V1_PLAYABLE_PROTOTYPE_ACCEPTANCE.md", "utf8");
  assert(content.includes("安全边界") || content.includes("安全"), "V1 doc covers safety boundaries");
}

// ── package.json: v1-acceptance-check exists ──────────────────────────────────
console.log("\n── package.json: v1-acceptance-check ──");
{
  const fs = await import("fs");
  const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
  assert(pkg.scripts && typeof pkg.scripts["v1-acceptance-check"] === "string", "v1-acceptance-check script exists in package.json");
}

// ── No real API keys committed ────────────────────────────────────────────────
console.log("\n── No real API keys committed ──");
{
  const fs = await import("fs");
  const readme = fs.readFileSync("./README.md", "utf8");
  assert(!readme.match(/sk-[a-zA-Z0-9]{20,}/), "README has no sk- API key");
  assert(!readme.match(/tp-[a-zA-Z0-9._-]{10,}/), "README has no tp- API key");
  assert(!readme.includes("your_real_key_here") || readme.includes("placeholder"), "README API key is placeholder");

  // Check app.js
  const app = fs.readFileSync("./src/app.js", "utf8");
  assert(!app.match(/sk-[a-zA-Z0-9]{20,}/), "app.js has no sk- API key");
  assert(!app.match(/tp-[a-zA-Z0-9._-]{10,}/), "app.js has no tp- API key");
}

// ── No base64 audio committed ─────────────────────────────────────────────────
console.log("\n── No base64 audio committed ──");
{
  const fs = await import("fs");
  const app = fs.readFileSync("./src/app.js", "utf8");
  assert(!app.includes("data:audio/"), "app.js has no data:audio/ base64");
  assert(!app.match(/,[A-Za-z0-9+/=]{80,}/), "app.js has no long base64 strings");
}

// ── No .env / config.local.json tracked ───────────────────────────────────────
console.log("\n── No sensitive config files tracked ──");
{
  const fs = await import("fs");
  const gitignore = fs.readFileSync("./.gitignore", "utf8");
  assert(gitignore.includes(".env"), ".env in .gitignore");
  assert(gitignore.includes("config.local.json"), "config.local.json in .gitignore");
}

// ── No forbidden frameworks ──────────────────────────────────────────────────
console.log("\n── No forbidden frameworks ──");
{
  const fs = await import("fs");
  const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const forbidden = ["phaser", "pixi", "pixi.js", "pixi-legacy", "matter-js", "playwright", "puppeteer", "react", "vue", "svelte", "angular", "solid-js", "lit", "howler", "tone.js"];
  const found = forbidden.filter((k) => deps[k]);
  assert(found.length === 0, `no forbidden frameworks (found: ${found.join(", ") || "none"})`);
}

// ── MiniMax speech-t2a-http not modified ─────────────────────────────────────
console.log("\n── MiniMax speech-t2a-http not modified ──");
{
  const fs = await import("fs");
  const ttsContent = fs.readFileSync("./src/services/minimaxTts.js", "utf8");
  assert(ttsContent.includes("speech-2.8-hd"), "MiniMax speech-2.8-hd preserved in minimaxTts.js");
}

// ── MiMo Token Plan endpoint not modified ────────────────────────────────────
console.log("\n── MiMo Token Plan endpoint not modified ──");
{
  const fs = await import("fs");
  const serverContent = fs.readFileSync("./scripts/server.mjs", "utf8");
  assert(serverContent.includes("token-plan-cn") && serverContent.includes("mimo-v2.5-tts"), "MiMo Token Plan endpoint preserved in server.mjs");
}

// ── music_generation not modified ────────────────────────────────────────────
console.log("\n── music_generation not modified ──");
{
  const fs = await import("fs");
  const clientContent = fs.readFileSync("./src/services/minimaxClient.js", "utf8");
  assert(!clientContent.includes("music_generation"), "music_generation not in minimaxClient.js");
}

// ── Game values not modified ────────────────────────────────────────────────
console.log("\n── Game values not modified ──");
{
  const fs = await import("fs");
  const simContent = fs.readFileSync("./src/domain/simulation.js", "utf8");
  assert(simContent.includes("mood") && simContent.includes("energy"), "mood and energy preserved in simulation.js");
  assert(simContent.includes("updateAgentNeeds") || simContent.includes("clamp"), "needs calculation preserved");
}

// ── Core check scripts exist ──────────────────────────────────────────────────
console.log("\n── Core check scripts exist ──");
{
  const fs = await import("fs");
  const scripts = [
    "check.mjs",
    "agent-check.mjs",
    "smoke.mjs",
    "render-check.mjs",
    "config-check.mjs",
    "day-cycle-check.mjs",
    "ai-director-check.mjs",
    "resident-dialogue-check.mjs",
    "broadcast-tts-check.mjs",
    "mimo-tts-check.mjs",
    "choice-aftermath-check.mjs",
    "day-reflection-check.mjs",
    "memory-continuity-check.mjs",
    "tts-check.mjs",
    "voice-playback-check.mjs",
    "completion-feedback-check.mjs",
    "stage-acting-check.mjs",
    "event-director-check.mjs",
    "event-choice-check.mjs",
    "memory-reference-check.mjs",
    "resident-feedback-check.mjs",
    "stage-check.mjs",
    "animation-check.mjs",
    "travel-animation-check.mjs",
    "animation-sync-check.mjs",
    "mimo-tts-integration-check.mjs",
  ];
  for (const script of scripts) {
    assert(fs.existsSync(`./scripts/${script}`), `${script} exists`);
  }
}

// ── No new game features added in V1 doc ────────────────────────────────────
console.log("\n── No new game features in V1 doc ──");
{
  const fs = await import("fs");
  const doc = fs.readFileSync("./docs/V1_PLAYABLE_PROTOTYPE_ACCEPTANCE.md", "utf8");
  // V1 doc should describe existing features, not promise new ones as done
  // It should use "下一阶段建议" or "建议" for future work, not claim they are done
  assert(doc.includes("下一阶段建议") || doc.includes("建议"), "V1 doc has next-phase suggestions section");
}

// ── README does not claim mobile layout is done ───────────────────────────────
console.log("\n── README deferred capabilities accurate ──");
{
  const fs = await import("fs");
  const readme = fs.readFileSync("./README.md", "utf8");
  assert(readme.includes("暂缓能力") || readme.includes("V1 明确不做") || readme.includes("deferred"), "README marks deferred capabilities");
}

// ── Results ───────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("\nAll V1 acceptance checks passed!");
