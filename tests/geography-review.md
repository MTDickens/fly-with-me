# Geography update verification — 2026-09-08

Verified locally:

- `node tests/geography-checks.mjs`: 16 independent Astronomy Engine solar fixtures, maximum rise/set difference 19.08 seconds; poles, grazing events, daylight-saving changes, leap days, calendar/season mapping and estimated ecology.
- `node tests/weather-checks.mjs`: exact selected-day and leap-day records, default ±7-day limits, all cache sizes, overlap reuse, old-cache migration, rapid scrubbing, stale response rejection, year navigation, stable species, quota cooldown and request spacing.
- `node tests/offline-checks.mjs`: offline navigation and pinned Three.js resources under a project subpath, quota failures, readiness reporting and climate isolation.
- `node tests/cycle-checks.mjs` and `node tests/galaxy-checks.mjs`: passed.
- Complete generated bundle initialized in JSDOM using real Three.js geometry and canvas drawing, with the GPU renderer and render pipeline mocked. Exercised tree removal at the pole, the bundled 15-day Beijing history, opening date 2004-08-21 with old saves, cache resizing, calendar/year button and season synchronization, preserved dates across hemispheres, independent/frozen clocks, solar presets, sliders, map zoom/click and drag without selection. The rendered 2D map was inspected.
- Seasonal foliage, grass, ground and snow expressions generated GLSL and WGSL with the pinned Three.js source builders. This checks shader construction, not GPU execution.
- Source syntax/undefined-name checks and `node tools/bundle.mjs --check`: passed, including worker and data-credit copies.

Still requires a real browser/device: the flight/night/cycle pixel-check matrix in `CONTRIBUTING.md`, visual comparison at matching locations/dates, native touch/pinch and a real disconnected reload. This environment did not provide a usable GPU/browser preview, so no visual parity or device-performance claim is made. The browser checks were updated where the former shortened-night clock conflicts with the requested geographic solar clock.
