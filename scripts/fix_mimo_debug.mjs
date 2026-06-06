// Script to add requestId and debugCode to MiMo TTS handler
import { readFileSync, writeFileSync } from "fs";

let content = readFileSync("scripts/server.mjs", "utf8");

// 1. Add requestId declaration at start of handleMimoTts
content = content.replace(
  /async function handleMimoTts\(request, response\) \{\n/,
  `async function handleMimoTts(request, response) {\n  const requestId = "mi-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);\n  console.info("[tts:mimo:start] " + requestId);\n`
);

// 2. dryRun success — add debugCode and requestId
content = content.replace(
  /sendJson\(response, 200, \{\n\s+ok: true,\n\s+provider: "mimo",\n\s+mode: cfg\.mode,/,
  `sendJson(response, 200, {\n      ok: true,\n      provider: "mimo",\n      debugCode: "MIMO_TTS_DRY_RUN",\n      requestId,\n      mode: cfg.mode,`
);

// 3. dryRun URL error
content = content.replace(
  /sendJson\(response, 400, \{\n\s+ok: false,\n\s+error: "MiMo Token Plan Base URL 配置错误",\n\s+mode: "token_plan",\n\s+baseUrl: mimoBaseUrl,\n\s+\}\);/,
  `sendJson(response, 400, {\n        ok: false,\n        provider: "mimo",\n        debugCode: "MIMO_TTS_CONFIG_ERROR",\n        requestId,\n        error: "MiMo Token Plan Base URL 配置错误",\n        mode: "token_plan",\n        baseUrl: mimoBaseUrl.slice(0, 12) + "***",\n      });`
);

// 4. mimoEnabled false
content = content.replace(
  /sendJson\(response, 501, \{\n\s+ok: false,\n\s+error: "MiMo TTS 未启用，请在配置中启用。",\n\s+\}\);/,
  `sendJson(response, 501, {\n        ok: false,\n        provider: "mimo",\n        debugCode: "MIMO_TTS_DISABLED",\n        requestId,\n        error: "MiMo TTS 未启用，请在配置中启用。\n      });`
);

// 5. no API key
content = content.replace(
  /sendJson\(response, 501, \{\n\s+ok: false,\n\s+error: "MiMo TTS 暂时不可用（未配置 API Key）。",\n\s+\}\);/,
  `sendJson(response, 501, {\n        ok: false,\n        provider: "mimo",\n        debugCode: "MIMO_TTS_NO_KEY",\n        requestId,\n        error: "MiMo TTS 暂时不可用（未配置 API Key）。\n      });`
);

// 6. bad body
content = content.replace(
  /sendJson\(response, 400, \{ ok: false, error: "无效的请求体。" \}\);/,
  `sendJson(response, 400, { ok: false, provider: "mimo", debugCode: "MIMO_TTS_BAD_REQUEST", requestId, error: "请求体无效。" });`
);

// 7. empty text
content = content.replace(
  /sendJson\(response, 400, \{ ok: false, error: "文本为空。" \}\);/,
  `sendJson(response, 400, { ok: false, provider: "mimo", debugCode: "MIMO_TTS_EMPTY_TEXT", requestId, error: "文本为空。" });`
);

// 8. text too long
content = content.replace(
  /sendJson\(response, 400, \{\n\s+ok: false,\n\s+error: `文本超过 200 字限制\(当前 \$\{text\.length} 字\)。`,\n\s+\}\);/,
  `sendJson(response, 400, {\n        ok: false,\n        provider: "mimo",\n        debugCode: "MIMO_TTS_TEXT_TOO_LONG",\n        requestId,\n        error: "文本超过 200 字限制（当前 " + text.length + " 字）。\n      });`
);

// 9. HTTP error — add debugCode and requestId
content = content.replace(
  /sendJson\(response, ttsResponse\.status, \{\n\s+ok: false,\n\s+error: safeMsg,\n\s+\}\);(\n\s+return;\n\s+\}\n\n\s+const audioBase64 = parseMimoTtsAudio\(payload\);)/,
  `sendJson(response, ttsResponse.status, {\n        ok: false,\n        provider: "mimo",\n        debugCode: "MIMO_TTS_HTTP_ERROR",\n        requestId,\n        error: safeMsg,\n      });\n      return;\n    }\n\n    const audioBase64 = parseMimoTtsAudio(payload);`
);

// 10. no audio
content = content.replace(
  /sendJson\(response, 502, \{\n\s+ok: false,\n\s+error: "MiMo 未返回音频数据。",\n\s+\}\);(\n\s+return;\n\s+\}\n\n\s+\/\/ Simple hash)/,
  `sendJson(response, 502, {\n        ok: false,\n        provider: "mimo",\n        debugCode: "MIMO_TTS_NO_AUDIO",\n        requestId,\n        error: "MiMo 未返回音频数据。\n      });\n      return;\n    }\n\n    // Simple hash`
);

// 11. success — add debugCode, requestId, mask text
content = content.replace(
  /sendJson\(response, 200, \{\n\s+ok: true,\n\s+audioUrl,\n\s+provider: "mimo",\n\s+format: "wav",\n\s+model: mimoModel,\n\s+scene,\n\s+textHash,\n\s+durationMs: 0,\n\s+text,\n\s+\}\);(\n\s+\} catch \(error\) \{\n\s+const isTimeout = error\.name === "AbortError";\n\s+const safeMsg = sanitizeMimoError\(error, null\);\n\s+sendJson\(response, isTimeout \? 504 : 500, \{\n\s+ok: false,\n\s+error: isTimeout\n\s+\? "MiMo 语音生成超时/,
  `sendJson(response, 200, {\n        ok: true,\n        provider: "mimo",\n        debugCode: "MIMO_TTS_OK",\n        requestId,\n        audioUrl,\n        format: "wav",\n        model: mimoModel,\n        scene,\n        textHash,\n        durationMs: 0,\n        text: text.slice(0, 20) + "***",\n      });\n    } catch (error) {\n      const isTimeout = error.name === "AbortError";\n      const safeMsg = sanitizeMimoError(error, null);\n      console.error("[tts:mimo:error] " + requestId, { requestId, isTimeout, error: safeMsg });\n      sendJson(response, isTimeout ? 504 : 500, {\n        ok: false,\n        provider: "mimo",\n        debugCode: isTimeout ? "MIMO_TTS_TIMEOUT" : "MIMO_TTS_ERROR",\n        requestId,\n        error: isTimeout\n          ? "MiMo 语音生成超时了，请稍后重试。"\n          : safeMsg`
);

writeFileSync("scripts/server.mjs", content);
console.log("Done MiMo debugCode updates");
