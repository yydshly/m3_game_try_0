// Unified TTS Service — dispatches to MiniMax or MiMo based on scene type
// No DOM dependencies, no state mutation

// ── Scene → Provider Strategy ──────────────────────────────────────────────────

/**
 * @typedef {Object} TtsScene
 * @property {"town_broadcast"|"resident_dialogue"|"event_prompt"|"completion_feedback"|"day_opening"} scene
 */

/**
 * Resolve which TTS provider to use for a given scene.
 * town_broadcast uses MiniMax; lightweight scenes use MiMo.
 *
 * @param {string} scene
 * @returns {"minimax"|"mimo"}
 */
export function resolveTtsProviderForScene(scene) {
  const map = {
    town_broadcast: "minimax",
    resident_dialogue: "mimo",
    event_prompt: "mimo",
    completion_feedback: "mimo",
    day_opening: "mimo",
  };
  return map[scene] ?? "mimo";
}

// ── Audio Key Builder ─────────────────────────────────────────────────────────

/**
 * Build a stable audio key for caching/dedup.
 * @param {string} scene
 * @param {string|undefined} residentId
 * @param {string|undefined} beatId
 * @returns {string}
 */
export function buildAudioKey(scene, residentId, beatId) {
  if (residentId && beatId) {
    return `${scene}:${residentId}:${beatId}`;
  }
  if (residentId) {
    return `${scene}:${residentId}`;
  }
  return `${scene}:current`;
}

// ── Text Hash (shared with broadcast) ────────────────────────────────────────

/** Simple string hash for detecting script changes. */
export function hashText(text) {
  return String(text || "")
    .trim()
    .split("")
    .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
    .toString(16);
}

// ── Unified generateSpeech ─────────────────────────────────────────────────────

/**
 * Generate speech via the appropriate TTS provider.
 *
 * @param {object} options
 * @param {"minimax"|"mimo"} options.provider
 * @param {string} options.scene
 * @param {string} options.text
 * @param {string} [options.voice]
 * @param {string} [options.emotion]
 * @param {number} [options.speed]
 * @param {object} [options.metadata]
 * @returns {Promise<{ audioUrl: string, provider: string, durationMs: number, text: string }>}
 */
export async function generateSpeech({ provider, scene, text, voice, emotion, speed, metadata } = {}) {
  if (provider === "mimo") {
    const { generateMimoSpeech } = await import("./mimoClient.js");
    return generateMimoSpeech({ scene, text, voice, emotion, speed, metadata });
  }

  if (provider === "minimax") {
    const { generateBroadcastSpeech } = await import("./minimaxTts.js");
    const result = await generateBroadcastSpeech(text);
    return { ...result, provider: "minimax", durationMs: 0, text };
  }

  throw new Error(`Unsupported TTS provider: ${provider}`);
}

// ── Text length limits per scene ───────────────────────────────────────────────

const TEXT_LIMITS = {
  town_broadcast: 3000,
  resident_dialogue: 80,
  event_prompt: 80,
  completion_feedback: 40,
  day_opening: 60,
};

/**
 * Validate text length for a given scene.
 * @param {string} scene
 * @param {string} text
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateSceneText(scene, text) {
  if (!text || typeof text !== "string" || !text.trim()) {
    return { valid: false, reason: "文本为空" };
  }
  const limit = TEXT_LIMITS[scene] ?? 200;
  if (text.length > limit) {
    return { valid: false, reason: `文本超过 ${limit} 字限制` };
  }
  return { valid: true };
}
