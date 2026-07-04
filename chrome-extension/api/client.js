// src/api/client.js
// Fetch wrapper cho backend Hono: base URL auto-detect, auth header, retry transient, envelope validation.
(function () {
  'use strict';

  const MAX_ATTEMPTS = 3;
  const BASE_RETRY_DELAY_MS = 800;

  const TRANSIENT_HTTP = new Set([408, 425, 429, 500, 502, 503, 504]);

  function isTransientMessage(msg) {
    const s = String(msg || '').toLowerCase();
    if (!s) return false;
    return (
      s.includes('failed to fetch') ||
      s.includes('networkerror') ||
      s.includes('network request failed') ||
      s.includes('load failed') ||
      s.includes('aborted') ||
      s.includes('timeout') ||
      s.includes('timed out')
    );
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, Math.max(0, Number(ms) || 0)));
  }

  // storage get token (promise) - token luu boi authStore/background.
  function getStoredToken() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['tailieu_access_token'], (res) => resolve(res && res.tailieu_access_token || null));
      } catch (e) { resolve(null); }
    });
  }

  async function buildHeaders(extra) {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const token = await getStoredToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return Object.assign({}, headers, extra || {});
  }

  // Core request. path da co prefix '/api/v1/...'. opts: { method, body, query, headers }.
  async function request(path, opts = {}) {
    if (typeof tailieuEnv === 'undefined' || !tailieuEnv || typeof tailieuEnv.resolveBaseUrl !== 'function') {
      throw new Error('[client] tailieuEnv not loaded');
    }
    const base = (await tailieuEnv.resolveBaseUrl()).replace(/\/$/, '');
    let url = `${base}${path.startsWith('/') ? path : '/' + path}`;

    // Query string
    if (opts.query && typeof opts.query === 'object') {
      const params = new URLSearchParams();
      Object.keys(opts.query).forEach((k) => {
        const v = opts.query[k];
        if (v === undefined || v === null || v === '') return;
        params.append(k, String(v));
      });
      const qs = params.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }

    const method = (opts.method || 'GET').toUpperCase();
    const headers = await buildHeaders(opts.headers);
    const body = (opts.body !== undefined && method !== 'GET' && method !== 'HEAD') ? JSON.stringify(opts.body) : undefined;

    let lastError = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, { method, headers, body });
        const text = await res.text();

        // Retry transient HTTP
        if (TRANSIENT_HTTP.has(res.status) && attempt < MAX_ATTEMPTS) {
          if (typeof safeWarn === 'function') safeWarn('[client] transient HTTP', res.status, 'retry', attempt);
          await sleep(BASE_RETRY_DELAY_MS * attempt);
          continue;
        }

        // Parse JSON (or empty)
        let data = null;
        if (text) {
          try { data = JSON.parse(text); }
          catch (e) {
            if (res.ok) {
              // non-JSON success - tra raw text
              return { ok: true, status: res.status, data: text, raw: true };
            }
            throw new Error(`Invalid JSON (HTTP ${res.status})`);
          }
        }

        if (!res.ok) {
          const err = (data && (data.error || data.message)) || `HTTP ${res.status}`;
          // 401 - bao background clear/refresh (no loop o day; authStore xu ly ngoai)
          if (res.status === 401) {
            try { chrome.runtime.sendMessage({ action: 'auth:unauthorized' }).catch(() => {}); } catch (e) {}
          }
          return { ok: false, status: res.status, error: err, data };
        }

        return { ok: true, status: res.status, data };
      } catch (e) {
        lastError = e;
        if (isTransientMessage(e && e.message) && attempt < MAX_ATTEMPTS) {
          if (typeof safeWarn === 'function') safeWarn('[client] transient exception, retry', attempt, e.message);
          await sleep(BASE_RETRY_DELAY_MS * attempt);
          continue;
        }
        throw e;
      }
    }
    throw lastError || new Error('Request failed after retries');
  }

  const api = { request };

  if (typeof window !== 'undefined') {
    window.tailieuClient = api;
  }
  if (typeof self !== 'undefined') {
    self.tailieuClient = api;
  }
})();
