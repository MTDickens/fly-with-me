import assert from 'node:assert/strict';
import { DAY_SECONDS, YEAR_SECONDS, advancePhase, formatHour, formatSeason, phaseForHour, seasonWeights, validCycleSpeed, wrapPhase } from '../src/cycles.js';

const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
let day = 0.93, season = 0.98;
for (let i = 0; i < 2400; i++) {
  day = advancePhase(day, 0.025, 4, DAY_SECONDS);
  season = advancePhase(season, 0.025, 12, YEAR_SECONDS);
}
close(day, 0.33);
close(season, 0.28);
close(advancePhase(0.4, 60, 0, DAY_SECONDS), 0.4);
close(advancePhase(0.4, 0, 60, DAY_SECONDS), 0.4);
close(advancePhase(0.4, NaN, 1, DAY_SECONDS), 0.4);
close(advancePhase(0.4, 60000, 60, DAY_SECONDS), 0.4);
close(advancePhase(0.7, 1, 4, DAY_SECONDS), 0.7 + 4 / 600);
close(advancePhase(0.7, 1, 12, DAY_SECONDS), 0.72);
assert.equal(validCycleSpeed(0), 0);
assert.equal(validCycleSpeed(60), 60);
for (const invalid of [-1, 61, Infinity, NaN, null, '4']) assert.equal(validCycleSpeed(invalid), 1);
for (let i = 0; i <= 1000; i++) {
  const weights = seasonWeights(i / 1000);
  close(weights.reduce((a, b) => a + b), 1);
  assert.ok(weights.every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
  assert.ok(weights.filter((v) => v > 0).length <= 2);
}
for (let i = 0; i < 4; i++) assert.equal(seasonWeights(i / 4)[i], 1);
assert.deepEqual(seasonWeights(0), seasonWeights(1));
assert.deepEqual(seasonWeights(-0.25), seasonWeights(0.75));
assert.ok(seasonWeights(1 - 1e-7)[0] > 0.999999);
assert.ok(seasonWeights(1 + 1e-7)[0] > 0.999999);
assert.equal(formatHour(24), '00:00');
assert.equal(formatHour(18.5), '18:30');
assert.equal(formatSeason(0.75), 'Winter');
assert.equal(formatSeason(0.875), 'Winter → Spring · 50%');
// Exercise inversion on a monotonic nonlinear clock as well as a linear one.
for (const solar of [(x) => x, (x) => x * x]) {
  for (const hour of [0, 3, 6, 12, 18, 23.999, 24]) close(solar(phaseForHour(hour, solar)), wrapPhase(hour / 24));
}
console.log('Cycle checks passed: independent rates, freeze, large wraps, validation, solar inversion and continuous seasons.');
