export function enableOffline() {
  const status = document.getElementById('offlineStatus');
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'flight-cached') status.textContent = event.data.ready
      ? 'Offline copy ready. Uncached weather dates and locations still need a connection.'
      : 'Map included offline; some flight files still need a connection.';
  });
  navigator.serviceWorker.register(new URL('./offline-worker.js', location.href)).then(async registration => {
    await navigator.serviceWorker.ready;
    const worker = registration.active ?? navigator.serviceWorker.controller;
    worker?.postMessage({ type: 'cache-flight', urls: performance.getEntriesByType('resource').map(entry => entry.name) });
  }).catch(() => { status.textContent = 'Map included in this page. Offline browser storage is unavailable.'; });
}
