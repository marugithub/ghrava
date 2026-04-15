/**
 * public/js/offline-indicator.js
 * Shows a banner when network to the NAS API is lost.
 * Registers the service worker for offline caching.
 */
(function() {
  'use strict';

  let _banner = null, _online = true;

  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  function getBanner() {
    if (_banner) return _banner;
    _banner = document.createElement('div');
    _banner.id = 'gh-offline-indicator';
    _banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#ef4444;color:#fff;padding:8px 16px;text-align:center;font-size:13px;font-weight:600;transform:translateY(-100%);transition:transform .25s;pointer-events:none';
    _banner.textContent = '📡 Offline — changes will sync when reconnected';
    document.body.appendChild(_banner);
    return _banner;
  }

  function setOnline(online) {
    if (online === _online) return;
    _online = online;
    const b = getBanner();
    b.style.transform = online ? 'translateY(-100%)' : 'translateY(0)';
    if (online) window.toast?.('Back online', 'ok');
  }

  // Listen to browser online/offline events
  window.addEventListener('online',  () => ping());
  window.addEventListener('offline', () => setOnline(false));

  // Periodic API ping every 30s
  async function ping() {
    try {
      const r = await fetch('/api/v1/app/info', { method: 'HEAD', cache: 'no-store' });
      setOnline(r.ok || r.status < 500);
    } catch { setOnline(false); }
  }

  // Initial check after page settles, then every 30s
  setTimeout(ping, 3000);
  setInterval(ping, 30000);

  window.GH_Offline = { isOnline: () => _online };
})();
