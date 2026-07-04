/**
 * Panel / Sidebar - Tailieu HOU Extension
 * UI: Sidebar phải, giống extension mẫu:
 * - Icon bar trên cùng (thông báo, cài đặt...)
 * - Section "Menu bài tập" với lưới số câu (màu xanh/xám tùy đã highlight)
 * - Link "Xem lại lời hoàn thành"
 * - Dropdown chọn môn học
 * - Nút Tải lại đáp án
 */
(function () {
  'use strict';

  if (window.tailieuPanel) return;

  let _panel = null;
  let _state = {
    highlightEnabled: true,
    documents: [],
    selectedDocId: null,
    stats: null,
    role: null,
    busy: false,
  };

  const HIGHLIGHT_KEY = 'tailieu_highlight_enabled';
  const PANEL_HIDDEN_KEY = 'tailieu_panel_hidden';

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
  function sendMessage(msg) {
    return new Promise((resolve) => {
      try { chrome.runtime.sendMessage(msg, (r) => resolve(r)); } catch (e) { resolve({ ok: false, error: String(e) }); }
    });
  }

  // ==================== CSS INJECTION ====================

  function injectPanelStyles() {
    if (document.getElementById('tailieu-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'tailieu-panel-styles';
    style.textContent = `
/* === SIDEBAR PANEL === */
#tailieu-panel {
  position: fixed;
  top: 0; right: 0;
  width: 220px;
  height: 100vh;
  background: #f8f9fa;
  border-left: 1px solid #dee2e6;
  z-index: 999990;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  color: #333;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 16px rgba(0,0,0,.1);
  transition: transform .25s ease;
  overflow: hidden;
}
#tailieu-panel.tailieu-panel-hidden { transform: translateX(100%); }

/* Toolbar icons top */
.tlp-toolbar {
  background: #1a237e;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 8px;
  height: 44px;
  flex-shrink: 0;
}
.tlp-toolbar-brand {
  display: flex; align-items: center; gap: 6px;
  color: white; font-weight: 700; font-size: 14px;
}
.tlp-toolbar-brand img {
  width: 24px; height: 24px; border-radius: 4px;
  object-fit: contain;
}
.tlp-toolbar-icons { display: flex; gap: 4px; }
.tlp-icon-btn {
  background: rgba(255,255,255,.15); border: none;
  color: white; width: 30px; height: 30px; border-radius: 6px;
  cursor: pointer; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  transition: background .2s;
}
.tlp-icon-btn:hover { background: rgba(255,255,255,.3); }

/* Body scroll area */
.tlp-body {
  flex: 1; overflow-y: auto; padding: 12px 10px;
  display: flex; flex-direction: column; gap: 12px;
}
.tlp-body::-webkit-scrollbar { width: 4px; }
.tlp-body::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }

/* Section card */
.tlp-section {
  background: white;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  overflow: hidden;
}
.tlp-section-header {
  background: linear-gradient(135deg, #1565C0 0%, #1E88E5 100%);
  color: white;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .3px;
}
.tlp-section-body { padding: 10px; }

/* Môn học select */
.tlp-field-label { font-size: 11px; color: #6c757d; margin-bottom: 4px; }
.tlp-select {
  width: 100%; padding: 6px 8px;
  border: 1px solid #ced4da; border-radius: 6px;
  font-size: 12px; background: #fff; color: #333;
  cursor: pointer;
}

/* Buttons */
.tlp-btn {
  width: 100%; padding: 8px 10px;
  border: none; border-radius: 7px;
  background: linear-gradient(135deg, #1565C0, #1E88E5);
  color: #fff; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all .2s;
  margin-top: 6px;
}
.tlp-btn:hover { opacity: .9; transform: translateY(-1px); }
.tlp-btn:active { transform: translateY(0); }
.tlp-btn-outline {
  background: transparent;
  border: 1px solid #1E88E5;
  color: #1E88E5;
}
.tlp-btn-outline:hover { background: #E3F2FD; }

/* Toggle */
.tlp-toggle-row { display: flex; align-items: center; gap: 8px; cursor: pointer; margin-top: 6px; }
.tlp-toggle-row input { width: 15px; height: 15px; accent-color: #1E88E5; }
.tlp-toggle-row span { font-size: 12px; color: #555; }

/* Status */
.tlp-status {
  font-size: 11px; color: #6c757d;
  background: #f1f3f5; border-radius: 6px;
  padding: 6px 8px; margin-top: 6px;
  min-height: 16px; line-height: 1.4;
}
.tlp-status.busy { color: #1E88E5; }

/* Question nav grid */
.tlp-qnav-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  margin-top: 4px;
}
.tlp-qnav-item {
  aspect-ratio: 1;
  border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; cursor: pointer;
  background: #e9ecef; color: #666;
  border: 1px solid transparent;
  transition: all .15s;
}
.tlp-qnav-item:hover { border-color: #1E88E5; color: #1E88E5; }
.tlp-qnav-item.answered { background: #1E88E5; color: white; }
.tlp-qnav-item.not-found { background: #fee2e2; color: #dc2626; }
.tlp-qnav-item.current { outline: 2px solid #ffc107; outline-offset: 1px; }

/* Nav link */
.tlp-nav-link {
  display: block; font-size: 11px; color: #1565C0;
  text-decoration: none; margin-top: 8px; text-align: center;
}
.tlp-nav-link:hover { text-decoration: underline; }

/* Footer close toggle */
.tlp-footer {
  padding: 8px; border-top: 1px solid #dee2e6;
  flex-shrink: 0; display: flex; justify-content: center;
}
.tlp-collapse-btn {
  background: none; border: 1px solid #dee2e6; border-radius: 6px;
  color: #6c757d; font-size: 11px; cursor: pointer;
  padding: 4px 10px; transition: all .2s;
}
.tlp-collapse-btn:hover { background: #f1f3f5; color: #333; }

/* === FLOATING TOGGLE BTN (when panel hidden) === */
#tailieu-sidebar-toggle {
  position: fixed;
  right: 0; top: 50%;
  transform: translateY(-50%);
  width: 28px; height: 64px;
  background: linear-gradient(180deg, #1565C0, #1E88E5);
  border-radius: 8px 0 0 8px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; z-index: 999991;
  box-shadow: -2px 0 8px rgba(0,0,0,.15);
  transition: all .2s;
}
#tailieu-sidebar-toggle:hover { width: 36px; }
#tailieu-sidebar-toggle svg { fill: white; }
#tailieu-sidebar-toggle.hidden-panel { display: flex; }
    `;
    document.head.appendChild(style);
  }

  // ==================== QUESTION NAV GRID ====================

  function buildQuestionNavGrid(container) {
    const grid = container.querySelector('[data-role=qnav-grid]');
    if (!grid) return;

    // Scan DOM để lấy số câu và trạng thái
    const questions = Array.from(document.querySelectorAll('div.que, div[id^="q"]')).filter(el =>
      !!(el.querySelector('.formulation') || el.querySelector('.qtext') || el.querySelector('.ablock') || el.querySelector('.answer'))
    );

    grid.innerHTML = '';
    if (questions.length === 0) {
      grid.innerHTML = '<span style="font-size:11px;color:#6c757d;grid-column:1/-1">Không có câu hỏi</span>';
      return;
    }

    questions.forEach((qEl, idx) => {
      const num = idx + 1;
      const hasAnswer = !!(qEl.querySelector('.tailieu-answer-badge') || qEl.querySelector('.tailieu-correct'));
      const item = document.createElement('div');
      item.className = 'tlp-qnav-item' + (hasAnswer ? ' answered' : '');
      item.textContent = num;
      item.title = `Câu ${num}${hasAnswer ? ' (đã có đáp án)' : ''}`;
      item.addEventListener('click', () => {
        qEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      grid.appendChild(item);
    });
  }

  // ==================== RENDER ====================

  function renderInner() {
    if (!_panel) return;

    // Select
    const sl = _panel.querySelector('[data-role=docs-select]');
    if (sl) {
      const prev = sl.value;
      sl.innerHTML = '';
      const ph = document.createElement('option');
      ph.value = '';
      ph.textContent = _state.documents.length ? '-- Chọn môn --' : '(chưa có môn match)';
      sl.appendChild(ph);
      _state.documents.forEach((d) => {
        const o = document.createElement('option');
        o.value = d.id;
        o.textContent = (d.title || d.id).substring(0, 28);
        if (d.id === _state.selectedDocId || d.id === prev) o.selected = true;
        sl.appendChild(o);
      });
      // Auto-select nếu chỉ 1
      if (_state.documents.length === 1 && !_state.selectedDocId) {
        sl.value = _state.documents[0].id;
        _state.selectedDocId = _state.documents[0].id;
      }
    }

    // Status
    const status = _panel.querySelector('[data-role=status]');
    if (status) {
      const s = _state.stats;
      let txt = '';
      if (_state.busy) { txt = 'Đang tải…'; status.className = 'tlp-status busy'; }
      else if (s) {
        txt = `Đã xem ${s.questionsShown || 0}/${s.totalCount || 0} câu`;
        if (s.ratioPercent != null) txt += ` (${s.ratioPercent}%)`;
        if (s.limitApplied) txt += ' — nâng cấp để xem thêm';
        if (_state.role) txt += ` | ${_state.role}`;
        status.className = 'tlp-status';
      } else {
        txt = _state.role ? `Vai trò: ${_state.role}` : 'Sẵn sàng';
        status.className = 'tlp-status';
      }
      status.textContent = txt;
    }

    // Toggle checkbox
    const cb = _panel.querySelector('[data-role=highlight-toggle]');
    if (cb) cb.checked = !!_state.highlightEnabled;

    // Refresh question nav
    buildQuestionNavGrid(_panel);
  }

  // ==================== BUILD DOM ====================

  function buildPanel(onSelectDoc, onReload, onToggleHighlight) {
    if (_panel) return _panel;
    injectPanelStyles();

    const p = document.createElement('div');
    p.id = 'tailieu-panel';
    p.className = 'tailieu-panel tailieu-panel-hidden';

    // ---- Toolbar ----
    const toolbar = document.createElement('div');
    toolbar.className = 'tlp-toolbar';

    const brand = document.createElement('div');
    brand.className = 'tlp-toolbar-brand';
    // Logo fallback to emoji
    const logoImg = document.createElement('img');
    logoImg.src = chrome.runtime.getURL('icons/icon48.png');
    logoImg.onerror = () => { logoImg.style.display = 'none'; };
    brand.appendChild(logoImg);
    const brandText = document.createElement('span');
    brandText.textContent = 'Tailieu HOU';
    brand.appendChild(brandText);
    toolbar.appendChild(brand);

    const iconGroup = document.createElement('div');
    iconGroup.className = 'tlp-toolbar-icons';
    const icons = [
      { label: '🔔', title: 'Thông báo' },
      { label: '⚙️', title: 'Cài đặt' },
      { label: '×', title: 'Đóng panel', id: 'tlp-close-btn' },
    ];
    icons.forEach(({ label, title, id }) => {
      const btn = document.createElement('button');
      btn.className = 'tlp-icon-btn';
      btn.textContent = label;
      btn.title = title;
      if (id) btn.id = id;
      iconGroup.appendChild(btn);
    });
    toolbar.appendChild(iconGroup);
    p.appendChild(toolbar);

    // Close btn event
    iconGroup.querySelector('#tlp-close-btn').addEventListener('click', () => {
      p.classList.add('tailieu-panel-hidden');
      ensureSidebarToggle(() => { p.classList.remove('tailieu-panel-hidden'); });
    });

    // ---- Body ----
    const body = document.createElement('div');
    body.className = 'tlp-body';

    // Menu bài tập bị loại bỏ vì dư thừa so với Menu bài tập mặc định của Moodle.

    // === Section: Cài đặt ===
    const settingSection = document.createElement('div');
    settingSection.className = 'tlp-section';
    const settingHeader = document.createElement('div');
    settingHeader.className = 'tlp-section-header';
    settingHeader.textContent = 'Cài đặt đáp án';
    settingSection.appendChild(settingHeader);

    const settingBody = document.createElement('div');
    settingBody.className = 'tlp-section-body';

    // Môn học
    const lblMon = document.createElement('div');
    lblMon.className = 'tlp-field-label';
    lblMon.textContent = 'Môn học';
    settingBody.appendChild(lblMon);

    const sl = document.createElement('select');
    sl.className = 'tlp-select';
    sl.setAttribute('data-role', 'docs-select');
    sl.addEventListener('change', () => {
      _state.selectedDocId = sl.value || null;
      try { onSelectDoc && onSelectDoc(_state.selectedDocId); } catch (e) {}
    });
    settingBody.appendChild(sl);

    // Nút tải lại
    const reloadBtn = document.createElement('button');
    reloadBtn.type = 'button';
    reloadBtn.className = 'tlp-btn';
    reloadBtn.textContent = '↻ Tải lại đáp án';
    reloadBtn.addEventListener('click', () => { try { onReload && onReload(); } catch (e) {} });
    settingBody.appendChild(reloadBtn);

    // Toggle highlight
    const toggleRow = document.createElement('label');
    toggleRow.className = 'tlp-toggle-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.setAttribute('data-role', 'highlight-toggle');
    cb.checked = true;
    cb.addEventListener('change', async () => {
      await setHighlightPref(cb.checked);
      try { onToggleHighlight && onToggleHighlight(cb.checked); } catch (e) {}
    });
    const cbLbl = document.createElement('span');
    cbLbl.textContent = 'Bật tô đáp án';
    toggleRow.appendChild(cb);
    toggleRow.appendChild(cbLbl);
    settingBody.appendChild(toggleRow);

    // Status
    const status = document.createElement('div');
    status.className = 'tlp-status';
    status.setAttribute('data-role', 'status');
    status.textContent = 'Sẵn sàng';
    settingBody.appendChild(status);

    settingSection.appendChild(settingBody);
    body.appendChild(settingSection);

    p.appendChild(body);

    // ---- Footer ----
    const footer = document.createElement('div');
    footer.className = 'tlp-footer';
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'tlp-collapse-btn';
    collapseBtn.textContent = '← Ẩn panel';
    collapseBtn.addEventListener('click', () => {
      p.classList.add('tailieu-panel-hidden');
      ensureSidebarToggle(() => { p.classList.remove('tailieu-panel-hidden'); });
    });
    footer.appendChild(collapseBtn);
    p.appendChild(footer);

    document.documentElement.appendChild(p);
    _panel = p;
    renderInner();

    // Show the toggle button immediately since the panel is hidden on start
    ensureSidebarToggle(() => { p.classList.remove('tailieu-panel-hidden'); });



    return p;
  }

  // ==================== SIDEBAR TOGGLE (khi panel ẩn) ====================

  function ensureSidebarToggle(onOpen) {
    let t = document.getElementById('tailieu-sidebar-toggle');
    if (t) { t._onOpen = onOpen; return t; }

    t = document.createElement('div');
    t.id = 'tailieu-sidebar-toggle';
    t.title = 'Mở panel Tailieu HOU';
    t.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>`;
    t._onOpen = onOpen;
    t.addEventListener('click', () => {
      if (t._onOpen) t._onOpen();
      t.remove();
    });
    document.body.appendChild(t);
    return t;
  }

  // ==================== PUBLIC API ====================

  async function loadHighlightPref() {
    const r = await storageGet([HIGHLIGHT_KEY]);
    _state.highlightEnabled = r[HIGHLIGHT_KEY] !== false;
  }
  async function setHighlightPref(v) {
    _state.highlightEnabled = !!v;
    await storageSet({ [HIGHLIGHT_KEY]: _state.highlightEnabled });
  }

  function setDocuments(docs, autoSelect) {
    _state.documents = Array.isArray(docs) ? docs : [];
    if (autoSelect && _state.documents.length === 1) _state.selectedDocId = _state.documents[0].id;
    renderInner();
  }
  function setStats(stats) { _state.stats = stats; renderInner(); }
  function setRole(role) { _state.role = role; renderInner(); }
  function setBusy(b) { _state.busy = !!b; renderInner(); }
  function getState() { return Object.assign({}, _state); }
  function show() { if (_panel) _panel.classList.remove('tailieu-panel-hidden'); }

  window.tailieuPanel = {
    buildPanel, show,
    setDocuments, setStats, setRole, setBusy, getState,
    loadHighlightPref, setHighlightPref,
    HIGHLIGHT_KEY,
  };
})();
