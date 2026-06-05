const STORAGE_KEY = "ai-town-life-state";

function isValidState(value) {
  return Boolean(
    value &&
      Number.isInteger(value.day) &&
      Number.isInteger(value.phaseIndex) &&
      Array.isArray(value.residents) &&
      Array.isArray(value.events) &&
      Array.isArray(value.reports) &&
      value.town &&
      typeof value.town.comfort === "number" &&
      typeof value.town.supplies === "number" &&
      typeof value.town.spirit === "number",
  );
}

export function loadState() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    return isValidState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}
