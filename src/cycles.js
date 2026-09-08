// Independent, bounded clocks. Seeking changes only phase; speed changes only
// the next increment. Both advance in simulation seconds, so Pause holds both.
export const DAY_SECONDS = 600;
export const YEAR_SECONDS = 2400;
export const MAX_CYCLE_SPEED = 60;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

export function wrapPhase(phase) {
  return ((phase % 1) + 1) % 1;
}

export function validCycleSpeed(value, fallback = 1) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_CYCLE_SPEED
    ? value : fallback;
}

export function advancePhase(phase, seconds, speed, period) {
  if (!Number.isFinite(seconds) || seconds <= 0 || speed === 0) return phase;
  return wrapPhase(phase + (seconds * speed) / period);
}

// The visible clock follows the sun, while the engine compresses nighttime.
// Invert that monotonic clock so 06:00 is dawn and 18:00 is dusk on the slider.
export function phaseForHour(hour, solar) {
  const target = wrapPhase(hour / 24);
  let low = 0, high = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (solar(mid) < target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

// Adjacent seasons blend with zero slope at each anchor, including year wrap.
export function seasonWeights(phase, out = [0, 0, 0, 0]) {
  const position = wrapPhase(phase) * 4, index = Math.floor(position);
  const fraction = position - index, blend = fraction * fraction * (3 - 2 * fraction);
  out.fill(0);
  out[index] = 1 - blend;
  out[(index + 1) % 4] = blend;
  return out;
}

export function formatHour(hour) {
  const minutes = Math.floor(wrapPhase(hour / 24) * 1440 + 1e-7) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function formatSeason(phase) {
  const position = wrapPhase(phase) * 4, index = Math.floor(position);
  const percent = Math.floor((position - index) * 100 + 1e-7);
  return percent === 0 ? SEASONS[index] : `${SEASONS[index]} → ${SEASONS[(index + 1) % 4]} · ${percent}%`;
}
