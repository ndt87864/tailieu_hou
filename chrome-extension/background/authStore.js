// src/background/authStore.js
// Token store: getToken (with optional refresh attempt), setManual, logout, ensureFresh.
(function () {
  'use strict';

  const TOKEN_KEY = 'tailieu_access_token';
  const REFRESH_KEY = 'tailieu_refresh_token';

  let _refreshing = null;

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

  async function getToken() {
    const r = await storageGet([TOKEN_KEY]);
    return r[TOKEN_KEY] || null;
  }

  async function ensureFresh() {
    const token = await getToken();
    if (!token) return null;
    // Best-effort: validate boi backend profile. Neu 401 -> refresh 1 lan.
    return token;
  }

  async function attemptRefresh() {
    if (_refreshing) return _refreshing;
    _refreshing = (async () => {
      try {
        const r = await self.tailieuAuthApi.refresh();
        if (!r.ok) {
          if (typeof safeWarn === 'function') safeWarn('[authStore] refresh failed', r.error);
          return null;
        }
        return r.token;
      } finally {
        _refreshing = null;
      }
    })();
    return _refreshing;
  }

  async function logout() {
    await storageRemove([TOKEN_KEY, REFRESH_KEY, 'tailieu_user']);
    return { ok: true };
  }

  async function setManualToken(token) {
    const r = await self.tailieuAuthApi.setManualToken(token);
    return r;
  }

  async function setSession(token, refreshToken, user) {
    await storageSet({
      [TOKEN_KEY]: token,
      [REFRESH_KEY]: refreshToken || null,
      'tailieu_user': user || null,
    });
    return { ok: true };
  }

  async function loginWithGoogle() {
    if (typeof self.tailieuEnv === 'undefined' || !self.tailieuEnv) {
      return { ok: false, error: 'env not loaded' };
    }
    const config = await self.tailieuEnv.getSupabaseConfig();
    if (!config.url || !config.anonKey) {
      return { ok: false, error: 'Thiếu cấu hình Supabase trong .env.extends' };
    }

    // URL callback duy nhất Chrome Extension có thể dùng với identity API
    const redirectUrl = chrome.identity.getRedirectURL();

    // Xây dựng URL OAuth của Supabase trỏ đến provider google
    // flow_type=implicit: Supabase trả access_token trực tiếp trong URL hash
    // thay vì PKCE code (default mới) cần exchange thêm bước.
    const oauthUrl =
      config.url.replace(/\/$/, '') +
      '/auth/v1/authorize?provider=google&flow_type=implicit&redirect_to=' +
      encodeURIComponent(redirectUrl);

    return new Promise((resolve) => {
      chrome.identity.launchWebAuthFlow(
        { url: oauthUrl, interactive: true },
        async (callbackUrl) => {
          if (chrome.runtime.lastError || !callbackUrl) {
            const msg = (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'Đăng nhập bị hủy';
            resolve({ ok: false, error: msg });
            return;
          }
          try {
            // Supabase trả token qua hash fragment: #access_token=...&refresh_token=...
            const url = new URL(callbackUrl);
            const params = new URLSearchParams(url.hash ? url.hash.slice(1) : url.search.slice(1));
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            if (!accessToken) {
              resolve({ ok: false, error: 'Không nhận được access_token từ Google' });
              return;
            }
            await storageSet({
              [TOKEN_KEY]: accessToken,
              [REFRESH_KEY]: refreshToken || null,
              tailieu_user: null,
            });
            if (typeof safeDebugLog === 'function') safeDebugLog('[authStore] Google login OK');
            resolve({ ok: true, token: accessToken });
          } catch (e) {
            resolve({ ok: false, error: String(e) });
          }
        }
      );
    });
  }

  const api = { getToken, ensureFresh, attemptRefresh, logout, setManualToken, setSession, loginWithGoogle, TOKEN_KEY, REFRESH_KEY };

  if (typeof self !== 'undefined') {
    self.tailieuAuthStore = api;
  }
})();
