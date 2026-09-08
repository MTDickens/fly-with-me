// Actual historical daily weather. Temperatures are °C; water is mm/day.
// Requests are bounded date windows, never multi-year climate normals.
export const DEFAULT_DATE = '2004-08-21';
export const CACHE_DAY_OPTIONS = [0, 3, 7, 14, 30];
export const CLIMATE_FIELDS = ['temperature_2m_min', 'temperature_2m_max', 'temperature_2m_mean', 'precipitation_sum', 'et0_fao_evapotranspiration'];
const DAY = 86400000;
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mean = values => values.reduce((sum, v) => sum + v, 0) / values.length;
const stamp = date => Date.parse(date + 'T00:00:00Z');
const iso = utc => new Date(utc).toISOString().slice(0, 10);
const isDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
  && Number.isFinite(stamp(date)) && iso(stamp(date)) === date;
export function validCacheDays(days) { return CACHE_DAY_OPTIONS.includes(days) ? days : 7; }
export function climateKey(latitude, longitude) { return `${latitude.toFixed(3)},${longitude.toFixed(3)}`; }
export function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}
export function weatherWindow(date, days = 7, now = Date.now()) {
  if (!isDate(date)) return null;
  // ERA5 archive has a publication delay. Do not repeatedly request unavailable days.
  const first = stamp('1940-01-01'), last = Math.floor(now / DAY) * DAY - 5 * DAY;
  const selected = stamp(date), radius = validCacheDays(days) * DAY;
  if (selected < first || selected > last) return null;
  return { startDate: iso(Math.max(first, selected - radius)), endDate: iso(Math.min(last, selected + radius)) };
}
export function climateURL(latitude, longitude, window) {
  if (!validCoordinates(latitude, longitude)) throw new Error('Coordinates are outside the world');
  if (!window || !isDate(window.startDate) || !isDate(window.endDate)
    || window.startDate > window.endDate || stamp(window.endDate) - stamp(window.startDate) > 60 * DAY)
    throw new Error('Weather requests must contain at most 61 consecutive days');
  const query = new URLSearchParams({ latitude, longitude, start_date: window.startDate, end_date: window.endDate,
    daily: CLIMATE_FIELDS.join(','), timezone: 'auto', models: 'era5', cell_selection: 'nearest' });
  return `https://archive-api.open-meteo.com/v1/archive?${query}`;
}
export function calendarIndex(date) {
  if (date.slice(5) === '02-29') return 58.5;
  return (stamp(`2001-${date.slice(5)}`) - Date.UTC(2001, 0, 1)) / DAY;
}
function validRow(row) {
  return Array.isArray(row) && row.length === 5 && row.every(Number.isFinite)
    && row[0] >= -100 && row[1] <= 70 && row[0] <= row[1]
    && row[2] >= row[0] - 0.2 && row[2] <= row[1] + 0.2 && row[3] >= 0 && row[4] >= 0;
}
export function validClimate(profile) {
  return profile?.version === 2 && profile.source === 'ERA5'
    && validCoordinates(profile.latitude, profile.longitude) && typeof profile.timezone === 'string'
    && isDate(profile.startDate) && isDate(profile.endDate)
    && Array.isArray(profile.rows) && profile.rows.length >= 1 && profile.rows.length <= 61
    && profile.rows.length === (stamp(profile.endDate) - stamp(profile.startDate)) / DAY + 1
    && profile.rows.every(validRow);
}
export function parseClimate(payload, latitude, longitude, window) {
  const daily = payload.daily;
  const count = (stamp(window.endDate) - stamp(window.startDate)) / DAY + 1;
  if (!daily || !Array.isArray(daily.time) || daily.time.length !== count
    || CLIMATE_FIELDS.some(key => !Array.isArray(daily[key]) || daily[key].length !== count))
    throw new Error('Incomplete daily weather data');
  if (CLIMATE_FIELDS.slice(0, 3).some(key => payload.daily_units?.[key] !== '°C')
    || CLIMATE_FIELDS.slice(3).some(key => payload.daily_units?.[key] !== 'mm')) throw new Error('Unexpected weather units');
  if (daily.time.some((date, i) => date !== iso(stamp(window.startDate) + i * DAY)))
    throw new Error('Weather dates do not match the requested window');
  const profile = { version: 2, source: 'ERA5', latitude, longitude,
    gridLatitude: payload.latitude, gridLongitude: payload.longitude, elevation: payload.elevation,
    timezone: payload.timezone, ...window, rows: daily.time.map((_, i) => CLIMATE_FIELDS.map(key => daily[key][i])) };
  if (!validClimate(profile)) throw new Error('Missing or invalid daily weather values');
  return profile;
}
export function hasClimateDate(profile, date) {
  return profile?.source === 'ERA5' && isDate(date) && date >= profile.startDate && date <= profile.endDate;
}
function estimatedRow(latitude, date) {
  const absolute = Math.abs(latitude), radians = absolute * Math.PI / 180;
  const average = 28 - 48 * Math.sin(radians) ** 1.5, amplitude = 2 + 19 * Math.sin(radians);
  const precipitation = 250 + 2100 * Math.exp(-((absolute / 13) ** 2)) + 650 * Math.exp(-(((absolute - 50) / 15) ** 2));
  const warm = Math.cos((calendarIndex(date) - (latitude < 0 ? 20 : 202)) / 365 * Math.PI * 2);
  const temperature = average + amplitude * warm;
  return [temperature - 5, temperature + 5, temperature, precipitation / 365, Math.max(0.2, (temperature + 8) * 0.13)];
}
export function climateOnDate(profile, date) {
  const actual = hasClimateDate(profile, date);
  const row = actual ? profile.rows[(stamp(date) - stamp(profile.startDate)) / DAY] : estimatedRow(profile.latitude, date);
  return { date, source: actual ? 'ERA5' : 'estimate', low: row[0], high: row[1], mean: row[2], rain: row[3], evapotranspiration: row[4] };
}
// Procedural annual latitude curve, generated locally; no historical download.
export function estimateClimate(latitude, longitude) {
  return { source: 'estimate', latitude, longitude, timezone: 'UTC',
    rows: Array.from({ length: 365 }, (_, i) => estimatedRow(latitude, iso(Date.UTC(2001, 0, 1) + i * DAY))) };
}
export function climateEcology(profile) {
  // A short weather window cannot establish annual climate or land cover.
  // Calibrate a latitude prior once per location, then retain its species mix
  // while the date moves. The weather only weakly influences annual wetness.
  const prior = estimateClimate(profile.latitude, profile.longitude);
  let temperatureOffset = 0, waterScale = 1;
  if (profile.source === 'ERA5') {
    const expected = profile.rows.map((_, i) => estimatedRow(profile.latitude, iso(stamp(profile.startDate) + i * DAY)));
    temperatureOffset = mean(profile.rows.map((row, i) => row[2] - expected[i][2]));
    const rainRatio = mean(profile.rows.map(row => row[3])) / Math.max(0.1, mean(expected.map(row => row[3])));
    waterScale = 0.8 + 0.2 * Math.min(3, rainRatio);
  }
  const rows = prior.rows.map(row => [row[0] + temperatureOffset, row[1] + temperatureOffset,
    row[2] + temperatureOffset, row[3] * waterScale, Math.max(0.2, (row[2] + temperatureOffset + 8) * 0.13)]);
  const monthly = Array.from({ length: 12 }, () => []);
  rows.forEach((row, i) => monthly[new Date(Date.UTC(2001, 0, 1) + i * DAY).getUTCMonth()].push(row[2]));
  const annualTemperature = mean(rows.map(row => row[2]));
  const coldest = Math.min(...monthly.map(mean)), warmest = Math.max(...monthly.map(mean));
  const precipitation = rows.reduce((sum, row) => sum + row[3], 0);
  const potentialEvaporation = Math.max(1, rows.reduce((sum, row) => sum + row[4], 0));
  const aridity = precipitation / potentialEvaporation;
  let vegetation;
  if (warmest < 0) vegetation = 'Ice / sparse vegetation';
  else if (warmest < 10) vegetation = 'Tundra';
  else if (aridity < 0.2) vegetation = 'Desert / sparse scrub';
  else if (aridity < 0.5) vegetation = coldest > 15 ? 'Savanna / dry woodland' : 'Steppe / dry woodland';
  else if (coldest > 18) vegetation = 'Tropical forest';
  else if (annualTemperature < 5) vegetation = 'Boreal forest';
  else vegetation = aridity > 1.2 ? 'Wet temperate forest' : 'Temperate woodland';
  return { annualTemperature, precipitation, potentialEvaporation, aridity, coldest, warmest, vegetation,
    temperature: clamp01((annualTemperature + 15) / 50), moisture: clamp01(0.1 + 0.52 * Math.log1p(aridity) / Math.LN2),
    seasonality: 1 - smooth(10, 20, coldest),
    treeCover: smooth(10, 14, warmest) * (0.08 + 0.92 * smooth(0.05, 0.55, aridity)),
    grassCover: smooth(-1, 5, warmest) * smooth(0.03, 0.35, aridity) };
}

