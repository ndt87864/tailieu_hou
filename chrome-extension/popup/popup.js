// src/popup/popup.js
// UI wiring: login, profile, api mode, debug toggle. Giao tiep voi background via sendMessage.
(function () {
  'use strict';

  function sendMessage(msg) {
    return new Promise((resolve) => {
      try { chrome.runtime.sendMessage(msg, (r) => resolve(r)); } catch (e) { resolve({ ok: false, error: String(e) }); }
    });
  }

  const $ = (id) => document.getElementById(id);
  const els = {
    status: $('status'),
    loginSection: $('login-section'),
    profileSection: $('profile-section'),
    email: $('email'),
    password: $('password'),
    loginBtn: $('login-btn'),
    googleLoginBtn: $('google-login-btn'),
    profileInfo: $('profile-info'),
    logoutBtn: $('logout-btn'),
    manualToken: $('manual-token'),
    manualTokenBtn: $('manual-token-btn'),
    apiMode: $('api-mode'),
    applyMode: $('apply-mode-btn'),
    currentBase: $('current-base'),
    debugToggle: $('debug-toggle'),
  };

  function setStatus(t) { if (els.status) els.status.textContent = t; }

  function hide(el) { if (el) el.classList.add('hidden'); }
  function show(el) { if (el) el.classList.remove('hidden'); }

  async function refreshProfile() {
    const r = await sendMessage({ action: 'auth:getProfile' });
    if (r && r.ok && r.data && r.data.user) {
      hide(els.loginSection);
      show(els.profileSection);
      const u = r.data.user;
      const p = r.data.profile || {};
      const role = r.data.role || (p && p.role) || 'guest';
      els.profileInfo.innerHTML = '';
      const lines = [
        `<div><strong>${u.email || '—'}</strong></div>`,
        `<div>Role: ${role}</div>`,
        p.full_name ? `<div>${String(p.full_name).replace(/</g, '<')}</div>` : '',
        p.default_excel_unpaid != null ? `<div>Limits: unpaid ${p.default_excel_unpaid}% / paid ${p.default_excel_paid}%</div>` : '',
      ];
      els.profileInfo.innerHTML = lines.filter(Boolean).join('');
      setStatus('đã đăng nhập');
    } else {
      show(els.loginSection);
      hide(els.profileSection);
      const has = await sendMessage({ action: 'auth:getToken' });
      setStatus(has && has.token ? 'token đã lưu (cần đăng nhập lại?)' : 'chưa đăng nhập');
    }
  }

  async function refreshMode() {
    const r = await sendMessage({ action: 'env:getMode' });
    if (r && r.ok && els.apiMode) els.apiMode.value = r.mode || 'auto';
    const b = await sendMessage({ action: 'env:resolveBaseUrl' });
    if (b && b.ok && els.currentBase) els.currentBase.textContent = b.base || '—';
  }

  async function loadDebug() {
    try {
      chrome.storage.local.get(['tailieu_debug'], (r) => {
        const on = r && r.tailieu_debug === true;
        if (els.debugToggle) els.debugToggle.checked = on;
        if (typeof window !== 'undefined') window.TAILIEU_DEBUG = on;
      });
    } catch (e) {}
  }

  // === Events ===
  els.loginBtn && els.loginBtn.addEventListener('click', async () => {
    const email = els.email.value.trim();
    const password = els.password.value;
    if (!email || !password) { setStatus('thiếu email/mật khẩu'); return; }
    setStatus('đang đăng nhập…');
    const r = await sendMessage({ action: 'auth:login', email, password });
    if (r && r.ok) {
      setStatus('đăng nhập OK');
      els.password.value = '';
      refreshProfile();
    } else {
      setStatus('lỗi: ' + (r && r.error ? r.error : 'thất bại'));
    }
  });

  els.googleLoginBtn && els.googleLoginBtn.addEventListener('click', async () => {
    setStatus('đang mở cửa sổ đăng nhập Google…');
    const r = await sendMessage({ action: 'auth:loginWithGoogle' });
    if (r && r.ok) {
      setStatus('đăng nhập Google OK');
      refreshProfile();
    } else {
      setStatus('lỗi: ' + (r && r.error ? r.error : 'thất bại'));
    }
  });

  els.manualTokenBtn && els.manualTokenBtn.addEventListener('click', async () => {
    const t = els.manualToken.value.trim();
    if (!t) { setStatus('chưa dán token'); return; }
    const r = await sendMessage({ action: 'auth:setManualToken', token: t });
    setStatus(r && r.ok ? 'đã lưu token' : 'lỗi lưu token');
    if (r && r.ok) refreshProfile();
  });

  els.logoutBtn && els.logoutBtn.addEventListener('click', async () => {
    await sendMessage({ action: 'auth:logout' });
    setStatus('đã đăng xuất');
    refreshProfile();
  });

  els.applyMode && els.applyMode.addEventListener('click', async () => {
    const mode = els.apiMode.value;
    await sendMessage({ action: 'env:setMode', mode });
    setStatus('đã đổi chế độ: ' + mode);
    refreshMode();
  });

  els.debugToggle && els.debugToggle.addEventListener('change', async () => {
    const on = els.debugToggle.checked;
    try { chrome.storage.local.set({ tailieu_debug: on }); } catch (e) {}
    if (typeof window !== 'undefined') window.TAILIEU_DEBUG = on;
    setStatus(on ? 'debug bật' : 'debug tắt');
  });

  // Lắng nghe thay đổi local storage để cập nhật UI ngay lập tức
  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes.tailieu_access_token || changes.tailieu_user) {
          refreshProfile();
        }
        if (changes.tailieu_api_mode) {
          refreshMode();
        }
      }
    });
  } catch (e) {}

  // === Init ===
  (async () => {
    try { setStatus('đang tải…'); await loadDebug(); await refreshProfile(); await refreshMode(); }
    catch (e) { setStatus('lỗi init: ' + e.message); }
  })();
})();
