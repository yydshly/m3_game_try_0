// Choice World Effect View Model
// Derives stage-level visualization data from player choices.
// Pure functions — no state mutation, no API calls.

const PLACE_NAMES = {
  garden: "花园",
  cafe: "餐厅",
  workshop: "工坊",
  plaza: "广场",
  forest: "森林",
};

const PLACE_ICONS = {
  garden: "🌸",
  cafe: "🍲",
  workshop: "🔨",
  plaza: "⛲",
  forest: "🌲",
};

/**
 * Derive a short emoji icon and world-trace marker label from choice label + result text.
 * markerLabel is a short (12-16 Chinese chars) world-trace description, NOT the full choice label.
 * Falls back gracefully when inputs are missing.
 * @param {string} choiceLabel
 * @param {string} resultText
 * @param {string} placeId
 * @returns {{ markerIcon: string, markerLabel: string }}
 */
function deriveMarker(choiceLabel, resultText, placeId) {
  const placeIcon = PLACE_ICONS[placeId] ?? "✨";

  const combined = `${choiceLabel ?? ""} ${resultText ?? ""}`;

  // Try to extract a short world-trace label from resultText first
  let markerLabel = extractWorldTraceLabel(resultText, choiceLabel);

  // Detect object/location keywords to pick a thematic icon
  if (/画册|相册|照片|挂|贴/.test(combined)) {
    return { markerIcon: "🖼️", markerLabel };
  }
  if (/花|种植|浇水|花园/.test(combined)) {
    return { markerIcon: "🌸", markerLabel };
  }
  if (/餐厅|咖啡|厨房|烹饪|热食/.test(combined)) {
    return { markerIcon: "🍲", markerLabel };
  }
  if (/工坊|修理|工具|木匠/.test(combined)) {
    return { markerIcon: "🔨", markerLabel };
  }
  if (/森林|采集|砍柴|摘果/.test(combined)) {
    return { markerIcon: "🌲", markerLabel };
  }
  if (/广场|聚会|跳舞|表演/.test(combined)) {
    return { markerIcon: "⛲", markerLabel };
  }
  // Fallback: use place icon
  return { markerIcon: placeIcon, markerLabel };
}

/**
 * Extract a short world-trace label (12-16 Chinese chars) from resultText.
 * Falls back to a shortened choiceLabel if extraction fails.
 * @param {string} resultText
 * @param {string} choiceLabel
 * @returns {string}
 */
function extractWorldTraceLabel(resultText, choiceLabel) {
  if (!resultText && !choiceLabel) return "留下了痕迹";

  // Try to find a short phrase in resultText that describes the world state
  // Patterns: "X在Y" / "X被Y" / "X到Y" / "Y有X" etc.
  const result = resultText ?? "";

  // Look for patterns like "小七把照片挂在工坊入口" → "照片挂在工坊"
  // or "花园被整理好了" → "花园被整理好了"
  // or "阿远把画册放到餐厅" → "画册放在餐厅旁"
  const patterns = [
    /([^\s，。！？、]{1,8}在[^\s，。！？、]{1,8})/,
    /([^\s，。！？、]{1,8}被[^\s，。！？、]{1,8})/,
    /([^\s，。！？、]{1,8}到[^\s，。！？、]{1,8})/,
    /([^\s，。！？、]{1,8}放[^\s，。！？、]{1,8})/,
    /([^\s，。！？、]{1,8}整理[^\s，。！？、]{1,8})/,
    /([^\s，。！？、]{1,8}帮[^\s，。！？、]{1,8})/,
    /([^\s，。！？、]{1,8}照顾[^\s，。！？、]{1,8})/,
    /([^\s，。！？、]{1,8}找到[^\s，。！？、]{1,8})/,
  ];

  for (const pattern of patterns) {
    const match = result.match(pattern);
    if (match && match[1]) {
      const label = match[1].trim();
      if (label.length >= 4 && label.length <= 16) return label;
      if (label.length > 16) return label.slice(0, 15);
    }
  }

  // Fallback: try to truncate resultText to 14 chars
  if (result.length >= 4) {
    const truncated = result.slice(0, 14).replace(/[，。！？、]\S*$/, "").trim();
    if (truncated.length >= 4) return truncated || "留下了痕迹";
  }

  // Last resort: shorten choiceLabel to 14 chars
  const label = choiceLabel ?? "留下了痕迹";
  return label.length > 14 ? label.slice(0, 13) + "…" : label;
}