// The CPU/GPU use this same affine climate transform before the soft cells.
// Local terrain keeps its noise and altitude gradient; latitude is not noise.
export function geographicClimate(temp, moist, ecology) {
  return [clamp01(ecology.temperature + (temp - 0.5) * 0.34),
    clamp01(ecology.moisture + (moist - 0.5) * 0.32)];
}

// Broad functional tolerances for this small scenery library, not a species
// distribution map. Frost-prone climates cannot turn into palm/acacia woods
// just because their annual mean is warm and their summers are dry.
export function speciesSuitability(id, ecology) {
  if (id === 'palm') return smooth(5, 12, ecology.coldest);
  if (id === 'acacia') return smooth(0, 8, ecology.coldest);
  if (id === 'cypress') return smooth(-15, -3, ecology.coldest);
  if (id === 'blossom') return 1 - smooth(16, 23, ecology.coldest);
  return 1;
}

export function trimClimate(profile, date, days) {
  if (profile.rows.length <= validCacheDays(days) * 2 + 1) return profile;
  const center = Math.max(stamp(profile.startDate), Math.min(stamp(profile.endDate), stamp(date)));
  const start = Math.max(stamp(profile.startDate), center - validCacheDays(days) * DAY);
  const end = Math.min(stamp(profile.endDate), center + validCacheDays(days) * DAY);
  return { ...profile, startDate: iso(start), endDate: iso(end),
    rows: profile.rows.slice((start - stamp(profile.startDate)) / DAY, (end - stamp(profile.startDate)) / DAY + 1) };
}
// When advancing beyond a cached edge, fetch only the missing end of the new
// window. Keep at most one bounded window for each of eight recent locations.
export function missingClimateWindow(profile, window) {
  if (!profile || profile.endDate < window.startDate || profile.startDate > window.endDate) return window;
  if (profile.startDate <= window.startDate && profile.endDate < window.endDate)
    return { startDate: iso(stamp(profile.endDate) + DAY), endDate: window.endDate };
  if (profile.endDate >= window.endDate && profile.startDate > window.startDate)
    return { startDate: window.startDate, endDate: iso(stamp(profile.startDate) - DAY) };
  return window;
}
export function mergeClimateWindow(previous, incoming, window) {
  const rows = [];
  for (let t = stamp(window.startDate); t <= stamp(window.endDate); t += DAY) {
    const date = iso(t), profile = hasClimateDate(incoming, date) ? incoming : previous;
    if (!hasClimateDate(profile, date)) throw new Error('Weather cache has a date gap');
    rows.push(profile.rows[(t - stamp(profile.startDate)) / DAY]);
  }
  const merged = { ...incoming, ...window, rows };
  if (!validClimate(merged)) throw new Error('Invalid weather cache window');
  return merged;
}
export function createClimateCache(storage, initial = [], days = 7) {
  const key = 'fly-with-me-weather-v2';
  let entries = initial.filter(validClimate), capacity = validCacheDays(days);
  try {
    const saved = JSON.parse(storage?.getItem(key) ?? 'null');
    if (Array.isArray(saved)) entries = [...entries, ...saved.filter(validClimate)];
    storage?.removeItem('fly-with-me-climate-v1');
  } catch { /* storage is optional */ }
  const cache = new Map(entries.map(entry => [climateKey(entry.latitude, entry.longitude), entry]));
  // Prefer the bundled opening day over a saved window from another date.
  for (const entry of initial.filter(validClimate)) {
    const id = climateKey(entry.latitude, entry.longitude);
    if (!hasClimateDate(cache.get(id), DEFAULT_DATE)) cache.set(id, entry);
  }
  const persist = () => { try { storage?.setItem(key, JSON.stringify([...cache.values()])); } catch { /* flight works without storage */ } };
  function resize(value, date) {
    capacity = validCacheDays(value);
    for (const [id, profile] of cache) cache.set(id, trimClimate(profile, date, capacity));
    while (cache.size > 8) cache.delete(cache.keys().next().value);
    persist();
  }
  resize(capacity, DEFAULT_DATE);
  return {
    get(latitude, longitude) {
      const id = climateKey(latitude, longitude), profile = cache.get(id);
      if (profile) { cache.delete(id); cache.set(id, profile); }
      return profile;
    },
    put(profile, date) {
      if (!validClimate(profile)) throw new Error('Invalid weather cache record');
      const id = climateKey(profile.latitude, profile.longitude);
      cache.delete(id); cache.set(id, trimClimate(profile, date, capacity));
      while (cache.size > 8) cache.delete(cache.keys().next().value);
      persist();
    },
    resize,
  };
}
export async function fetchClimate(latitude, longitude, window, signal, fetcher = fetch) {
  const response = await fetcher(climateURL(latitude, longitude, window), { signal, credentials: 'omit' });
  if (!response.ok) {
    const error = new Error(response.status === 429 ? 'Weather service is busy.' : `Weather service unavailable (${response.status}).`);
    const retry = response.headers?.get('Retry-After');
    error.retryAfter = response.status === 429 ? Math.max(60000, Number.isFinite(Number(retry))
      ? Number(retry) * 1000 : (Date.parse(retry) - Date.now()) || 0) : 15000;
    throw error;
  }
  return parseClimate(await response.json(), latitude, longitude, window);
}
