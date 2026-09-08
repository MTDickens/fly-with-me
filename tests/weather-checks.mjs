import assert from 'node:assert/strict';
import { shiftCalendarYear, dateForSeason, seasonForDate } from '../src/astronomy.js';
import { CACHE_DAY_OPTIONS, CLIMATE_FIELDS, DEFAULT_DATE, climateOnDate, climateURL, createClimateCache, fetchClimate,
  hasClimateDate, mergeClimateWindow, missingClimateWindow, parseClimate, validClimate, weatherWindow } from '../src/climate.js';
import { DEFAULT_CLIMATE } from '../src/climate-default.js';
import { createGeography } from '../src/geography.js';
const DAY = 86400000, tick = () => new Promise(resolve => setTimeout(resolve, 10));
const today = Date.UTC(2026, 8, 8);
const makeStorage = () => ({ data: new Map(), getItem(key) { return this.data.get(key) ?? null; },
  setItem(key, value) { this.data.set(key, value); }, removeItem(key) { this.data.delete(key); } });
function rawWindow(start, end) {
  const time = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += DAY) time.push(new Date(t).toISOString().slice(0, 10));
  const daily = { time };
  // Deliberately different daily values, so selecting the wrong row is visible.
  CLIMATE_FIELDS.forEach((key, column) => { daily[key] = time.map(date => {
    const d = Number(date.slice(8)); return [d, d + 10, d + 5, d / 10, 2][column];
  }); });
  return { latitude: 0, longitude: 0, timezone: 'UTC', elevation: 0,
    daily_units: Object.fromEntries(CLIMATE_FIELDS.map((key, i) => [key, i < 3 ? '°C' : 'mm'])), daily };
}
function responseFor(url) {
  const q = new URL(url).searchParams;
  return { ok: true, json: async () => rawWindow(q.get('start_date'), q.get('end_date')) };
}
function requestRange(url) {
  const q = new URL(url).searchParams;
  return [q.get('start_date'), q.get('end_date')];
}
assert.equal(DEFAULT_DATE, '2004-08-21');
assert.deepEqual(weatherWindow(DEFAULT_DATE), { startDate: '2004-08-14', endDate: '2004-08-28' });
for (const radius of CACHE_DAY_OPTIONS) {
  const window = weatherWindow(DEFAULT_DATE, radius, today);
  assert.equal((Date.parse(window.endDate) - Date.parse(window.startDate)) / DAY + 1, 2 * radius + 1);
}
assert.deepEqual(weatherWindow('2004-02-29', 3), { startDate: '2004-02-26', endDate: '2004-03-03' });
assert.deepEqual(weatherWindow('2004-01-01', 7), { startDate: '2003-12-25', endDate: '2004-01-08' });
assert.equal(weatherWindow('1939-12-31'), null);
assert.equal(weatherWindow('2026-09-04', 7, today), null);
assert.equal(weatherWindow('2026-09-03', 7, today).endDate, '2026-09-03');
assert.equal(weatherWindow('2004-02-30'), null);
assert.equal(weatherWindow('1940-01-01').startDate, '1940-01-01');
assert.throws(() => climateURL(0, 0, { startDate: '1991-01-01', endDate: '2020-12-31' }), /61/);
assert.throws(() => climateURL(91, 0, weatherWindow(DEFAULT_DATE)));
const leapWindow = weatherWindow('2004-02-29', 3);
const raw = rawWindow(leapWindow.startDate, leapWindow.endDate);
const leapProfile = parseClimate(raw, 0, 0, leapWindow);
assert.ok(validClimate(leapProfile));
assert.equal(climateOnDate(leapProfile, '2004-02-29').low, 29, 'use the actual leap-day record');
assert.equal(climateOnDate(leapProfile, '2005-02-28').source, 'estimate');
assert.equal(hasClimateDate(leapProfile, '2004-02-30'), false);
const invalid = structuredClone(raw); invalid.daily.temperature_2m_min[0] = null;
assert.throws(() => parseClimate(invalid, 0, 0, leapWindow), /invalid/);
const wrongDate = structuredClone(raw); wrongDate.daily.time[0] = '2003-02-26';
assert.throws(() => parseClimate(wrongDate, 0, 0, leapWindow), /dates/);
const wrongUnits = structuredClone(raw); wrongUnits.daily_units.precipitation_sum = 'inch';
assert.throws(() => parseClimate(wrongUnits, 0, 0, leapWindow), /units/);
for (const [date, step, expected] of [['2004-02-29', 1, '2005-02-28'], ['2004-02-29', -1, '2003-02-28'],
  ['2003-08-21', 1, DEFAULT_DATE], ['1901-08-21', -1, '1901-08-21'], ['2099-08-21', 1, '2099-08-21']])
  assert.equal(shiftCalendarYear(date, step), expected);
