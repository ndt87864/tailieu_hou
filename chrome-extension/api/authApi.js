// src/api/authApi.js
// Auth: Supabase Auth REST (login/refresh) + backend profile/ui-settings.
(function () {
  'use strict';

  const TOKEN_KEY = 'tailieu_access_token';
  const REFRESH_KEY = 'tailieu_refresh_token';
  const USER_KEY = 'tailieu_user';

  // storage helpers
  function storageGet(keys) {
    return new Promise((resolve) => {
      try { chrome.storage.local.get(keys, (r) => resolve(r || {})); } catch (e) { resolve({}); }
    });
  }
  function storageSet(obj) {
    return new Promise((resolve) => {
      try { chrome.storage.local.set(obj, () => resolve(true)); } catch (e) { resolve(false); }
    });
  }
  function storageRemove(keys) {
    return new Promise((resolve) => {
      try { chrome.storage.local.remove(keys, () => resolve(true)); } catch (e) { resolve(false); }
    });
  }

  // === Supabase Auth REST ===
  // grant_type=password | refresh_token
  async function supabaseTokenGrant(grantType, payload) {
    if (typeof tailieuEnv === 'undefined' || !tailieuEnv) throw new Error('env not loaded');
    const { url, anonKey } = await tailieuEnv.getSupabaseConfig();
    if (!url || !anonKey) throw new Error('SUPABASE_URL/ANON_KEY missing in .env.extends');

    const u = `${url.replace(/\/$/, '')}/auth/v1/token?grant_type=${encodeURIComponent(grantType)}`;
    const res = await fetch(u, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
    if (!res.ok) {
      const err = (data && (data.error_description || data.msg || data.message || data.error)) || `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: err, data };
    }
    return { ok: true, status: res.status, data };
  }

  async function login(email, password) {
    const r = await supabaseTokenGrant('password', { email, password });
    if (!r.ok || !r.data || !r.data.access_token) {
      return { ok: false, error: r.error || 'Login failed' };
    }
    await storageSet({
      [TOKEN_KEY]: r.data.access_token,
      [REFRESH_KEY]: r.data.refresh_token || null,
      [USER_KEY]: r.data.user || null,
    });
    return { ok: true, user: r.data.user, token: r.data.access_token };
  }

  async function refresh() {
    const r = await storageGet([REFRESH_KEY]);
    const refreshToken = r[REFRESH_KEY];
    if (!refreshToken) return { ok: false, error: 'no refresh token' };
    const res = await supabaseTokenGrant('refresh_token', { refresh_token: refreshToken });
    if (!res.ok || !res.data || !res.data.access_token) {
      return { ok: false, error: res.error || 'refresh failed' };
    }
    await storageSet({
      [TOKEN_KEY]: res.data.access_token,
      [REFRESH_KEY]: res.data.refresh_token || refreshToken,
      [USER_KEY]: res.data.user || null,
    });
    return { ok: true, token: res.data.access_token };
  }

  // Set token thu cong (dev/backup)
  async function setManualToken(token) {
    if (!token || typeof token !== 'string') return { ok: false, error: 'invalid token' };
    await storageSet({ [TOKEN_KEY]: token, [USER_KEY]: null });
    return { ok: true };
  }

  async function logout() {
    await storageRemove([TOKEN_KEY, REFRESH_KEY, USER_KEY]);
    return { ok: true };
  }

  async function getToken() {
    const r = await storageGet([TOKEN_KEY]);
    return r[TOKEN_KEY] || null;
  }
  async function getUser() {
    const r = await storageGet([USER_KEY]);
    return r[USER_KEY] || null;
  }

  // === Backend profile/ui-settings (qua tailieuClient) ===
  async function getProfile() {
    const r = await tailieuClient.request('/api/v1/auth/profile');
    return r;
  }
  async function getUiSettings() {
    const r = await tailieuClient.request('/api/v1/auth/ui-settings');
    return r;
  }
  async function putUiSettings(payload) {
    const r = await tailieuClient.request('/api/v1/auth/ui-settings', { method: 'PUT', body: payload });
    return r;
  }

  const api = {
    login,
    refresh,
    logout,
    setManualToken,
    getToken,
    getUser,
    getProfile,
    getUiSettings,
    putUiSettings,
  };

  if (typeof window !== 'undefined') {
    window.tailieuAuthApi = api;
  }
  if (typeof self !== 'undefined') {
    self.tailieuAuthApi = api;
  }
})();
