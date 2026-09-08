import { WORLD_LAND } from './world-map-data.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export function wrapLongitude(longitude) { return ((longitude + 180) % 360 + 360) % 360 - 180; }

// Equirectangular projection includes both poles. The coastline is part of the
// bundle: no tiles, token, geocoding service, or network request at any zoom.
export function createWorldMap(canvas, onSelect) {
  const context = canvas.getContext('2d'), pointers = new Map();
  let width = 360, height = 180, zoom = 1, centerLongitude = 0, centerLatitude = 0;
  let selection = { latitude: 39.9, longitude: 116.4 }, gesture = null, scheduled = false;
  const scale = () => width / 360 * zoom;
  function constrain() {
    centerLongitude = wrapLongitude(centerLongitude);
    const limit = Math.max(0, 90 - height / (2 * scale()));
    centerLatitude = clamp(centerLatitude, -limit, limit);
  }
  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function coordinate(x, y) {
    return { longitude: wrapLongitude(centerLongitude + (x - width / 2) / scale()),
      latitude: clamp(centerLatitude - (y - height / 2) / scale(), -90, 90) };
  }
  function draw() {
    scheduled = false;
    const rect = canvas.getBoundingClientRect();
    width = rect.width || width; height = rect.height || width / 2;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    constrain();
    const s = scale(), x = lon => width / 2 + (lon - centerLongitude) * s;
    const y = lat => height / 2 + (centerLatitude - lat) * s;
    context.fillStyle = '#102e40'; context.fillRect(0, 0, width, height);
    context.strokeStyle = '#acc7d222'; context.lineWidth = 0.6;
    const grid = zoom > 4 ? 10 : 30;
    for (let copy = -1; copy <= 1; copy++) {
      context.strokeStyle = '#acc7d222';
      for (let lon = -180; lon <= 180; lon += grid) {
        context.beginPath(); context.moveTo(x(lon + copy * 360), 0); context.lineTo(x(lon + copy * 360), height); context.stroke();
      }
      context.fillStyle = '#80a67d'; context.strokeStyle = '#c8d9b977';
      for (const polygon of WORLD_LAND) {
        context.beginPath();
        for (const ring of polygon) {
          ring.forEach(([lon, lat], index) => {
            if (!index) context.moveTo(x(lon + copy * 360), y(lat));
            else context.lineTo(x(lon + copy * 360), y(lat));
          });
          context.closePath();
        }
        context.fill('evenodd'); context.stroke();
      }
      const px = x(selection.longitude + copy * 360), py = y(selection.latitude);
      context.beginPath(); context.arc(px, py, 5, 0, Math.PI * 2);
      context.fillStyle = '#ffde78'; context.fill();
      context.lineWidth = 2; context.strokeStyle = '#152630'; context.stroke(); context.lineWidth = 0.6;
    }
    context.strokeStyle = '#acc7d233';
    for (let lat = -60; lat <= 60; lat += grid) {
      context.beginPath(); context.moveTo(0, y(lat)); context.lineTo(width, y(lat)); context.stroke();
    }
    const label = `${Math.abs(selection.latitude).toFixed(2)}°${selection.latitude < 0 ? 'S' : 'N'}, ${Math.abs(selection.longitude).toFixed(2)}°${selection.longitude < 0 ? 'W' : 'E'}`;
    canvas.setAttribute('aria-label', `World map, selected ${label}, zoom ${zoom.toFixed(1)}×. Arrow keys move the pin; Enter applies; plus and minus zoom.`);
  }
  function redraw() { if (!scheduled) { scheduled = true; requestAnimationFrame(draw); } }
  function zoomAt(factor, x = width / 2, y = height / 2) {
    const anchor = coordinate(x, y);
    zoom = clamp(zoom * factor, 1, 12);
    centerLongitude = anchor.longitude - (x - width / 2) / scale();
    centerLatitude = anchor.latitude + (y - height / 2) / scale();
    constrain(); redraw();
  }
  canvas.addEventListener('wheel', event => {
    event.preventDefault(); const p = point(event); zoomAt(Math.exp(-clamp(event.deltaY, -150, 150) * 0.005), p.x, p.y);
  }, { passive: false });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const p = point(event); pointers.set(event.pointerId, p); canvas.setPointerCapture?.(event.pointerId);
    if (pointers.size === 1) gesture = { start: p, last: p, moved: false };
    else if (gesture) { gesture.moved = true; gesture.pinch = null; }
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    const p = point(event); pointers.set(event.pointerId, p);
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (gesture.pinch) {
        centerLongitude -= (mid.x - gesture.pinch.mid.x) / scale();
        centerLatitude += (mid.y - gesture.pinch.mid.y) / scale();
        zoomAt(distance / Math.max(1, gesture.pinch.distance), mid.x, mid.y);
      }
      gesture.pinch = { distance, mid }; gesture.moved = true;
    } else {
      if (Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > 5) gesture.moved = true;
      if (gesture.moved) {
        centerLongitude -= (p.x - gesture.last.x) / scale();
        centerLatitude += (p.y - gesture.last.y) / scale();
        constrain(); redraw();
      }
    }
    gesture.last = p;
  });
  function release(event, cancel = false) {
    if (!pointers.has(event.pointerId)) return;
    const p = point(event), select = !cancel && pointers.size === 1 && gesture && !gesture.moved;
    pointers.delete(event.pointerId);
    if (select) { selection = coordinate(p.x, p.y); onSelect(selection); redraw(); }
    if (!pointers.size) gesture = null;
    else if (gesture) { gesture.last = [...pointers.values()][0]; gesture.moved = true; }
  }
  canvas.addEventListener('pointerup', event => release(event));
  canvas.addEventListener('pointercancel', event => release(event, true));
  canvas.addEventListener('lostpointercapture', event => release(event, true));
  canvas.addEventListener('keydown', event => {
    const delta = (event.shiftKey ? 10 : 1) / zoom;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      selection.longitude = wrapLongitude(selection.longitude + (event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0));
      selection.latitude = clamp(selection.latitude + (event.key === 'ArrowUp' ? delta : event.key === 'ArrowDown' ? -delta : 0), -90, 90);
      centerLongitude = selection.longitude; centerLatitude = selection.latitude; constrain(); redraw();
    } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect({ ...selection }); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(1.5); }
    else if (event.key === '-') { event.preventDefault(); zoomAt(1 / 1.5); }
    else if (event.key === 'Home') { event.preventDefault(); reset(); }
  });
  function reset() { zoom = 1; centerLongitude = centerLatitude = 0; redraw(); }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(redraw) : null;
  observer?.observe(canvas);
  window.addEventListener('resize', redraw);
  redraw();
  return { redraw, zoom: zoomAt, reset,
    select(latitude, longitude, recenter = false) {
      selection = { latitude, longitude };
      if (recenter && zoom > 1) { centerLatitude = latitude; centerLongitude = longitude; }
      redraw();
    },
    dispose() { observer?.disconnect(); window.removeEventListener('resize', redraw); },
  };
}
