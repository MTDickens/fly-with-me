import { DAY_SECONDS, YEAR_SECONDS, formatHour, formatSeason } from './cycles.js';

export function createCycleControls({ read, change, commit }) {
  const panel = document.getElementById('cycleControls');
  const time = document.getElementById('timeOfDay');
  const season = document.getElementById('seasonOfYear');
  const daySpeed = document.getElementById('daySpeed');
  const seasonSpeed = document.getElementById('seasonSpeed');
  const dragging = new Set();
  let lastSync = -Infinity;
  const fields = [time, season, daySpeed, seasonSpeed];
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
  panel.addEventListener('toggle', () => sync(true));
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      panel.open = false;
      panel.querySelector('summary').focus();
    }
  });
  return { sync };
}
