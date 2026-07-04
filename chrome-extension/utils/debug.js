// src/utils/debug.js
// Safe debug logger. Toggle via window.TAILIEU_DEBUG or storage flag 'tailieu_debug'.
(function () {
  'use strict';

  const STORAGE_KEY = 'tailieu_debug';

  function isEnabled() {
    try {
      if (typeof window !== 'undefined' && window.TAILIEU_DEBUG === true) return true;
    } catch (e) { /* ignore */ }
    //Storage check async nao thi khong chan duoc; default theo flag runtime
    return false;
  }

  function safeDebugLog(...args) {
    try {
      if (!isEnabled()) return;
      const prefix = '[Tailieu]';
      if (typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log(prefix, ...args);
      }
    } catch (e) {
      // never throw from logging
    }
  }

  function safeWarn(...args) {
    try {
      const prefix = '[Tailieu]';
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(prefix, ...args);
      }
    } catch (e) { /* ignore */ }
  }

  function safeError(...args) {
    try {
      const prefix = '[Tailieu ERROR]';
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error(prefix, ...args);
      }
    } catch (e) { /* ignore */ }
  }

  // Expose global
  if (typeof window !== 'undefined') {
    window.safeDebugLog = safeDebugLog;
    window.safeWarn = safeWarn;
    window.safeError = safeError;
    // Default debug off in production; enable via popup
    if (window.TAILIEU_DEBUG === undefined) window.TAILIEU_DEBUG = false;
  }
  if (typeof self !== 'undefined' && typeof self.window === 'undefined') {
    // service worker context
    self.safeDebugLog = safeDebugLog;
    self.safeWarn = safeWarn;
    self.safeError = safeError;
    if (self.TAILIEU_DEBUG === undefined) self.TAILIEU_DEBUG = false;
  }
})();
