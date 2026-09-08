// Meeus solar coordinates, as used by NOAA's solar calculator.
// East-positive longitude; azimuth is clockwise from north. UTC milliseconds
// are the only astronomical clock. Civil dates/zones are handled at the edge.
// https://gml.noaa.gov/grad/solcalc/calcdetails.html
export const DAY_MS = 86400000;
export const SUNRISE_ALTITUDE = -0.833; // upper limb, standard refraction, level horizon
const RAD = Math.PI / 180;
const bound = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mod = (v, n) => ((v % n) + n) % n;
const formatters = new Map();
const seasons = new Map();

export function solarCoordinates(utc) {
  const t = (utc / DAY_MS + 2440587.5 - 2451545) / 36525;
  const l = mod(280.46646 + t * (36000.76983 + 0.0003032 * t), 360);
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c = Math.sin(m * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t))
    + Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * t) + Math.sin(3 * m * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const longitude = mod(l + c - 0.00569 - 0.00478 * Math.sin(omega * RAD), 360);
  const obliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
    + 0.00256 * Math.cos(omega * RAD);
  const declination = Math.asin(Math.sin(obliquity * RAD) * Math.sin(longitude * RAD));
  const y = Math.tan(obliquity * RAD / 2) ** 2;
  const equation = 4 / RAD * (y * Math.sin(2 * l * RAD) - 2 * e * Math.sin(m * RAD)
    + 4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l * RAD)
    - 0.5 * y * y * Math.sin(4 * l * RAD) - 1.25 * e * e * Math.sin(2 * m * RAD));
  return { declination, equation, longitude };
}

export function horizontalDirection(latitude, declination, hourAngle, out = {}) {
  const phi = latitude * RAD, cosD = Math.cos(declination), sinD = Math.sin(declination);
  out.x = -cosD * Math.sin(hourAngle); // east
  out.y = Math.sin(phi) * sinD + Math.cos(phi) * cosD * Math.cos(hourAngle);
  out.z = Math.cos(phi) * sinD - Math.sin(phi) * cosD * Math.cos(hourAngle); // north
  return out;
}

export function solarPosition(utc, latitude, longitude, out = {}) {
  const coordinates = solarCoordinates(utc);
  const minutes = mod(utc / 60000, 1440);
  const hourAngle = (mod(minutes + coordinates.equation + 4 * longitude, 1440) / 4 - 180) * RAD;
  horizontalDirection(latitude, coordinates.declination, hourAngle, out);
  out.altitude = Math.asin(bound(out.y, -1, 1)) / RAD;
  out.azimuth = mod(Math.atan2(out.x, out.z) / RAD, 360);
  out.hourAngle = hourAngle;
  out.declination = coordinates.declination;
  return out;
}

export function apparentDirection(position, out) {
  const h = position.altitude, tangent = Math.tan(h * RAD);
  let correction = 0;
  if (h <= 85 && h > 5) correction = (58.1 / tangent - 0.07 / tangent ** 3 + 0.000086 / tangent ** 5) / 3600;
  else if (h <= 5 && h > -0.575) correction = (1735 + h * (-518.2 + h * (103.4 + h * (-12.79 + h * 0.711)))) / 3600;
  else if (h <= -0.575 && h > -5) correction = -20.774 / tangent / 3600;
  // Match the standard 34' horizon refraction used by sunrise/set, keeping
  // the visible upper limb and the event clock on the same horizon.
  const horizonCorrection = 34 / 60 + 20.774 / Math.tan(SUNRISE_ALTITUDE * RAD) / 3600;
  correction += horizonCorrection * Math.exp(-(((h - SUNRISE_ALTITUDE) / 0.55) ** 2));
  const elevation = (h + correction) * RAD, azimuth = position.azimuth * RAD;
  out.x = Math.cos(elevation) * Math.sin(azimuth);
  out.y = Math.sin(elevation);
  out.z = Math.cos(elevation) * Math.cos(azimuth);
  return out;
}

export function validTimeZone(zone) {
  if (typeof zone !== 'string' || zone.length > 100) return null;
  try {
    if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }));
    return zone;
  } catch { return null; }
}

