// mimo-tts-param-probe — tests different voice/format combinations against MiMo Token Plan
// Default: dry-run via server /api/mimo/tts endpoint (no real MiMo call)
// Real probe: reads config.local.json for MiMo credentials, calls server which proxies to MiMo
//
// Each case tests short text with different voice/format combos.
// Output is sanitized: no API keys, no full text, no base64.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// ── Config ────────────────────────────────────────────────────────────────────

function loadConfig() {
  const configPath = join(root, "config.local.json");
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch { return {}; }
}

const PROBE_TEST = process.env.MIMO_TTS_PROBE === "1";
const TEST_TEXT = "今天真不错。";
const SERVER_URL = "http://127.0.0.1:4173";

// The cases to probe — voice + format combos
// format is sent as top-level override to server (server passes it to MiMo)
const CASES = [
  { caseName: "voice=mimo_default_format=wav", voice: "mimo_default", format: "wav" },
  { caseName: "voice=冰糖_format=wav", voice: "冰糖", format: "wav" },
  { caseName: "voice=茉莉_format=wav", voice: "茉莉", format: "wav" },
  { caseName: "voice=苏打_format=wav", voice: "苏打", format: "wav" },
  { caseName: "voice=白桦_format=wav", voice: "白桦", format: "wav" },
  { caseName: "voice=mimo_default_format=mp3", voice: "mimo_default", format: "mp3" },
];

// ── Probe single case ────────────────────────────────────────────────────────

async function probeCase(text, voice, format, scene = "resident_dialogue") {
  const requestId = `probe-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  try {
    const body = {
      text,
      scene,
      voice,       // server uses body.voice for audio.voice
      format,     // server uses body.format for audio.format
      emotion: "neutral",
      speed: 1.0,
    };

    const res = await fetch(`${SERVER_URL}/api/mimo/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({}));

    // Determine audio field path that worked
    let audioFieldPath = null;
    if (json?.choices?.[0]?.message?.audio?.data) audioFieldPath = "choices[0].message.audio.data";
    else if (json?.choices?.[0]?.message?.audio?.base64) audioFieldPath = "choices[0].message.audio.base64";
    else if (json?.choices?.[0]?.message?.audio_data) audioFieldPath = "choices[0].message.audio_data";
    else if (json?.choices?.[0]?.audio?.data) audioFieldPath = "choices[0].audio.data";
    else if (json?.audio?.data) audioFieldPath = "audio.data";
    else if (json?.data?.audio) audioFieldPath = "data.audio";

    return {
      caseName: "",
      httpStatus: res.status,
      ok: json?.ok ?? false,
      errorMsg: (json?.error ?? "").slice(0, 120),
      hasAudio: Boolean(json?.audioUrl || audioFieldPath),
      audioFieldPath,
      debugCode: json?.debugCode ?? null,
    };
  } catch (err) {
    return {
      caseName: "",
      httpStatus: 0,
      ok: false,
      errorMsg: err.message?.slice(0, 100) ?? "network error",
      hasAudio: false,
      audioFieldPath: null,
      debugCode: null,
    };
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

async function runProbes() {
  console.log("\n=== MiMo TTS Parameter Probe ===\n");
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Test text: "${TEST_TEXT}" (${TEST_TEXT.length} chars)`);
  console.log(`Real probe: ${PROBE_TEST ? "ENABLED" : "DISABLED (dry-run only)"}`);
  console.log(`\nCases (${CASES.length}):`);
  for (const c of CASES) console.log(`  - ${c.caseName}`);

  if (!PROBE_TEST) {
    console.log("\nDry-run mode — testing server endpoint only.\n");
    const dryResult = await probeCase(TEST_TEXT, "mimo_default", "wav");
    if (dryResult.httpStatus === 0) {
      console.log("Server not reachable. Is the dev server running?");
      console.log("Run: npm run dev");
      process.exit(1);
    }
    console.log("Dry-run result (mimo_default+wav):");
    console.log(`  httpStatus: ${dryResult.httpStatus}`);
    console.log(`  ok: ${dryResult.ok}`);
    console.log(`  debugCode: ${dryResult.debugCode}`);
    console.log("\nReal probe not run (MIMO_TTS_PROBE != 1).");
    console.log("To enable: MIMO_TTS_PROBE=1 npm run mimo-tts-param-probe");
    return;
  }

  // Real probe — check config has MiMo credentials
  const cfg = loadConfig();
  const hasMimo = Boolean(cfg?.mimo?.tts?.apiKey && cfg.mimo.tts.enabled);
  if (!hasMimo) {
    console.log("\nMiMo not configured in config.local.json (or disabled).");
    console.log("Real probe requires mimo.tts.enabled=true and mimo.tts.apiKey set.");
    process.exit(1);
  }

  console.log("\n--- Probing (real MiMo calls) ---");

  const results = [];
  for (const c of CASES) {
    process.stdout.write(`\n[${c.caseName}] ... `);
    const result = await probeCase(TEST_TEXT, c.voice, c.format);
    result.caseName = c.caseName;
    results.push(result);

    // Sanitized output
    if (result.ok && result.hasAudio) {
      console.log(`OK (${result.debugCode}, path=${result.audioFieldPath})`);
    } else {
      console.log(`FAIL (${result.debugCode || "HTTP " + result.httpStatus}) — ${result.errorMsg || "no audio"}`);
    }

    await new Promise((r) => setTimeout(r, 600)); // rate-limit delay
  }

  // Summary
  console.log("\n--- Summary ---");
  const successCases = results.filter((r) => r.ok && r.hasAudio);
  const failedCases = results.filter((r) => !r.ok || !r.hasAudio);

  if (successCases.length > 0) {
    console.log(`\nSuccessful (${successCases.length}):`);
    for (const r of successCases) {
      console.log(`  ✓ ${r.caseName} — ${r.debugCode}, path=${r.audioFieldPath}`);
    }
  } else {
    console.log("\nNo successful cases — check server logs for [tts:mimo:request-shape].");
  }

  if (failedCases.length > 0) {
    console.log(`\nFailed (${failedCases.length}):`);
    for (const r of failedCases) {
      console.log(`  ✗ ${r.caseName}: ${r.debugCode || "HTTP " + r.httpStatus} — ${r.errorMsg || "no audio"}`);
    }
  }

  console.log("\n=== Probe Complete ===");
}

runProbes().catch((err) => {
  console.error("Probe error:", err.message);
  process.exit(1);
});
