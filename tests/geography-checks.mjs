import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { apparentDirection, civilTime, dateForSeason, horizonCrossings, hourAtPhase, phaseAtHour, seasonForDate, solarDay, solarPosition, validDate } from '../src/astronomy.js';
import { climateEcology, climateOnDate, estimateClimate, geographicClimate, speciesSuitability, validClimate, validCoordinates } from '../src/climate.js';
import { DEFAULT_CLIMATE } from '../src/climate-default.js';
import { WORLD_LAND } from '../src/world-map-data.js';
import { wrapLongitude } from '../src/world-map.js';
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);

// Fixtures come from an independent VSOP87-based implementation, not from the
// implementation under test. Standard horizon differences are allowed 60 s.
const { fixtures } = JSON.parse(await readFile(new URL('./solar-reference.json', import.meta.url)));
let largestDifference = 0;
for (const fixture of fixtures) {
  const day = solarDay(fixture.date, fixture.latitude, fixture.longitude, fixture.zone);
  for (const event of ['sunrise', 'sunset']) {
    if (fixture[event] === null) { assert.equal(day[event], null); continue; }
    const difference = Math.abs(day[event] - Date.parse(fixture[event])) / 1000;
    largestDifference = Math.max(largestDifference, difference);
    assert.ok(difference < (Math.abs(fixture.latitude) > 72 ? 600 : 60), `${fixture.date} ${fixture.latitude} ${event}: ${difference}s`);
    close(solarPosition(day[event], fixture.latitude, fixture.longitude).altitude, -0.833, 0.00001);
  }
  assert.ok(Number.isFinite(day.daylight) && day.daylight >= 0 && day.daylight <= (day.end - day.start) / 3600000);
}
const northSummer = solarDay('2026-06-21', 39.9, 116.4, 'Asia/Shanghai');
const northWinter = solarDay('2026-12-21', 39.9, 116.4, 'Asia/Shanghai');
const southSummer = solarDay('2026-12-21', -33.87, 151.21, 'Australia/Sydney');
const southWinter = solarDay('2026-06-21', -33.87, 151.21, 'Australia/Sydney');
assert.ok(northSummer.daylight > northWinter.daylight + 5);
assert.ok(southSummer.daylight > southWinter.daylight + 4);
for (const latitude of [-90, 90]) {
  const summer = solarDay(latitude > 0 ? '2026-06-21' : '2026-12-21', latitude, 0);
  const winter = solarDay(latitude > 0 ? '2026-12-21' : '2026-06-21', latitude, 0);
  assert.equal(summer.polar, 'day'); assert.equal(winter.polar, 'night');
  assert.equal(summer.daylight, 24); assert.equal(winter.daylight, 0);
}
const east = solarPosition(Date.parse('2026-03-20T06:00:00Z'), 0, 90);
const west = solarPosition(Date.parse('2026-03-20T06:00:00Z'), 0, -90);
assert.ok(east.altitude > 80 && west.altitude < -80, 'longitude rotates the sky');
const limb = apparentDirection({ altitude: -0.833, azimuth: 90 }, {});
close(Math.asin(limb.y) * 180 / Math.PI + 0.2663333333, 0, 0.001);
// Even a sub-minute grazing day must be detected between ordinary samples.
const grazing = horizonCrossings(t => 100 - (t - 50123) ** 2, 0, 100000);
assert.equal(grazing.length, 2); close(grazing[1].utc - grazing[0].utc, 20, 0.01);

const springDST = solarDay('2026-03-08', 40.71, -74.01, 'America/New_York');
const autumnDST = solarDay('2026-11-01', 40.71, -74.01, 'America/New_York');
assert.equal((springDST.end - springDST.start) / 3600000, 23);
assert.equal((autumnDST.end - autumnDST.start) / 3600000, 25);
close(hourAtPhase(springDST, phaseAtHour(springDST, 2.5)), 3.5);
const repeated = autumnDST.start + phaseAtHour(autumnDST, 1.5) * (autumnDST.end - autumnDST.start);
assert.equal(civilTime(repeated, autumnDST.zone).offset, -240, 'first repeated hour is selected');
close(hourAtPhase(northSummer, phaseAtHour(northSummer, 15.123456)), 15.123456, 1e-6);
assert.equal(solarDay('2011-12-30', -13.83, -171.75, 'Pacific/Apia').date, '2011-12-31');
assert.equal(validDate('2024-02-29'), true); assert.equal(validDate('2026-02-29'), false);
for (const year of [1901, 2024, 2026, 2099]) {
  for (const latitude of [-33, 0, 39.9]) {
    for (let utc = Date.UTC(year, 0, 1); utc < Date.UTC(year + 1, 0, 1); utc += 86400000) {
      const date = new Date(utc).toISOString().slice(0, 10);
      assert.equal(dateForSeason(seasonForDate(date, latitude), year, latitude), date);
    }
  }
}
assert.equal(dateForSeason(0.25, 2026, -33), '2026-12-21');

assert.ok(validClimate(DEFAULT_CLIMATE));
assert.equal(DEFAULT_CLIMATE.rows.length, 15);
const beijing = climateEcology(DEFAULT_CLIMATE);
assert.equal(climateOnDate(DEFAULT_CLIMATE, '2004-08-21').low, 21.3);
assert.equal(climateOnDate(DEFAULT_CLIMATE, '2004-08-21').high, 27.8);
assert.equal(climateOnDate(DEFAULT_CLIMATE, '2004-08-21').rain, 0.1);
assert.equal(climateOnDate(DEFAULT_CLIMATE, '2026-08-21').source, 'estimate', 'never reuse another year as actual weather');
assert.equal(speciesSuitability('palm', beijing), 0);
assert.equal(speciesSuitability('acacia', beijing), 0);
assert.equal(climateEcology(estimateClimate(90, 0)).treeCover, 0);
assert.ok(climateEcology(estimateClimate(0, 100)).treeCover > 0.9);
assert.notDeepEqual(geographicClimate(0.5, 0.5, beijing), geographicClimate(0.5, 0.5, climateEcology(estimateClimate(0, 100))));

assert.ok(WORLD_LAND.length > 100);
for (const polygon of WORLD_LAND) for (const ring of polygon) for (const [longitude, latitude] of ring)
  assert.ok(validCoordinates(latitude, longitude));
assert.equal(wrapLongitude(181), -179); assert.equal(wrapLongitude(-181), 179);
console.log(`Geography checks passed: ${fixtures.length} independent solar fixtures (max difference ${largestDifference.toFixed(2)}s), polar/grazing events, DST, leap years, historical weather, ecology and map coordinates.`);
