import { DAY_SECONDS, YEAR_SECONDS, formatHour, formatSeason } from './cycles.js';
import { createWorldMap } from './world-map.js';
import { LOCATION_PRESETS } from './geography.js';
import { validCoordinates } from './climate.js';

export function createCycleControls({ read, change, commit }) {
  const panel = document.getElementById('cycleControls');
  const time = document.getElementById('timeOfDay');
  const season = document.getElementById('seasonOfYear');
  const daySpeed = document.getElementById('daySpeed');
  const seasonSpeed = document.getElementById('seasonSpeed');
  const dragging = new Set();
  let lastSync = -Infinity;
  const fields = [time, season, daySpeed, seasonSpeed];
  const date = document.getElementById('calendarDate');
  const latitude = document.getElementById('latitudeNumber'), longitude = document.getElementById('longitudeNumber');
  let lastLocation = '';
  const text = (id, value) => {
    const node = document.getElementById(id);
    if (node.textContent !== value) node.textContent = value;
  };
  const applyLocation = ({ latitude: lat, longitude: lon }) => {
    change('location', { latitude: +lat.toFixed(3), longitude: +lon.toFixed(3) });
    sync(true); commit();
  };
  const map = createWorldMap(document.getElementById('worldMap'), applyLocation);
  document.getElementById('mapZoomIn').addEventListener('click', () => map.zoom(1.5));
  document.getElementById('mapZoomOut').addEventListener('click', () => map.zoom(1 / 1.5));
  document.getElementById('mapReset').addEventListener('click', map.reset);
  const locationPreset = document.getElementById('locationPreset');
  LOCATION_PRESETS.forEach((preset, index) => {
    const option = document.createElement('option'); option.value = String(index); option.textContent = preset.name;
    locationPreset.append(option);
  });
  locationPreset.addEventListener('change', () => {
    const preset = LOCATION_PRESETS[Number(locationPreset.value)];
    if (preset) { applyLocation(preset); map.select(preset.latitude, preset.longitude, true); }
  });
  for (const [number, id] of [[latitude, 'latitude'], [longitude, 'longitude']]) {
    const range = document.getElementById(id);
    range.addEventListener('input', () => { number.value = range.value; previewPin(); });
    number.addEventListener('input', () => {
      if (number.value && number.validity.valid) { range.value = number.value; previewPin(); }
    });
  }
  function previewPin() {
    if (latitude.value && longitude.value && validCoordinates(+latitude.value, +longitude.value)) map.select(+latitude.value, +longitude.value);
  }
  document.getElementById('locationForm').addEventListener('submit', event => {
    event.preventDefault();
    if (latitude.reportValidity() && longitude.reportValidity() && latitude.value && longitude.value)
      applyLocation({ latitude: +latitude.value, longitude: +longitude.value });
  });
  document.getElementById('retryClimate').addEventListener('click', () => change('retryClimate'));
  date.addEventListener('change', () => { if (date.validity.valid) { change('date', date.value); sync(true); commit(); } });
  document.getElementById('timezoneMode').addEventListener('change', event => { change('timezoneMode', event.target.value); sync(true); commit(); });
  for (const button of panel.querySelectorAll('[data-time-preset]')) {
    button.addEventListener('click', () => { change('timePreset', button.dataset.timePreset); sync(true); commit(); });
  }
  const speedText = (speed, period, unit) => {
    if (speed === 0) return 'Frozen';
    const duration = period / speed;
    const label = duration >= 60 ? `${+(duration / 60).toFixed(1)} min` : `${+duration.toFixed(1)} sec`;
    return `${speed}× · ${unit} in ${label}`;
  };
  function sync(force = false) {
    if (!force && (!panel.open || performance.now() - lastSync < 100)) return;
    lastSync = performance.now();
    const values = read();
    for (const field of fields) {
      if (!dragging.has(field)) field.value = String(values[field.id]);
    }
    const hour = formatHour(values.timeOfDay);
    const seasonName = formatSeason(values.seasonOfYear / 4);
    document.getElementById('timeValue').value = hour;
    document.getElementById('seasonValue').value = seasonName;
    time.setAttribute('aria-valuetext', hour);
    season.setAttribute('aria-valuetext', seasonName);
    if (document.activeElement !== date) date.value = values.date;
    document.getElementById('timezoneMode').value = values.timezoneMode;
    text('timezoneValue', values.timezone);
    text('sunriseValue', values.sunrise);
    text('sunsetValue', values.sunset);
    text('daylightValue', values.daylight);
    text('climateStatus', values.climateStatus);
    text('temperatureValue', values.temperature);
    text('precipitationValue', values.precipitation);
    text('vegetationValue', values.vegetation);
    text('climateVariation', values.variation);
    text('hemisphereValue', values.hemisphere);
    document.getElementById('retryClimate').hidden = !values.canRetryClimate;
    for (const button of panel.querySelectorAll('[data-time-preset]')) {
      button.disabled = values.timePresets[button.dataset.timePreset] === null;
    }
    const location = `${values.latitude}/${values.longitude}`;
    if (location !== lastLocation) {
      lastLocation = location;
      latitude.value = String(values.latitude); longitude.value = String(values.longitude);
      document.getElementById('latitude').value = latitude.value;
      document.getElementById('longitude').value = longitude.value;
      map.select(values.latitude, values.longitude);
      const preset = LOCATION_PRESETS.findIndex(p => Math.abs(p.latitude - values.latitude) < 0.0005 && Math.abs(p.longitude - values.longitude) < 0.0005);
      locationPreset.value = preset < 0 ? '' : String(preset);
    }
    for (const [field, period, unit] of [[daySpeed, DAY_SECONDS, 'day'], [seasonSpeed, YEAR_SECONDS, 'year']]) {
      const text = speedText(values[field.id], period, unit);
      document.getElementById(`${field.id}Value`).value = text;
      field.setAttribute('aria-valuetext', text);
      const select = document.getElementById(`${field.id}Preset`);
      const preset = [...select.options].some((option) => option.value === String(values[field.id]))
        ? String(values[field.id]) : '';
      if (select.value !== preset) select.value = preset;
    }
  }
  for (const field of fields) {
    field.addEventListener('pointerdown', () => dragging.add(field));
    field.addEventListener('input', () => { change(field.id, Number(field.value)); sync(true); });
    field.addEventListener('change', commit);
  }
  const release = () => { if (dragging.size) { dragging.clear(); sync(true); } };
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);
  for (const button of panel.querySelectorAll('[data-cycle]')) {
    button.addEventListener('click', () => {
      change(button.dataset.cycle, Number(button.dataset.value));
      sync(true);
      commit();
    });
  }
  for (const field of [daySpeed, seasonSpeed]) {
    document.getElementById(`${field.id}Preset`).addEventListener('change', (event) => {
      change(field.id, Number(event.target.value));
      sync(true);
      commit();
    });
  }
  panel.addEventListener('toggle', () => { sync(true); map.redraw(); });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      panel.open = false;
      panel.querySelector('summary').focus();
    }
  });
  return { sync, dispose: () => {
    map.dispose(); document.removeEventListener('pointerup', release);
    document.removeEventListener('pointercancel', release); window.removeEventListener('blur', release);
  } };
}
