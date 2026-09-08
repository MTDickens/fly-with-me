// Daily climate normals, not a forecast. Temperatures are °C; water is mm.
// ERA5 is selected explicitly so the 1991–2020 series does not mix models.
export const CLIMATE_PERIOD = '1991–2020';
export const CLIMATE_FIELDS = ['temperature_2m_min', 'temperature_2m_max', 'temperature_2m_mean', 'precipitation_sum', 'et0_fao_evapotranspiration'];
const DAY = 86400000;
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mean = values => values.reduce((sum, v) => sum + v, 0) / values.length;

export function climateKey(latitude, longitude) { return `${latitude.toFixed(3)},${longitude.toFixed(3)}`; }
export function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}
export function climateURL(latitude, longitude) {
  if (!validCoordinates(latitude, longitude)) throw new Error('Coordinates are outside the world');
  const query = new URLSearchParams({ latitude, longitude, start_date: '1991-01-01', end_date: '2020-12-31',
    daily: CLIMATE_FIELDS.join(','), timezone: 'auto', models: 'era5', cell_selection: 'nearest' });
  return `https://archive-api.open-meteo.com/v1/archive?${query}`;
}

export function calendarIndex(date) {
  const monthDay = date.slice(5);
  if (monthDay === '02-29') return 58.5;
  return (Date.parse(`2001-${monthDay}T00:00:00Z`) - Date.UTC(2001, 0, 1)) / DAY;
}

export function aggregateClimate(payload, latitude, longitude, minimumSamples = 20) {
  const daily = payload.daily;
  if (!daily || !Array.isArray(daily.time) || CLIMATE_FIELDS.some(key => !Array.isArray(daily[key]) || daily[key].length !== daily.time.length))
    throw new Error('Incomplete daily climate data');
  if (CLIMATE_FIELDS.slice(0, 3).some(key => payload.daily_units?.[key] !== '°C')
    || CLIMATE_FIELDS.slice(3).some(key => payload.daily_units?.[key] !== 'mm')) throw new Error('Unexpected climate units');
  const buckets = Array.from({ length: 365 }, () => []), seen = new Set();
  for (let i = 0; i < daily.time.length; i++) {
    const date = daily.time[i], year = +date.slice(0, 4), index = calendarIndex(date);
    if (seen.has(date) || year < 1991 || year > 2020 || !Number.isInteger(index) || index < 0 || index >= 365) continue;
    seen.add(date);
    const values = CLIMATE_FIELDS.map(key => daily[key][i]);
    if (!values.every(value => typeof value === 'number' && Number.isFinite(value))
      || values[0] > values[1] || values[2] < values[0] - 0.2 || values[2] > values[1] + 0.2
      || values[0] < -100 || values[1] > 70 || values[3] < 0 || values[4] < 0) continue;
    buckets[index].push(values);
  }
  if (buckets.some(bucket => bucket.length < minimumSamples)) throw new Error('Too few valid years for a daily climate normal');
  // Each compact row: low, high, mean, precipitation, ET0, low σ, high σ, n.
  const rows = buckets.map(bucket => {
    const averages = CLIMATE_FIELDS.map((_, j) => mean(bucket.map(row => row[j])));
    const deviation = j => Math.sqrt(bucket.reduce((sum, row) => sum + (row[j] - averages[j]) ** 2, 0) / Math.max(1, bucket.length - 1));
    return [...averages, deviation(0), deviation(1)].map(value => +value.toFixed(3)).concat(bucket.length);
  });
  return { version: 1, source: 'ERA5', period: CLIMATE_PERIOD, latitude, longitude,
    gridLatitude: payload.latitude, gridLongitude: payload.longitude, elevation: payload.elevation,
    timezone: payload.timezone, rows };
}