/**
 * Build the choice world effect view model — data for stage-level choice markers.
 *
 * Data source priority:
 *  1. uiState.choiceAftermath  (most recent session memory)
 *  2. Most recent m3-event with chosenChoiceId in state.events
 *  3. Most recent player-choice event in state.events
 *
 * @param {object} state - game state
 * @param {object} uiState - UI state (contains choiceAftermath)
 * @returns {object} view model:
 *   {
 *     visible: boolean,
 *     eventId: string|null,
 *     choiceId: string|null,
 *     placeId: string|null,
 *     placeLabel: string,
 *     markerIcon: string,
 *     markerLabel: string,
 *     resultText: string,
 *     affectedResidents: Array<{ residentId, residentName, reactionText, role }>,
 *     tone: string,
 *     createdAt: number,
 *   }
 */
export function buildChoiceWorldEffectView(state, uiState) {
  const residents = state?.residents ?? [];
  let choiceAftermath = uiState?.choiceAftermath ?? null;
  let source = "choiceAftermath";

  // Fallback: find most recent chosen m3-event
  if (!choiceAftermath) {
    const events = state?.events ?? [];
    const latestChosenM3 = [...events].reverse().find(
      (e) => e.type === "m3-event" && e.chosenChoiceId
    );
    if (latestChosenM3) {
      const chosenChoice = (latestChosenM3.choices ?? []).find(
        (c) => c.id === latestChosenM3.chosenChoiceId
      );
      if (chosenChoice) {
        const { markerIcon, markerLabel } = deriveMarker(
          chosenChoice.label ?? "",
          chosenChoice.resultText ?? "",
          latestChosenM3.placeId ?? ""
        );
        const affectedResidents = (latestChosenM3.residentIds ?? []).slice(0, 2).map((id) => {
          const r = residents.find((res) => res.id === id);
          return {
            residentId: id,
            residentName: r?.name ?? "居民",
            reactionText: "明白了。",
            role: "helper",
          };
        });
        choiceAftermath = {
          id: `fallback-${latestChosenM3.id}`,
          eventId: latestChosenM3.id,
          choiceId: latestChosenM3.chosenChoiceId,
          placeId: latestChosenM3.placeId ?? null,
          choiceLabel: chosenChoice.label ?? "做出了选择",
          summary: chosenChoice.resultText ?? "",
          residentReactions: affectedResidents.map((r) => ({
            residentId: r.residentId,
            residentName: r.residentName,
            reaction: r.reactionText,
          })),
          createdAt: latestChosenM3.choiceChosenAt ?? null,
        };
        source = "m3-event";
      }
    }
  }

  // Fallback: find most recent player-choice event
  if (!choiceAftermath) {
    const events = state?.events ?? [];
    const latestPlayerChoice = [...events].reverse().find(
      (e) => e.type === "player-choice"
    );
    if (latestPlayerChoice) {
      const { markerIcon, markerLabel } = deriveMarker(
        latestPlayerChoice.choiceLabel ?? "",
        latestPlayerChoice.text ?? "",
        latestPlayerChoice.placeId ?? ""
      );
      const affectedResidents = (latestPlayerChoice.residentIds ?? []).slice(0, 2).map((id) => {
        const r = residents.find((res) => res.id === id);
        return {
          residentId: id,
          residentName: r?.name ?? "居民",
          reactionText: "好的。",
          role: "helper",
        };
      });
      choiceAftermath = {
        id: `fallback-${latestPlayerChoice.id}`,
        eventId: latestPlayerChoice.sourceEventId ?? latestPlayerChoice.id,
        choiceId: latestPlayerChoice.choiceId ?? "",
        placeId: latestPlayerChoice.placeId ?? null,
        choiceLabel: latestPlayerChoice.choiceLabel ?? "做出了选择",
        summary: latestPlayerChoice.text ?? "",
        residentReactions: affectedResidents.map((r) => ({
          residentId: r.residentId,
          residentName: r.residentName,
          reaction: r.reactionText,
        })),
        createdAt: latestPlayerChoice.createdAt ?? null,
      };
      source = "player-choice";
    }
  }

  if (!choiceAftermath || !choiceAftermath.id) {
    return { visible: false };
  }

  const placeId = choiceAftermath.placeId ?? null;
  const placeLabel = PLACE_NAMES[placeId] ?? "小镇";

  const { markerIcon, markerLabel } = deriveMarker(
    choiceAftermath.choiceLabel ?? "",
    choiceAftermath.summary ?? "",
    placeId ?? ""
  );

  const affectedResidents = (choiceAftermath.residentReactions ?? []).slice(0, 2).map((r) => ({
    residentId: r.residentId ?? "",
    residentName: r.residentName ?? "居民",
    reactionText: r.reaction ?? "",
    role: "helper",
  }));

  return {
    visible: true,
    eventId: choiceAftermath.eventId ?? null,
    choiceId: choiceAftermath.choiceId ?? null,
    placeId,
    placeLabel,
    markerIcon,
    markerLabel,
    resultText: choiceAftermath.summary ?? "",
    affectedResidents,
    tone: "warm",
    createdAt: choiceAftermath.createdAt ?? (Date.now() - 60_000),
  };
}
