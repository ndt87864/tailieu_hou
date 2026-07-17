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
 * Luna Proxy Capture Modal
 * 
 * Two modes:
 * - Tự động (Auto): Uses Puppeteer on the server to open a desktop browser, navigate to
 *   chat.qwen.ai, and capture the JWT token from localStorage/cookies.
 * - Thủ công (Manual): Paste the JWT token manually.
 */
export default function LunaCaptureModal({ isOpen, onSuccess, onClose }) {
  const [tab, setTab] = useState("auto");

  // Reset state when modal opens
  const [modalKey, setModalKey] = useState(0);
  useEffect(() => {
    if (isOpen) setModalKey((k) => k + 1);
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Luna Proxy — Qwen AI Token">
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
  const [waitingMessage, setWaitingMessage] = useState("⏳ Đang kết nối tới chat.qwen.ai...");

  const handleStartCapture = async () => {
    setLoading(true);
    setError(null);
    setStep("waiting");

    // Server-side capture (Puppeteer/CDP) will open the matching desktop browser.
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3min timeout

      setWaitingMessage("⏳ Đang khởi động trình duyệt đăng nhập...");
      const browserHint = await detectBrowserHint();

      const res = await fetch("/api/oauth/luna/capture-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeout: 180000, browserHint }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        if (data.needsPuppeteer) {
          // Puppeteer not installed → fall back to manual paste
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
        // Timed out → fall back to manual paste
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
      setError("Vui lòng dán JWT token từ chat.qwen.ai");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/oauth/luna/save", {
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
          <p className="text-sm text-text-muted mt-2">Qwen AI token đã được lưu</p>
        </div>
      ) : step === "waiting" ? (
        <div className="space-y-4">
          {/* Spinner + message */}
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
                Một cửa sổ trình duyệt mới đã được mở. Vui lòng đăng nhập vào Qwen AI trên cửa sổ đó.
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
          {/* Opened tab confirmation */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-primary text-lg mt-0.5">open_in_new</span>
              <div>
                <p className="font-medium text-text-primary">Đã mở chat.qwen.ai trong tab mới</p>
                <p className="text-text-muted mt-1">
                  Nếu tab không tự động mở,{' '}
                  <button
                    onClick={() => window.open("https://chat.qwen.ai", "_blank")}
                    className="text-primary hover:underline"
                  >
                    bấm vào đây
                  </button>
                </p>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-surface-secondary p-3 rounded-lg text-xs space-y-2">
            <p className="font-medium text-text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">info</span>
              Sau khi đăng nhập, lấy token như sau:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-text-muted">
              <li>Đăng nhập vào tài khoản Qwen AI của bạn</li>
              <li>Mở DevTools (F12) → Application → Local Storage</li>
              <li>Tìm key <code className="bg-black/10 dark:bg-white/10 px-1 rounded">token</code> và copy giá trị của nó</li>
              <li>Tùy chọn: copy request <code className="bg-black/10 dark:bg-white/10 px-1 rounded">Cookie</code> header trong tab Network</li>
              <li>Dán token/cookie vào ô bên dưới và bấm Connect</li>
              <li>Có thể dùng extension local để tự động điền JWT và Cookie Header</li>
            </ol>
          </div>

          {!error && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs">
              <p className="flex items-start gap-1.5 text-amber-300">
                <span className="material-symbols-outlined text-[14px] mt-0.5">info</span>
                <span>
                  Auto capture chỉ hoạt động khi server chạy trên máy có trình duyệt desktop. Nếu chạy local/self-hosted, cần cài Puppeteer:
                  <code className="block mt-1 bg-black/20 px-2 py-1 rounded font-mono">npm install puppeteer</code>
                </span>
              </p>
            </div>
          )}

          {/* Token input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">
              JWT Token
            </label>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOiJSUzI1NiIs..."
              data-luna-jwt-input="true"
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
              placeholder="x-ap=ap-southeast-1; qwen-locale=en-US; token=..."
              data-luna-cookie-input="true"
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
            <Button onClick={handleSubmit} loading={loading} fullWidth data-luna-connect-button="true">
              Connect
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Initial instructions */}
          <div className="bg-surface-secondary p-3 rounded-lg text-xs space-y-2">
            <p className="font-medium text-text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">play_circle</span>
              Tự động mở trình duyệt
            </p>
            <ol className="list-decimal list-inside space-y-1 text-text-muted">
              <li>Nhấn "Start Capture" để mở <strong>chat.qwen.ai</strong></li>
              <li>Đăng nhập vào tài khoản Qwen AI của bạn</li>
              <li>Hệ thống sẽ tự động phát hiện JWT token</li>
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
      setError("Please paste your Qwen AI JWT token");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/oauth/luna/save", {
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
          <p className="text-sm text-text-muted mt-2">Qwen AI token saved</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-sm text-text-muted">
              Paste your Qwen AI JWT token from{" "}
              <a
                href="https://chat.qwen.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                chat.qwen.ai
              </a>{" "}
              browser localStorage. Cookie is optional but recommended.
            </p>
            <div className="bg-surface-secondary p-3 rounded-lg text-xs space-y-2">
              <p className="font-medium text-text-primary">How to get token:</p>
              <ol className="list-decimal list-inside space-y-1 text-text-muted">
                <li>Open chat.qwen.ai in your browser</li>
                <li>Log in to your Qwen AI account</li>
                <li>Open DevTools (F12) → Application → Local Storage</li>
                <li>Find key <code className="bg-black/10 dark:bg-white/10 px-1 rounded">token</code> and copy its value</li>
                <li>Optional: copy the request <code className="bg-black/10 dark:bg-white/10 px-1 rounded">Cookie</code> header from Network</li>
                <li>Paste the token and cookie below</li>
              </ol>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">
              JWT Token
            </label>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOiJSUzI1NiIs..."
              data-luna-jwt-input="true"
              className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono"
              rows={4}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">
              Cookie Header (optional)
            </label>
            <textarea
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
              placeholder="x-ap=ap-southeast-1; qwen-locale=en-US; token=..."
              data-luna-cookie-input="true"
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
            <Button onClick={handleSubmit} loading={loading} fullWidth data-luna-connect-button="true">
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

/* ── PropTypes ────────────────────────────────────────────────────── */

LunaCaptureModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onSuccess: PropTypes.func,
  onClose: PropTypes.func,
};
