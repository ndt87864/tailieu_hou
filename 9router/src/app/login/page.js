"use client";

import { useState, useEffect } from "react";
import { Card, Button, Input } from "@/shared/components";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetHint, setResetHint] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState(null);
  const [authMode, setAuthMode] = useState("password");
  const [oidcConfigured, setOidcConfigured] = useState(false);
  const [oidcLoginLabel, setOidcLoginLabel] = useState("Sign in with OIDC");
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Countdown for rate-limit
  useEffect(() => {
    if (retryAfter <= 0) return;
    const id = setInterval(() => setRetryAfter((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [retryAfter]);

  useEffect(() => {
    async function checkAuth() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

      try {
        const res = await fetch(`${baseUrl}/api/auth/status`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.requireLogin === false) {
            window.location.assign("/dashboard");
            return;
          }
          setHasPassword(!!data.hasPassword);
          setAuthMode(data.authMode || "password");
          setOidcConfigured(data.oidcConfigured === true);
          setOidcLoginLabel(data.oidcLoginLabel || "Sign in with OIDC");
        } else {
          // Safe fallback on non-OK response to avoid infinite loading state.
          setHasPassword(true);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        setHasPassword(true);
      }
    }
    checkAuth();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResetHint("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.mustChangePassword) {
          setMustChange(true);
          return;
        }
        window.location.assign("/dashboard");
      } else {
        const data = await res.json();
        setError(data.error || "Invalid password");
        if (data.resetHint) setResetHint(data.resetHint);
        if (data.retryAfter) setRetryAfter(Number(data.retryAfter));
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Force a new password before entering the dashboard (default + remote).
  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: password, newPassword }),
      });
      if (res.ok) {
        window.location.assign("/dashboard");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to set password");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isGoogleLogin = oidcLoginLabel === "Đăng nhập bằng Google";

  const handleOidcLogin = () => {
    window.location.href = "/api/auth/oidc/start";
  };

  const oidcAvailable = oidcConfigured && ["oidc", "both"].includes(authMode);
  const passwordAvailable = authMode !== "oidc" || !oidcConfigured;

  // Show loading state while checking password
  if (hasPassword === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-text-muted mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4 relative overflow-hidden">
      {/* Faint grid background */}
      <div className="landing-grid absolute inset-0 pointer-events-none" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">9Router</h1>
          <p className="text-text-muted">
            {authMode === "oidc" && oidcConfigured
              ? "Đăng nhập để truy cập Dashboard"
              : "Nhập mật khẩu để truy cập Dashboard"}
          </p>
        </div>

        <Card>
          {mustChange ? (
            <form onSubmit={handleSetNewPassword} className="flex flex-col gap-4">
              <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                Set a new password before accessing the dashboard remotely.
              </p>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">New password</label>
                <Input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
              </div>
              <Button type="submit" variant="primary" className="w-full" loading={loading} disabled={!newPassword}>
                Set password
              </Button>
            </form>
          ) : (
          <div className="flex flex-col gap-4">
            {oidcAvailable && (
              isGoogleLogin ? (
                <button
                  type="button"
                  onClick={handleOidcLogin}
                  className="flex items-center justify-center gap-3 w-full px-4 py-2.5 rounded-lg border border-border bg-white dark:bg-surface text-gray-700 dark:text-gray-200 font-medium text-sm hover:bg-gray-50 dark:hover:bg-surface/80 transition-colors shadow-sm"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Đăng nhập bằng Google
                </button>
              ) : (
                <Button type="button" variant="primary" className="w-full" onClick={handleOidcLogin}>
                  {oidcLoginLabel}
                </Button>
              )
            )}

            {oidcAvailable && passwordAvailable && <div className="h-px bg-border/60" />}

            {passwordAvailable ? (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                {((authMode === "oidc" && !oidcConfigured) || (authMode === "both" && !oidcConfigured)) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                    OIDC login is enabled, but the issuer/client fields are not configured yet. Password login is still available for recovery.
                  </p>
                )}

                {authMode === "both" && oidcConfigured && (
                  <p className="text-xs text-text-muted text-center">
                    Password and OIDC login are both enabled.
                  </p>
                )}

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Email / Tên đăng nhập (HOU / 9Router)</label>
                    <Input
                      type="text"
                      placeholder="admin@hou.edu.vn hoặc admin"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus={!oidcAvailable}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Mật khẩu</label>
                    <Input
                      type="password"
                      placeholder="Nhập mật khẩu"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                  {retryAfter > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Locked. Retry in <span className="font-mono">{retryAfter}s</span>.
                    </p>
                  )}
                  {resetHint && (
                    <p className="text-xs text-text-muted">
                      Forgot password? Open <code className="bg-sidebar px-1 rounded">9router</code> CLI on the host → <b>Settings</b> → <b>Reset Password to Default</b>.
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-2"
                  loading={loading}
                  disabled={retryAfter > 0}
                >
                  {retryAfter > 0 ? `Wait ${retryAfter}s` : "Đăng nhập"}
                </Button>

                <p className="text-xs text-center text-text-muted mt-2">
                  Đăng nhập bằng tài khoản <b>Admin</b> hoặc <b>Management</b> của TaiLieu HOU. (Mật khẩu mặc định 9Router nội bộ: <code className="bg-sidebar px-1 rounded">123456</code>)
                </p>
                {hasPassword === false && (
                  <p className="text-xs text-center text-amber-600 dark:text-amber-400">
                    Security risk: no password set. You will be asked to set one when logging in remotely.
                  </p>
                )}
              </form>
            ) : (
              error && <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
          )}
        </Card>
      </div>
    </div>
  );
}