for (const year of [2004, 2005]) for (const latitude of [-33.87, 39.9]) {
  for (let bar = 0; bar <= 4; bar += 0.01) assert.ok(dateForSeason(bar / 4, year, latitude).startsWith(String(year)));
  const date = `${year}-08-21`;
  assert.equal(dateForSeason(seasonForDate(date, latitude), year, latitude), date);
}
// Saved data from old versions are not interpreted as selected-day weather.
const storage = makeStorage(); storage.setItem('fly-with-me-climate-v1', '[{"version":1}]');
const cache = createClimateCache(storage, [DEFAULT_CLIMATE]);
assert.equal(storage.getItem('fly-with-me-climate-v1'), null);
assert.deepEqual(createClimateCache(storage).get(39.9, 116.4), DEFAULT_CLIMATE);
cache.resize(0, DEFAULT_DATE);
assert.equal(cache.get(39.9, 116.4).rows.length, 1);
assert.equal(cache.get(39.9, 116.4).startDate, DEFAULT_DATE);
for (let latitude = 0; latitude < 12; latitude++) cache.put({ ...DEFAULT_CLIMATE, latitude }, DEFAULT_DATE);
const saved = JSON.parse(storage.getItem('fly-with-me-weather-v2'));
assert.equal(saved.length, 8); assert.ok(saved.every(profile => profile.rows.length === 1));
const otherDateStorage = makeStorage();
const otherWindow = weatherWindow('2005-08-21');
otherDateStorage.setItem('fly-with-me-weather-v2', JSON.stringify([parseClimate(rawWindow(otherWindow.startDate, otherWindow.endDate), 39.9, 116.4, otherWindow)]));
assert.ok(hasClimateDate(createClimateCache(otherDateStorage, [DEFAULT_CLIMATE]).get(39.9, 116.4), DEFAULT_DATE), 'bundled opening date beats an old saved window');
assert.equal(createClimateCache({ getItem: () => '{bad', setItem() {} }).get(39.9, 116.4), undefined);
assert.doesNotThrow(() => createClimateCache({ getItem() { throw Error(); }, setItem() { throw Error(); } }, [DEFAULT_CLIMATE]));
// Extending past either edge reuses the overlapping dates.
for (const date of ['2004-08-29', '2004-08-13']) {
  const window = weatherWindow(date), missing = missingClimateWindow(DEFAULT_CLIMATE, window);
  assert.equal((Date.parse(missing.endDate) - Date.parse(missing.startDate)) / DAY + 1, 8);
  const incoming = parseClimate(rawWindow(missing.startDate, missing.endDate), 39.9, 116.4, missing);
  const merged = mergeClimateWindow(DEFAULT_CLIMATE, incoming, window);
  assert.equal(merged.rows.length, 15); assert.ok(hasClimateDate(merged, date));
  const overlap = date === '2004-08-29' ? '2004-08-22' : '2004-08-20';
  assert.deepEqual(climateOnDate(merged, overlap), climateOnDate(DEFAULT_CLIMATE, overlap));
}
const calls = [], fast = { interval: 0, debounce: 0, now: () => today };
const geo = createGeography({}, undefined, async url => { calls.push(url); return responseFor(url); }, fast);
geo.load(0); await tick(); assert.equal(calls.length, 0, 'bundled default needs no weather request');
for (const date of ['2004-08-14', DEFAULT_DATE, '2004-08-28']) geo.setDate(date);
await tick(); assert.equal(calls.length, 0, 'cached dates require no request');
assert.equal(climateOnDate(geo.profile, '2004-08-28').low, 17.5);
const ecology = geo.ecology;
geo.setDate('2004-08-29'); await tick();
assert.deepEqual(requestRange(calls[0]), ['2004-08-29', '2004-09-05']);
assert.equal(geo.ecology, ecology, 'date changes preserve the location species mix');
assert.equal(climateOnDate(geo.profile, '2004-08-29').low, 29);
geo.setCacheDays(0); assert.equal(geo.profile.rows.length, 1);
geo.setDate('2004-09-07'); await tick();
assert.deepEqual(requestRange(calls[1]), ['2004-09-07', '2004-09-07']);
geo.setDate('1930-08-21'); await tick(); assert.equal(calls.length, 2);
geo.dispose();
// Quick scrubbing coalesces to the final date before the request starts.
const scrubCalls = [];
const scrub = createGeography({}, undefined, async url => { scrubCalls.push(url); return responseFor(url); }, fast);
for (const date of ['2004-12-01', '2005-01-01', '2006-07-04']) scrub.setDate(date);
await tick(); assert.equal(scrubCalls.length, 1);
assert.deepEqual(requestRange(scrubCalls[0]), ['2006-06-27', '2006-07-11']); scrub.dispose();
// Deliberately resolve an aborted location request, and an obsolete date request.
const pending = [];
const race = createGeography({}, undefined, (url, options) => new Promise(resolve => pending.push({ url, options, resolve })), fast);
race.setLocation(10, 20); await tick(); race.setLocation(-10, 30); await tick();
assert.ok(pending[0].options.signal.aborted);
pending[0].resolve(responseFor(pending[0].url)); await tick();
assert.equal(race.profile.source, 'estimate');
pending[1].resolve(responseFor(pending[1].url)); await tick();
assert.equal(race.profile.latitude, -10); assert.ok(hasClimateDate(race.profile, DEFAULT_DATE));
race.setDate('2004-12-01'); await tick(); race.setDate(DEFAULT_DATE);
assert.equal(pending[2].options.signal.aborted, false, 'date scrubbing keeps the paid-for request alive');
pending[2].resolve(responseFor(pending[2].url)); await tick();
assert.ok(hasClimateDate(race.profile, DEFAULT_DATE), 'returning to cached date preserves its data');
assert.equal(pending.length, 3, 'no extra request when returning to cached date'); race.dispose();
// A 429 cools down across dates and locations; manually retrying cannot bypass it.
let clock = today, attempts = 0;
const busy = createGeography({}, undefined, async () => {
  attempts++; return { ok: false, status: 429, headers: { get: () => '120' } };
}, { interval: 0, debounce: 0, now: () => clock });
busy.setLocation(10, 20); await tick();
assert.equal(attempts, 1); assert.equal(busy.retryAt, clock + 120000);
busy.load(0); busy.setDate('2005-01-01'); busy.setLocation(20, 20); await tick();
assert.equal(attempts, 1);
clock += 120001; busy.load(0); await tick(); assert.equal(attempts, 2); busy.dispose();
let requests = 0;
const throttled = createGeography({}, undefined, async url => { requests++; return responseFor(url); }, { debounce: 0, interval: 1000 });
throttled.setLocation(5, 5); await tick();
throttled.setDate('2005-01-01'); await tick();
assert.equal(requests, 1, 'rapid date changes respect the request spacing'); throttled.dispose();
await assert.rejects(fetchClimate(0, 0, leapWindow, undefined, async () => ({ ok: false, status: 503 })), /503/);
console.log('Weather checks passed: bounded windows, exact historical/leap dates, cache sizes/overlap, year jumps, no bulk requests, coalescing, stale responses, stable species, quota cooldown and request spacing.');