export function civilTime(utc, zone = 'UTC') {
  const formatter = formatters.get(zone) ?? (validTimeZone(zone), formatters.get(zone));
  if (!formatter) throw new Error('Unknown time zone');
  const p = Object.fromEntries(formatter.formatToParts(new Date(utc)).map(part => [part.type, part.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour + +p.minute / 60 + (+p.second + mod(utc, 1000) / 1000) / 3600,
    offset: (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(utc / 1000) * 1000) / 60000 };
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const utc = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(utc) && utc >= Date.UTC(1901, 0, 1) && utc < Date.UTC(2100, 0, 1)
    && new Date(utc).toISOString().slice(0, 10) === value;
}

// Resolve a local clock using the offsets on both sides of a possible DST
// change. Repeated hours select their first occurrence; gaps move forward by
// the gap. The resulting normalized hour is always reflected in the controls.
export function utcForCivilTime(date, hour, zone = 'UTC') {
  const nominal = Date.parse(date + 'T00:00:00Z') + hour * 3600000;
  const offsets = new Set([-36, 0, 36].map(h => civilTime(nominal + h * 3600000, zone).offset));
  const choices = [...offsets].map(offset => {
    const utc = nominal - offset * 60000, local = civilTime(utc, zone);
    return { utc, difference: Date.parse(local.date + 'T00:00:00Z') + local.hour * 3600000 - nominal };
  });
  const exact = choices.filter(choice => Math.abs(choice.difference) < 1000).sort((a, b) => a.utc - b.utc);
  if (exact.length) return exact[0].utc;
  return choices.filter(choice => choice.difference >= 0).sort((a, b) => a.difference - b.difference)[0]?.utc ?? choices[0].utc;
}

// Include refined extrema as brackets, so a very short polar day/night cannot
// fall between coarse samples. Roots are solved on the same ephemeris rendered.
export function horizonCrossings(height, start, end, threshold = 0) {
  const points = Array.from({ length: 49 }, (_, i) => start + (end - start) * i / 48);
  const values = points.map(t => height(t) - threshold);
  for (let i = 1; i < 48; i++) {
    const peak = values[i] > values[i - 1] && values[i] > values[i + 1];
    const trough = values[i] < values[i - 1] && values[i] < values[i + 1];
    if (!peak && !trough) continue;
    let lo = points[i - 1], hi = points[i + 1];
    for (let k = 0; k < 28; k++) {
      const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3;
      if ((height(a) < height(b)) === peak) lo = a; else hi = b;
    }
    points.push((lo + hi) / 2);
  }
  points.sort((a, b) => a - b);
  const events = [];
  for (let i = 1; i < points.length; i++) {
    let lo = points[i - 1], hi = points[i];
    const below = height(lo) < threshold;
    if (below === (height(hi) < threshold)) continue;
    for (let k = 0; k < 28; k++) {
      const mid = (lo + hi) / 2;
      if ((height(mid) < threshold) === below) lo = mid; else hi = mid;
    }
    events.push({ utc: (lo + hi) / 2, rising: below });
  }
  return events;
}

export function solarDay(date, latitude, longitude, zone = 'UTC') {
  const next = new Date(Date.parse(date + 'T00:00:00Z') + DAY_MS).toISOString().slice(0, 10);
  const start = utcForCivilTime(date, 0, zone), end = utcForCivilTime(next, 0, zone);
  if (end <= start) return solarDay(civilTime(start, zone).date, latitude, longitude, zone);
  const position = {}, height = utc => solarPosition(utc, latitude, longitude, position).altitude;
  const events = horizonCrossings(height, start, end, SUNRISE_ALTITUDE);
  let daylight = 0, from = start, up = height(start) >= SUNRISE_ALTITUDE;
  for (const event of events) {
    if (up) daylight += event.utc - from;
    from = event.utc; up = event.rising;
  }
  if (up) daylight += end - from;
  // Equation of time is iterated at transit, rather than assumed to be zero.
  let noon = start + (end - start) / 2;
  for (let i = 0; i < 4; i++) {
    const p = solarPosition(noon, latitude, longitude, position);
    noon -= p.hourAngle / RAD * 240000;
  }
  while (noon < start) noon += DAY_MS;
  while (noon >= end) noon -= DAY_MS;
  return { date, zone, start, end, noon, events, daylight: daylight / 3600000,
    sunrise: events.find(event => event.rising)?.utc ?? null,
    sunset: events.find(event => !event.rising)?.utc ?? null,
    polar: events.length ? null : up ? 'day' : 'night' };
}

export function hourAtPhase(day, phase) {
  return civilTime(day.start + mod(phase, 1) * (day.end - day.start), day.zone).hour;
}

export function phaseAtHour(day, hour) {
  return mod((utcForCivilTime(day.date, mod(hour, 24), day.zone) - day.start) / (day.end - day.start), 1);
}

export function daysInYear(year) { return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS; }

// Astronomical season boundaries from the Sun's apparent ecliptic longitude.
// Their UTC calendar dates anchor the slider; hemisphere swaps spring/autumn.
function seasonDays(year) {
  if (seasons.has(year)) return seasons.get(year);
  const days = [0, 1, 2, 3].map(index => {
    let lo = Date.UTC(year, 2 + index * 3, 15), hi = Date.UTC(year, 2 + index * 3, 27);
    for (let k = 0; k < 35; k++) {
      const mid = (lo + hi) / 2;
      const difference = mod(solarCoordinates(mid).longitude - index * 90 + 180, 360) - 180;
      if (difference < 0) lo = mid; else hi = mid;
    }
    return Math.floor(((lo + hi) / 2 - Date.UTC(year, 0, 1)) / DAY_MS);
  });
  seasons.set(year, days);
  return days;
}

export function dateForSeason(phase, year, latitude) {
  const position = mod(phase, 1) * 4, index = Math.floor(position);
  const days = seasonDays(year), length = daysInYear(year), northIndex = (index + (latitude < 0 ? 2 : 0)) % 4;
  const from = days[northIndex], span = mod(days[(northIndex + 1) % 4] - from, length);
  const day = Math.floor(mod(from + (position - index) * span + 1e-8, length));
  return new Date(Date.UTC(year, 0, 1) + day * DAY_MS).toISOString().slice(0, 10);
}

export function seasonForDate(date, latitude) {
  const year = +date.slice(0, 4), length = daysInYear(year), days = seasonDays(year);
  const day = (Date.parse(date + 'T00:00:00Z') - Date.UTC(year, 0, 1)) / DAY_MS;
  for (let i = 0; i < 4; i++) {
    const distance = mod(day - days[i], length), span = mod(days[(i + 1) % 4] - days[i], length);
    if (distance < span) return mod((i + distance / span) / 4 - (latitude < 0 ? 0.5 : 0), 1);
  }
  return 0;
}

// Keep the month/day when jumping years; leap day clamps to February 28.
export function shiftCalendarYear(date, step) {
  if (!validDate(date) || !Number.isInteger(step)) return date;
  const year = Math.min(2099, Math.max(1901, +date.slice(0, 4) + step));
  const month = +date.slice(5, 7), day = +date.slice(8, 10);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}
