import { validDate, validTimeZone } from './astronomy.js';
import { climateEcology, climateKey, createClimateCache, DEFAULT_DATE, estimateClimate, fetchClimate, hasClimateDate,
  mergeClimateWindow, missingClimateWindow, validCacheDays, validCoordinates, weatherWindow } from './climate.js';
import { DEFAULT_CLIMATE } from './climate-default.js';

export const LOCATION_PRESETS = [
  { name: 'Beijing', latitude: 39.9, longitude: 116.4, timezone: 'Asia/Shanghai' },
  { name: 'Singapore', latitude: 1.35, longitude: 103.82, timezone: 'Asia/Singapore' },
  { name: 'Cairo', latitude: 30.04, longitude: 31.24, timezone: 'Africa/Cairo' },
  { name: 'London', latitude: 51.51, longitude: -0.13, timezone: 'Europe/London' },
  { name: 'Sydney', latitude: -33.87, longitude: 151.21, timezone: 'Australia/Sydney' },
  { name: 'Tromsø', latitude: 69.65, longitude: 18.96, timezone: 'Europe/Oslo' },
];

export function createGeography(stored = {}, storage, fetcher = fetch, timing = {}) {
  const now = timing.now ?? Date.now, interval = timing.interval ?? 5000, debounce = timing.debounce ?? 800;
  const cacheDays = validCacheDays(stored.cacheDays);
  const cache = createClimateCache(storage, [DEFAULT_CLIMATE], cacheDays);
  let timer, timeout, controller, request = 0, disposed = false, calibrated = false, lastStarted = -Infinity;
  const initial = validCoordinates(stored.latitude, stored.longitude) ? stored : LOCATION_PRESETS[0];
  const state = { latitude: initial.latitude, longitude: initial.longitude, date: DEFAULT_DATE, cacheDays,
    profile: null, ecology: null, timezone: validTimeZone(initial.timezone) ?? 'UTC',
    status: '', loading: false, retryAt: 0, onChange: () => {} };
  function knownZone() {
    return LOCATION_PRESETS.find(p => climateKey(p.latitude, p.longitude) === climateKey(state.latitude, state.longitude))?.timezone;
  }
  function selectWeather(resetEcology = false) {
    const cached = cache.get(state.latitude, state.longitude);
    state.profile = cached ?? estimateClimate(state.latitude, state.longitude);
    state.timezone = validTimeZone(cached?.timezone) ?? knownZone() ?? (resetEcology ? 'UTC' : state.timezone);
    const actual = hasClimateDate(state.profile, state.date);
    const climateChanged = resetEcology || (!calibrated && actual) || !state.ecology;
    if (climateChanged) {
      state.ecology = climateEcology(actual ? state.profile : estimateClimate(state.latitude, state.longitude));
      calibrated = actual;
    }
    state.status = actual ? `ERA5 · ${state.date} · cached daily weather` : `Estimated · no cached weather for ${state.date}`;
    return climateChanged;
  }
  function cancel() {
    request++; clearTimeout(timer); timer = null; clearTimeout(timeout); controller?.abort(); controller = null; state.loading = false;
  }
  function notify(climateChanged = false, weatherChanged = false) { state.onChange({ climateChanged, weatherChanged }); }
  function load(delay = debounce) {
    if (disposed) return;
    if (hasClimateDate(state.profile, state.date)) {
      clearTimeout(timer); timer = null;
      state.loading = !!controller;
      return;
    }
    const window = weatherWindow(state.date, state.cacheDays, now());
    if (!window) {
      clearTimeout(timer); timer = null; state.loading = !!controller;
      state.status = 'Estimated · ERA5 covers 1940 through about five days before today.'; notify(); return;
    }
    if (now() < state.retryAt) {
      state.status = `Estimated · weather requests paused; retry after ${new Date(state.retryAt).toLocaleTimeString()}.`;
      notify(); return;
    }
    // Keep an in-flight request when only the date changes: aborting does not
    // refund provider quota. Read the latest date when the queued request starts.
    if (controller || timer) return;
    state.loading = true; state.status = `Estimated · loading weather near ${state.date}…`; notify();
    const token = request;
    timer = setTimeout(async () => {
      timer = null;
      const target = weatherWindow(state.date, state.cacheDays, now());
      if (!target || disposed || token !== request) { state.loading = false; return; }
      const latitude = state.latitude, longitude = state.longitude;
      const previous = cache.get(latitude, longitude);
      const missing = missingClimateWindow(previous, target);
      controller = new AbortController(); const signal = controller.signal;
      timeout = setTimeout(() => controller?.abort(), 30000);
      lastStarted = now();
      let failed = false;
      try {
        const incoming = await fetchClimate(latitude, longitude, missing, signal, fetcher);
        if (disposed || token !== request) return;
        const profile = mergeClimateWindow(previous, incoming, target);
        // Returning to a cached day while a different window loads must not
        // evict the day currently on screen and trigger another download.
        if (!hasClimateDate(previous, state.date) || hasClimateDate(profile, state.date)) cache.put(profile, state.date);
        const climateChanged = selectWeather();
        state.loading = false; state.retryAt = 0; notify(climateChanged, true);
      } catch (error) {
        if (disposed || token !== request) return;
        failed = true; state.loading = false;
        state.retryAt = now() + Math.max(15000, error.retryAfter ?? 15000);
        const reason = error.name === 'AbortError' ? 'Weather request timed out.'
          : error instanceof TypeError ? 'Offline or weather service unavailable.' : error.message;
        state.status = hasClimateDate(state.profile, state.date) ? `ERA5 · ${state.date} · cached daily weather`
          : `Estimated · ${reason} Retry after ${new Date(state.retryAt).toLocaleTimeString()}.`;
        notify();
      } finally {
        if (token === request) {
          clearTimeout(timeout); controller = null; state.loading = false;
          if (!failed && !disposed && !hasClimateDate(state.profile, state.date)) load();
        }
      }
    }, Math.max(delay, lastStarted + interval - now(), 0));
  }
  function setDate(date) {
    if (!validDate(date) || date === state.date || disposed) return;
    state.date = date;
    const climateChanged = selectWeather();
    if (climateChanged) notify(true);
    load();
  }
  function setCacheDays(days) {
    if (disposed) return;
    state.cacheDays = validCacheDays(days);
    cancel(); cache.resize(state.cacheDays, state.date); const climateChanged = selectWeather(); notify(climateChanged, true); load();
  }
  function setLocation(latitude, longitude) {
    if (!validCoordinates(latitude, longitude) || disposed) return false;
    if (latitude === state.latitude && longitude === state.longitude) return true;
    cancel(); state.latitude = latitude; state.longitude = longitude;
    const climateChanged = selectWeather(true);
    notify(climateChanged, true); load(); return true;
  }
  selectWeather();
  return Object.assign(state, { setLocation, setDate, setCacheDays, load, dispose() { disposed = true; cancel(); } });
}