export function validClimate(profile) {
  return profile?.version === 1 && profile.source === 'ERA5' && profile.period === CLIMATE_PERIOD
    && validCoordinates(profile.latitude, profile.longitude) && typeof profile.timezone === 'string'
    && Array.isArray(profile.rows) && profile.rows.length === 365
    && profile.rows.every(row => Array.isArray(row) && row.length === 8 && row.every(Number.isFinite)
      && row[0] >= -100 && row[1] <= 70 && row[0] <= row[1] && row[3] >= 0 && row[4] >= 0
      && row[2] >= row[0] - 0.2 && row[2] <= row[1] + 0.2
      && row[5] >= 0 && row[6] >= 0 && row[7] >= 20 && row[7] <= 30);
}

export function climateOnDate(profile, date) {
  const index = calendarIndex(date), lo = Math.floor(index), blend = index - lo;
  const a = profile.rows[lo], b = profile.rows[(lo + 1) % 365];
  const row = a.map((value, i) => value * (1 - blend) + b[i] * blend);
  return { low: row[0], high: row[1], mean: row[2], rain: row[3], evapotranspiration: row[4],
    lowDeviation: row[5], highDeviation: row[6], samples: row[7] };
}

// A deliberately coarse latitude-only fallback, visibly labelled Estimated.
// It is replaced by the selected coordinate's cached/online ERA5 record. It
// must never inherit a different location's temperatures or claim observations.
export function estimateClimate(latitude, longitude) {
  const absolute = Math.abs(latitude), radians = absolute * Math.PI / 180;
  const average = 28 - 48 * Math.sin(radians) ** 1.5;
  const amplitude = 2 + 19 * Math.sin(radians);
  const precipitation = 250 + 2100 * Math.exp(-((absolute / 13) ** 2)) + 650 * Math.exp(-(((absolute - 50) / 15) ** 2));
  const rows = Array.from({ length: 365 }, (_, day) => {
    const warm = Math.cos((day - (latitude < 0 ? 20 : 202)) / 365 * Math.PI * 2);
    const temperature = average + amplitude * warm;
    return [temperature - 5, temperature + 5, temperature, precipitation / 365,
      Math.max(0.2, (temperature + 8) * 0.13), 0, 0, 0];
  });
  return { version: 1, source: 'estimate', period: null, latitude, longitude, timezone: 'UTC', elevation: 0, rows };
}

export function climateEcology(profile) {
  const rows = profile.rows, monthly = Array.from({ length: 12 }, () => []);
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
    temperature: clamp01((annualTemperature + 15) / 50),
    moisture: clamp01(0.1 + 0.52 * Math.log1p(aridity) / Math.LN2),
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

export function createClimateCache(storage, initial = []) {
  const key = 'fly-with-me-climate-v1';
  let entries = initial.filter(validClimate);
  try {
    const saved = JSON.parse(storage?.getItem(key) ?? 'null');
    if (Array.isArray(saved)) entries = [...entries, ...saved.filter(validClimate)];
  } catch { /* storage is optional */ }
  const cache = new Map(entries.map(entry => [climateKey(entry.latitude, entry.longitude), entry]));
  while (cache.size > 8) cache.delete(cache.keys().next().value);
  return {
    get(latitude, longitude) { return cache.get(climateKey(latitude, longitude)); },
    put(profile) {
      if (!validClimate(profile)) throw new Error('Invalid climate cache record');
      const id = climateKey(profile.latitude, profile.longitude);
      cache.delete(id); cache.set(id, profile);
      while (cache.size > 8) cache.delete(cache.keys().next().value);
      try { storage?.setItem(key, JSON.stringify([...cache.values()])); } catch { /* a full cache cannot stop flight */ }
    },
  };
}

export function fetchClimate(latitude, longitude, signal, fetcher = fetch) {
  return fetcher(climateURL(latitude, longitude), { signal, credentials: 'omit' }).then(async response => {
    if (!response.ok) throw new Error(response.status === 429 ? 'Climate service is busy; try again later.' : `Climate service unavailable (${response.status}).`);
    return aggregateClimate(await response.json(), latitude, longitude);
  });
}
