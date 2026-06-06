// MiMo TTS client — calls the server-side /api/mimo/tts proxy
// Does NOT expose API keys; all requests go through the server endpoint

import { validateSceneText } from "./ttsService.js";

/**
 * Generate speech using MiMo TTS via the server-side proxy.
 *
 * @param {object} options
 * @param {string} options.scene       - TTS scene type (e.g. "resident_dialogue")
 * @param {string} options.text        - Text to synthesize
 * @param {string} [options.voice]     - Optional voice override
 * @param {string} [options.emotion]   - Optional emotion hint
 * @param {number} [options.speed]     - Optional speed override
 * @param {object} [options.metadata]  - Optional extra metadata
 * @returns {Promise<{ audioUrl: string, provider: string, durationMs: number, text: string }>}
 */
export async function generateMimoSpeech({ scene, text, voice, emotion, speed, metadata } = {}) {
  const validation = validateSceneText(scene, text);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const response = await fetch("./api/mimo/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: text.trim(),
      scene: scene ?? "resident_dialogue",
      voice: voice ?? "default",
      emotion: emotion ?? "neutral",
      speed: speed ?? 1.0,
      metadata: metadata ?? {},
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.ok) {
    const errMsg = payload?.error ?? `HTTP ${response.status}`;
    throw new Error(errMsg);
  }

  if (!payload.audioUrl) {
    throw new Error("MiMo TTS 未返回音频");
  }

  return {
    audioUrl: payload.audioUrl,
    provider: "mimo",
    durationMs: payload.durationMs ?? 0,
    text: payload.text ?? text,
  };
}
