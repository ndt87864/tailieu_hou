// src/config/env.js
// Load .env.extends (runtime, khong commit), override tu chrome.storage.
// Auto-detect backend base URL: local -> prod.
(function () {
  'use strict';

  const ENV_PATH = '.env.extends';
  const MODE_KEY = 'tailieu_api_mode'; // 'local' | 'prod' | 'auto'
  const DETECT_CACHE_KEY = 'tailieu_api_detected';
  const DETECT_TTL_MS = 60 * 1000;

  let _envCache = null; // { API_BASE_LOCAL, API_BASE_PROD, SUPABASE_URL, SUPABASE_ANON_KEY }
  let _detecting = null;

  // Parse KEY=VALUE text -> object
  function parseEnvText(text) {
    const env = {};
    if (!text) return env;
    text.split(/\r?\n/).forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const idx = line.indexOf('=');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    });
    return env;
  }

  // Load env file tu extension package (web_accessible).
  async function loadEnvFile() {
    try {
      let url = null;
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        url = chrome.runtime.getURL(ENV_PATH);
      }
      if (!url) return {};
      const res = await fetch(url);
      if (!res.ok) return {};
      const text = await res.text();
      return parseEnvText(text);
    } catch (e) {
      if (typeof safeWarn === 'function') safeWarn('[env] load .env.extends failed', e);
      return {};
    }
  }

  async function getEnv() {
    if (_envCache) return _envCache;
    _envCache = await loadEnvFile();
    return _envCache;
  }

  // storage get/set helpers (promise)
  function storageGet(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (res) => resolve(res || {}));
      } catch (e) { resolve({}); }
    });
  }
  function storageSet(obj) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(obj, () => resolve(true));
      } catch (e) { resolve(false); }
    });
  }

  async function getMode() {
    const r = await storageGet([MODE_KEY]);
    return r[MODE_KEY] || 'auto';
  }
  async function setMode(mode) {
    await storageSet({ [MODE_KEY]: mode });
    // Force re-detect
    await storageSet({ [DETECT_CACHE_KEY]: null });
  }

  // Probe local health endpoint. Resolve boolean.
  async function probeLocal(localBase) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(`${localBase}/api/v1/health`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return false;
      const data = await res.json().catch(() => ({}));
      return data && data.status === 'ok';
    } catch (e) {
      return false;
    }
  }

  // Decide base URL theo mode. Cache ket qua detect.
  async function resolveBaseUrl() {
    const env = await getEnv();
    const local = env.API_BASE_LOCAL || 'http://localhost:3001';
    const prod = env.API_BASE_PROD || 'https://tailieu-hou.onrender.com';
    const mode = await getMode();

    if (mode === 'local') return local;
    if (mode === 'prod') return prod;

    // auto: cache
    const cached = await storageGet([DETECT_CACHE_KEY]);
    const c = cached[DETECT_CACHE_KEY];
    if (c && typeof c.base === 'string' && (Date.now() - (c.ts || 0) < DETECT_TTL_MS)) {
      return c.base;
    }
    if (_detecting) return _detecting;

    _detecting = (async () => {
      let base = prod;
      try {
        const ok = await probeLocal(local);
        base = ok ? local : prod;
      } catch (e) {
        base = prod;
      }
      await storageSet({ [DETECT_CACHE_KEY]: { base, ts: Date.now() } });
      _detecting = null;
      return base;
    })();
    return _detecting;
  }

  async function getSupabaseConfig() {
    const env = await getEnv();
    return {
      url: env.SUPABASE_URL || '',
      anonKey: env.SUPABASE_ANON_KEY || '',
    };
  }

  const api = {
    getEnv,
    resolveBaseUrl,
    getMode,
    setMode,
    getSupabaseConfig,
  };

  if (typeof window !== 'undefined') {
    window.tailieuEnv = api;
  }
  if (typeof self !== 'undefined') {
    self.tailieuEnv = api;
  }
})();
