// src/background/background.js
// Service worker (MV3). importScripts config/api, message router, lifecycle.
// Polyfill window cho lib dua vao window.
self.window = self;

try {
  importScripts(
    '../config/env.js',
    '../api/client.js',
    '../api/authApi.js',
    '../api/docsApi.js',
    '../api/questionsApi.js',
    '../utils/textUtils.js',
    './authStore.js',
    './router.js',
  );
  if (typeof safeDebugLog === 'function') safeDebugLog('[bg] scripts imported');
} catch (e) {
  if (typeof console !== 'undefined') console.error('[bg] import failed', e);
}

// Lifecycle
chrome.runtime.onInstalled.addListener(() => {
  if (typeof safeDebugLog === 'function') safeDebugLog('[bg] installed');
});

// Central message router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || typeof request.action !== 'string') {
    sendResponse({ ok: false, error: 'missing action' });
    return false;
  }
  // Delegate to router (async)
  (async () => {
    try {
      const res = await self.tailieuRouter.handle(request, sender);
      sendResponse(res != null ? res : { ok: true });
    } catch (e) {
      if (typeof safeError === 'function') safeError('[bg] handler throw', request.action, e);
      sendResponse({ ok: false, error: (e && e.message) || String(e) });
    }
  })();
  return true; // async
});
