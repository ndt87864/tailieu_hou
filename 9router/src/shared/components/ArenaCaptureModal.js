"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Modal, Button } from "@/shared/components";

const TABS = [
  { id: "auto", label: "Tự động", icon: "smartphone" },
  { id: "manual", label: "Thủ công", icon: "edit_note" },
];

async function detectBrowserHint() {
  const userAgent = navigator.userAgent || "";
  let browserName = "";

  if (navigator.brave?.isBrave) {
    try {
      if (await navigator.brave.isBrave()) browserName = "brave";
    } catch {}
  }

  if (!browserName) {
    if (/coc_coc_browser|coccocbrowser/i.test(userAgent)) browserName = "coccoc";
    else if (/edgwebview|edg\//i.test(userAgent)) browserName = "edge";
    else if (/brave/i.test(userAgent)) browserName = "brave";
    else if (/chrome|chromium|crios/i.test(userAgent)) browserName = "chrome";
  }

  return { browserName, userAgent };
}

/**
 * Arena Proxy Capture Modal
 */
export default function ArenaCaptureModal({ isOpen, onSuccess, onClose }) {
  const [tab, setTab] = useState("auto");

  // Reset state when modal opens
  const [modalKey, setModalKey] = useState(0);
  useEffect(() => {
    if (isOpen) setModalKey((k) => k + 1);
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Arena Proxy — LMArena Token">
      <div className="space-y-4">
        {/* Tab Switcher */}
        <div className="flex rounded-lg bg-black/[0.05] dark:bg-white/[0.05] p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-white dark:bg-black shadow-sm text-text-main"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "auto" ? <AutoCaptureTab key={`auto-${modalKey}`} onSuccess={onSuccess} onClose={onClose} /> : <ManualTab key={`manual-${modalKey}`} onSuccess={onSuccess} onClose={onClose} />}
      </div>
    </Modal>
  );
}

/* ── Auto Capture Tab ─────────────────────────────────────────────── */

function AutoCaptureTab({ onSuccess, onClose }) {
  const [step, setStep] = useState("initial"); // initial | waiting | paste | success
  const [token, setToken] = useState("");
  const [cookies, setCookies] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [captureResult, setCaptureResult] = useState(null);
  const [waitingMessage, setWaitingMessage] = useState("⏳ Đang kết nối tới arena.ai...");

  const handleStartCapture = async () => {
    setLoading(true);
    setError(null);
    setStep("waiting");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3min timeout

      setWaitingMessage("⏳ Đang khởi động trình duyệt đăng nhập...");
      const browserHint = await detectBrowserHint();

      const res = await fetch("/api/oauth/arena/capture-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeout: 180000, browserHint }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        if (data.needsPuppeteer) {
          setError(data.error || "Auto capture is not available in this runtime");
          setStep("paste");
          setWaitingMessage("");
          return;
        }
        if (data.needsManual) {
          setError(data.error || "Auto capture is not available on this hosting environment");
          setStep("paste");
          setWaitingMessage("");
          return;
        }
        throw new Error(data.error || "Auto capture failed");
      }

      // Auto-capture succeeded!
      setCaptureResult(data);
      setStep("success");
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);
    } catch (err) {
      if (err.name === "AbortError") {
        setStep("paste");
        setWaitingMessage("");
      } else {
        setError(err.message || "Auto capture failed");
        setStep("paste");
        setWaitingMessage("");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!token.trim()) {
      setError("Vui lòng dán JWT hoặc session token từ arena.ai");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/oauth/arena/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: token.trim(),
          cookies: cookies.trim() || undefined,
          captureMethod: cookies.trim() ? "manual_cookie" : "manual_token",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Xác thực thất bại");
      }

      setStep("success");
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep("initial");
    setToken("");
    setCookies("");
    setError(null);
    setCaptureResult(null);
    onClose?.();
  };

  return (
    <div className="space-y-4">
      {step === "success" ? (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">✅</div>
          <p className="text-lg font-medium text-text-primary">Kết nối thành công!</p>
          {captureResult?.account?.email && (
            <p className="text-sm text-text-muted mt-1">{captureResult.account.email}</p>
          )}
          <p className="text-sm text-text-muted mt-2">Arena AI token đã được lưu</p>
        </div>
      ) : step === "waiting" ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="relative size-16">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-2xl">login</span>
              </span>
            </div>
            <p className="text-sm text-text-primary font-medium text-center max-w-xs">
              {waitingMessage}
            </p>
            <div className="bg-surface-secondary p-3 rounded-lg text-xs text-text-muted max-w-sm">
              <p className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-primary">info</span>
                Một cửa sổ trình duyệt mới đã được mở. Vui lòng đăng nhập vào Arena AI trên cửa sổ đó.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={handleClose} fullWidth>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => { setStep("paste"); setWaitingMessage(""); }} fullWidth>
              Nhập thủ công
            </Button>
          </div>
        </div>
      ) : step === "paste" ? (
        <>
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-primary text-lg mt-0.5">open_in_new</span>
              <div>
                <p className="font-medium text-text-primary">Đã mở arena.ai trong tab mới</p>
                <p className="text-text-muted mt-1">
                  Nếu tab không tự động mở,{' '}
                  <button
                    onClick={() => window.open("https://arena.ai/?mode=direct", "_blank")}
                    className="text-primary hover:underline"
                  >
                    bấm vào đây
                  </button>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface-secondary p-3 rounded-lg text-xs space-y-2">
            <p className="font-medium text-text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">info</span>
              Sau khi đăng nhập, lấy token như sau:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-text-muted">
              <li>Đăng nhập vào tài khoản Arena AI của bạn</li>
              <li>Mở DevTools (F12) → Application → Cookies → https://arena.ai</li>
              <li>Tìm cookie <code className="bg-black/10 dark:bg-white/10 px-1 rounded">arena-auth-prod-v1</code></li>
              <li>Nếu không thấy, tìm <code className="bg-black/10 dark:bg-white/10 px-1 rounded">arena-auth-prod-v1.0</code> và ghép với <code className="bg-black/10 dark:bg-white/10 px-1 rounded">arena-auth-prod-v1.1</code></li>
              <li>Dán token/cookie vào ô bên dưới và bấm Connect</li>
            </ol>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">
              Session / JWT Token
            </label>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="base64-ey..."
              className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono"
              rows={4}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">
              Cookie Header (tùy chọn)
            </label>
            <textarea
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
              placeholder="cf_clearance=...; arena-auth-prod-v1=..."
              className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono"
              rows={3}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-lg">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={handleClose} disabled={loading} fullWidth>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={loading} fullWidth>
              Connect
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="bg-surface-secondary p-3 rounded-lg text-xs space-y-2">
            <p className="font-medium text-text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">play_circle</span>
              Tự động mở trình duyệt
            </p>
            <ol className="list-decimal list-inside space-y-1 text-text-muted">
              <li>Nhấn "Start Capture" để mở <strong>arena.ai</strong></li>
              <li>Đăng nhập vào tài khoản Arena AI của bạn</li>
              <li>Hệ thống sẽ tự động vượt qua Turnstile và phát hiện cookies</li>
              <li>Nếu không tự động được, dán token thủ công</li>
            </ol>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={handleClose} fullWidth>
              Cancel
            </Button>
            <Button onClick={handleStartCapture} fullWidth>
              Start Capture
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

AutoCaptureTab.propTypes = {
  onSuccess: PropTypes.func,
  onClose: PropTypes.func,
};

/* ── Manual Tab ───────────────────────────────────────────────────── */

function ManualTab({ onSuccess, onClose }) {
  const [token, setToken] = useState("");
  const [cookies, setCookies] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!token.trim()) {
      setError("Vui lòng nhập Arena AI token");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/oauth/arena/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: token.trim(),
          cookies: cookies.trim() || undefined,
          captureMethod: cookies.trim() ? "manual_cookie" : "manual_token",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setToken("");
    setCookies("");
    setError(null);
    setSuccess(false);
    onClose?.();
  };

  return (
    <div className="space-y-4">
      {success ? (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">✅</div>
          <p className="text-lg font-medium text-text-primary">Connected Successfully!</p>
          <p className="text-sm text-text-muted mt-2">Arena AI token saved</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-sm text-text-muted">
              Dán Arena session cookie / JWT token từ{" "}
              <a
                href="https://arena.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                arena.ai
              </a>{" "}
              vào ô bên dưới.
            </p>
            <div className="bg-surface-secondary p-3 rounded-lg text-xs space-y-2">
              <p className="font-medium text-text-primary">Cách lấy token:</p>
              <ol className="list-decimal list-inside space-y-1 text-text-muted">
                <li>Mở arena.ai và đăng nhập</li>
                <li>F12 → Application → Cookies → https://arena.ai</li>
                <li>Sao chép giá trị của <code className="bg-black/10 dark:bg-white/10 px-1 rounded">arena-auth-prod-v1</code></li>
                <li>Hoặc sao chép ghép từ <code className="bg-black/10 dark:bg-white/10 px-1 rounded">.v1.0</code> và <code className="bg-black/10 dark:bg-white/10 px-1 rounded">.v1.1</code></li>
              </ol>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">
              Session / JWT Token
            </label>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="base64-ey..."
              className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono"
              rows={4}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">
              Cookie Header (tùy chọn)
            </label>
            <textarea
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
              placeholder="cf_clearance=...; arena-auth-prod-v1=..."
              className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono"
              rows={3}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-lg">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={handleClose} disabled={loading} fullWidth>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={loading} fullWidth>
              Connect
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

ManualTab.propTypes = {
  onSuccess: PropTypes.func,
  onClose: PropTypes.func,
};

ArenaCaptureModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onSuccess: PropTypes.func,
  onClose: PropTypes.func,
};
