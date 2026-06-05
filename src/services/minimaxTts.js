// TTS configuration defaults — consumed by the server-side /api/minimax/tts endpoint
export const ttsConfigDefaults = {
  enabled: true,
  model: "speech-2.8-hd",
  voiceId: "female-tianmei",
  speed: 1,
  vol: 1,
  pitch: 0,
  sampleRate: 32000,
  bitrate: "128000",
  format: "mp3",
  channel: 1,
  timeoutMs: 30000,
};

const MAX_TEXT_LENGTH = 3000;

/**
 * Validate broadcast text before TTS generation.
 * @param {string} text
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateBroadcastText(text) {
  if (!text || typeof text !== "string") {
    return { valid: false, reason: "广播文本为空" };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: "广播文本为空" };
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return { valid: false, reason: `广播文本超过 ${MAX_TEXT_LENGTH} 字符限制` };
  }
  return { valid: true };
}

/**
 * Generate speech for a broadcast script.
 * Calls the server-side /api/minimax/tts proxy to avoid exposing API keys.
 *
 * @param {string} text - Broadcast script text
 * @returns {Promise<{ audioUrl: string, traceId: string|null, extraInfo: object|null }>}
 */
export async function generateBroadcastSpeech(text) {
  const validation = validateBroadcastText(text);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const response = await fetch("./api/minimax/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: text.trim() }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.error ??
        payload.technicalError ??
        `TTS request failed with ${response.status}`,
    );
  }

  const { audioUrl, traceId, extraInfo } = payload;

  if (!audioUrl) {
    throw new Error("TTS returned no audio data");
  }

  return { audioUrl, traceId: traceId ?? null, extraInfo: extraInfo ?? null };
}

/**
 * Revoke a blob URL to free memory.
 * @param {string} url
 */
export function revokeAudioUrl(url) {
  if (url && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}
