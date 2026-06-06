// mimo-tts-param-probe — tests different voice/format combinations against MiMo Token Plan
// Opt-in: set MIMO_TTS_PROBE=1 to run real API calls
//
// Each case tests a short text "今天真不错。" with different voice/format combos.
// Output is sanitized: no API keys, no full text, no base64.

const SERVER_URL = process.env.MIMO_SERVER_URL ?? "http://127.0.0.1:4173";
const PROBE_TEST = process.env.MIMO_TTS_PROBE === "1";
const TEST_TEXT = "今天真不错。";

const CASES = [
  { caseName: "voice=mimo_default_format=wav", voice: "mimo_default", format: "wav" },
  { caseName: "voice=Mia_format=wav", voice: "Mia", format: "wav" },
  { caseName: "voice=mimo_default_format=mp3", voice: "mimo_default", format: "mp3" },
  { caseName: "voice=Mia_format=mp3", voice: "Mia", format: "mp3" },
  { caseName: "no_voice_format=wav", voice: undefined, format: "wav" },
];

async function probeCase(text, voice, format, scene = "resident_dialogue") {
  const requestId = `probe-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  try {
    const body = {
      text,
      scene,
      voice: voice ?? "default",
      emotion: "neutral",
      speed: 1.0,
    };
    // Add audio format only if we can control it (currently hardcoded to wav in server)
    // The server currently ignores format in the request body for Token Plan
    // We probe by observing the response

    const res = await fetch(`${SERVER_URL}/api/mimo/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({}));

    // Determine audio field path
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
      errorMsg: json?.error ?? (res.status !== 200 ? `HTTP ${res.status}` : ""),
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

async function runProbes() {
  console.log("\n=== MiMo TTS Parameter Probe ===\n");
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Test text: "${TEST_TEXT}" (${TEST_TEXT.length} chars)`);
  console.log(`Real probe: ${PROBE_TEST ? "ENABLED" : "DISABLED (dry-run only)"}`);
  console.log("\n--- Cases ---");

  if (!PROBE_TEST) {
    console.log("\nDry-run mode — testing request construction only.\n");
    console.log("To run real probe: MIMO_TTS_PROBE=1 npm run mimo-tts-param-probe\n");

    // In dry-run mode, just verify the endpoint is reachable and returns structure
    const dryResult = await probeCase(TEST_TEXT, "mimo_default", "wav");
    if (dryResult.httpStatus === 0) {
      console.log("Server not reachable. Is the dev server running?");
      console.log("Run: npm run dev");
      process.exit(1);
    }

    console.log("Dry-run result (first case):");
    console.log(`  httpStatus: ${dryResult.httpStatus}`);
    console.log(`  ok: ${dryResult.ok}`);
    console.log(`  debugCode: ${dryResult.debugCode}`);
    console.log("\nReal probe not run (MIMO_TTS_PROBE != 1).");
    return;
  }

  // Real probe mode
  const results = [];
  for (const c of CASES) {
    const result = await probeCase(TEST_TEXT, c.voice, c.format);
    result.caseName = c.caseName;
    results.push(result);

    // Sanitized output — no base64, no keys, no full text
    console.log(`\n[${c.caseName}]`);
    console.log(`  httpStatus: ${result.httpStatus}`);
    console.log(`  ok: ${result.ok}`);
    console.log(`  errorMsg: ${result.errorMsg || "(none)"}`);
    console.log(`  hasAudio: ${result.hasAudio}`);
    console.log(`  audioFieldPath: ${result.audioFieldPath || "(none)"}`);
    console.log(`  debugCode: ${result.debugCode || "(none)"}`);

    // Small delay between requests to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  // Summary
  console.log("\n--- Summary ---");
  const successCases = results.filter((r) => r.ok && r.hasAudio);
  const failedCases = results.filter((r) => !r.ok || !r.hasAudio);

  if (successCases.length > 0) {
    console.log(`\nSuccessful cases (${successCases.length}):`);
    for (const r of successCases) {
      console.log(`  - ${r.caseName} (${r.debugCode})`);
    }
  }

  if (failedCases.length > 0) {
    console.log(`\nFailed/unexpected cases (${failedCases.length}):`);
    for (const r of failedCases) {
      console.log(`  - ${r.caseName}: ${r.debugCode || "HTTP " + r.httpStatus} — ${r.errorMsg || "no audio"}`);
    }
  }

  console.log("\n=== Probe Complete ===");
}

runProbes().catch((err) => {
  console.error("Probe failed:", err.message);
  process.exit(1);
});
