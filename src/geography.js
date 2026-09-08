import { validTimeZone } from './astronomy.js';
import { climateEcology, climateKey, createClimateCache, estimateClimate, fetchClimate, validCoordinates } from './climate.js';
import { DEFAULT_CLIMATE } from './climate-default.js';

export const LOCATION_PRESETS = [
  { name: 'Beijing', latitude: 39.9, longitude: 116.4, timezone: 'Asia/Shanghai' },
  { name: 'Singapore', latitude: 1.35, longitude: 103.82, timezone: 'Asia/Singapore' },
  { name: 'Cairo', latitude: 30.04, longitude: 31.24, timezone: 'Africa/Cairo' },
  { name: 'London', latitude: 51.51, longitude: -0.13, timezone: 'Europe/London' },
  { name: 'Sydney', latitude: -33.87, longitude: 151.21, timezone: 'Australia/Sydney' },
  { name: 'Tromsø', latitude: 69.65, longitude: 18.96, timezone: 'Europe/Oslo' },
];

export function createGeography(stored = {}, storage, fetcher = fetch) {
  const cache = createClimateCache(storage, [DEFAULT_CLIMATE]);
  let timer, timeout, controller, request = 0;
  const initial = validCoordinates(stored.latitude, stored.longitude) ? stored : LOCATION_PRESETS[0];
  const state = { latitude: initial.latitude, longitude: initial.longitude, profile: null, ecology: null,
    timezone: 'UTC', status: '', loading: false, onChange: () => {} };
  function selectProfile(profile, timezone) {
    state.profile = profile; state.ecology = climateEcology(profile);
    state.timezone = validTimeZone(timezone) ?? 'UTC';
  }
  function knownZone(latitude, longitude) {
    return LOCATION_PRESETS.find(p => climateKey(p.latitude, p.longitude) === climateKey(latitude, longitude))?.timezone;
  }
  function cancel() {
    request++; clearTimeout(timer); clearTimeout(timeout); controller?.abort(); controller = null;
  }
  function notify(climateChanged = false) { state.onChange({ climateChanged }); }
  function load(delay = 800) {
    cancel();
    if (state.profile.source === 'ERA5') return;
    const token = request, latitude = state.latitude, longitude = state.longitude;
    state.loading = true; state.status = 'Loading 1991–2020 climate…'; notify();
    timer = setTimeout(async () => {
      controller = new AbortController();
      timeout = setTimeout(() => controller?.abort(), 45000);
      try {
        const profile = await fetchClimate(latitude, longitude, controller.signal, fetcher);
        if (token !== request) return;
        cache.put(profile); selectProfile(profile, profile.timezone);
        state.status = 'ERA5 · 1991–2020 daily normals'; state.loading = false; notify(true);
      } catch (error) {
        if (token !== request) return;
        state.loading = false;
        state.status = error.name === 'AbortError' ? 'Estimated · climate request timed out.'
          : `Estimated · ${error instanceof TypeError ? 'Offline or climate service unavailable.' : error.message}`;
        notify();
      } finally { if (token === request) { clearTimeout(timeout); controller = null; } }
    }, delay);
  }
  function setLocation(latitude, longitude) {
    if (!validCoordinates(latitude, longitude)) return false;
    cancel();
    state.latitude = latitude; state.longitude = longitude;
    const cached = cache.get(latitude, longitude);
    selectProfile(cached ?? estimateClimate(latitude, longitude), cached?.timezone ?? knownZone(latitude, longitude));
    state.loading = false;
    state.status = cached ? 'ERA5 · 1991–2020 daily normals · offline copy' : 'Estimated · no cached climate at this location';
    notify(true); load(); return true;
  }
  const cached = cache.get(initial.latitude, initial.longitude);
  selectProfile(cached ?? estimateClimate(initial.latitude, initial.longitude), cached?.timezone
    ?? knownZone(initial.latitude, initial.longitude) ?? validTimeZone(initial.timezone));
  state.status = cached ? 'ERA5 · 1991–2020 daily normals · offline copy' : 'Estimated · no cached climate at this location';
  return Object.assign(state, { setLocation, load, dispose: cancel });
}
