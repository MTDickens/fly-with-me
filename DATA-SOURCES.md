# Geographic data and calculation notes

## World map

`src/world-map-data.js` contains simplified Natural Earth 1:110m land polygons, distributed through [world-atlas 2.0.2](https://github.com/topojson/world-atlas). Source: [land-110m.json](https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json), Natural Earth 4.1.0. TopoJSON arcs were decoded into longitude/latitude rings and rounded to 0.001°. Natural Earth data are [public domain](https://www.naturalearthdata.com/about/terms-of-use/).

The coastline is deliberately coarse. The map uses a rectangular longitude/latitude projection, supports the poles and dateline, and loads no external tiles. It selects a climate location, not real terrain or a precise land-cover survey.

## Climate

Weather data by [Open-Meteo](https://open-meteo.com/), using Copernicus ERA5 reanalysis, under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The application transforms daily data into calendar-day means and sample standard deviations. It is not an official station climate normal or a forecast. API details: [Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api).

`src/climate-default.js` includes Beijing (requested 39.9° N, 116.4° E), aggregated from 1991-01-01 through 2020-12-31, retrieved 2026-09-08. Every requested location uses the same period and ERA5 model. Coordinates identify a coarse model grid cell; they do not imply street-level precision. The response's selected grid coordinates and timezone are retained.

To regenerate a profile, request the URL returned by `climateURL(latitude, longitude)` in `src/climate.js`, pass its JSON to `aggregateClimate(json, latitude, longitude)`, and validate with `validClimate`. The request uses daily minimum, maximum and mean 2 m temperature, precipitation, and FAO reference evapotranspiration, with `models=era5`, `timezone=auto` and `cell_selection=nearest`. Each of 365 rows contains `[low, high, mean, precipitation, ET0, lowSD, highSD, sampleCount]` in °C and mm/day. February 29 is omitted from aggregation and interpolated between adjacent days for display. Missing values are excluded, never treated as zero; at least 20 valid years per calendar day are required.

Vegetation is a heuristic based on annual temperature, coldest/warmest months and precipitation relative to ET0. Daily normals affect seasonal colors and estimated snow line. Species suitability and density are approximations. An uncached, offline location uses a labeled latitude-only estimate, not ERA5 data; longitude-specific climate arrives with a successful download. Only eight validated profiles are retained in browser storage.

## Sun and calendar

`src/astronomy.js` implements Julian-century solar coordinates and equation of time following the Meeus/NOAA approach. Rise/set searches use solar-center altitude −0.833° for a standard unobstructed horizon, including solar radius and conventional refraction. See [NOAA calculation details](https://gml.noaa.gov/grad/solcalc/calcdetails.html). Actual observed times depend on terrain, elevation, atmospheric refraction and weather. Civil dates and daylight-saving offsets use the browser's IANA timezone database; unresolved location timezones use explicitly labeled UTC.

`tests/solar-reference.json` contains independent reference calculations from [Astronomy Engine 2.1.19](https://github.com/cosinekitty/astronomy) (MIT), a development-only reference. The selected 16 fixtures cover both hemispheres, polar regions, DST and dates from 1901–2099. Season boundaries use the sun's apparent ecliptic longitude and switch hemisphere south of the equator. The displayed moon and procedural star field remain artistic.
