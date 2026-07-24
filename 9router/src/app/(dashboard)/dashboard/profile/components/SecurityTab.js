"use client";

import { Card, Button, Toggle, Input } from "@/shared/components";
import { cn } from "@/shared/utils/cn";

export default function SecurityTab({
  settings,
  loading,
  updateRequireLogin,
  passwords,
  setPasswords,
  handlePasswordChange,
  passLoading,
  passStatus,
  oidcForm,
  updateOidcForm,
  oidcClientSecret,
  setOidcClientSecret,
  oidcExpanded,
  setOidcExpanded,
  saveOidcSettings,
  testOidcConnection,
  oidcLoading,
  oidcTestLoading,
  oidcStatus,
  oidcTestStatus,
  oidcRedirectUri,
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Security */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            <span className="material-symbols-outlined text-[20px]">shield</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold">Khóa bảo mật & Mật khẩu</h3>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm sm:text-base text-text-main">Xác thực đăng nhập Bảng điều khiển</p>
              <p className="text-xs sm:text-sm text-text-muted mt-0.5">
                Bật tùy chọn này để yêu cầu nhập mật khẩu khi truy cập Bảng điều khiển. Khi tắt, mọi người truy cập không cần xác thực.
              </p>
            </div>
            <Toggle
              checked={settings.requireLogin === true}
              onChange={() => updateRequireLogin(!settings.requireLogin)}
              disabled={loading}
            />
          </div>

          {settings.requireLogin === true && (
            <form onSubmit={handlePasswordChange} className="flex flex-col gap-4 pt-4 border-t border-border/50">
              {settings.hasPassword && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs sm:text-sm font-semibold">Mật khẩu hiện tại</label>
                  <Input
                    type="password"
                    placeholder="Nhập mật khẩu đang sử dụng"
                    value={passwords.current}
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                    required
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs sm:text-sm font-semibold">Mật khẩu mới</label>
                  <Input
                    type="password"
                    placeholder="Nhập mật khẩu mới"
                    value={passwords.new}
                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs sm:text-sm font-semibold">Xác nhận mật khẩu mới</label>
                  <Input
                    type="password"
                    placeholder="Nhập lại mật khẩu mới"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    required
                  />
                </div>
              </div>

              {passStatus.message && (
                <p className={`text-xs sm:text-sm font-medium ${passStatus.type === "error" ? "text-red-500" : "text-green-500"}`}>
                  {passStatus.message}
                </p>
              )}

              <div className="pt-2">
                <Button type="submit" variant="primary" loading={passLoading} className="w-full sm:w-auto font-semibold">
                  {settings.hasPassword ? "Lưu mật khẩu mới" : "Thiết lập mật khẩu"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Card>

      {/* OIDC */}
      <Card>
        <button
          type="button"
          onClick={() => setOidcExpanded((v) => !v)}
          className="w-full flex items-center gap-3 text-left"
        >
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 shrink-0">
            <span className="material-symbols-outlined text-[20px]">lock_open</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-text-main">Đăng nhập tập trung SSO (OIDC)</h3>
            <p className="text-xs text-text-muted mt-0.5">
              {settings.authMode === "oidc"
                ? "Đang bắt buộc đăng nhập qua SSO (OIDC)"
                : settings.authMode === "both"
                  ? "Cho phép Đăng nhập Mật khẩu nội bộ & SSO"
                  : "Kết nối SSO tùy chọn qua Authentik / Keycloak / Google"}
            </p>
          </div>
          <span className="material-symbols-outlined text-text-muted shrink-0">
            {oidcExpanded ? "expand_less" : "expand_more"}
          </span>
        </button>

        {oidcExpanded && (
          <div className="flex flex-col gap-4 mt-4 pt-4 border-t border-border/50">
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              Cho phép tài nguyên kết nối với hệ thống đăng nhập tập trung doanh nghiệp (Authentik, Keycloak, Okta, Google). Lưu ý: Truy cập API gọi mô hình AI vẫn xác thực độc lập bằng API Key.
            </p>

            <div className="flex flex-col gap-2">
              <label className="font-semibold text-sm sm:text-base text-text-main">Phương thức xác thực</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    value: "password",
                    title: "Mật khẩu nội bộ",
                    desc: "Chỉ cho phép đăng nhập bằng mật khẩu hệ thống.",
                  },
                  {
                    value: "oidc",
                    title: "Chế độ SSO (OIDC)",
                    desc: "Bắt buộc đăng nhập qua dịch vụ SSO.",
                  },
                  {
                    value: "both",
                    title: "Song song (Cả hai)",
                    desc: "Cho phép dùng mật khẩu hoặc tài khoản SSO.",
                  },
                ].map((option) => {
                  const active = oidcForm.authMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateOidcForm("authMode", option.value)}
                      className={cn(
                        "text-left rounded-xl border p-3.5 transition-all duration-200",
                        active
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-bg hover:bg-black/5 dark:hover:bg-white/5"
                      )}
                      disabled={loading || oidcLoading}
                    >
                      <p className="font-bold text-sm sm:text-base text-text-main">{option.title}</p>
                      <p className="text-xs text-text-muted mt-1 leading-normal">{option.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-sm sm:text-base text-text-main">Địa chỉ nhận diện (Issuer URL)</label>
                <Input
                  placeholder="https://auth.domain.com/application/o/9router/"
                  value={oidcForm.oidcIssuerUrl}
                  onChange={(e) => updateOidcForm("oidcIssuerUrl", e.target.value)}
                  disabled={loading || oidcLoading}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-semibold text-sm sm:text-base text-text-main">Mã định danh (Client ID)</label>
                <Input
                  placeholder="9router-dashboard"
                  value={oidcForm.oidcClientId}
                  onChange={(e) => updateOidcForm("oidcClientId", e.target.value)}
                  disabled={loading || oidcLoading}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-semibold text-sm sm:text-base text-text-main">Khóa bí mật (Client Secret)</label>
                <Input
                  type="password"
                  placeholder="Để trống nếu muốn giữ nguyên khóa bí mật đã lưu"
                  value={oidcClientSecret}
                  onChange={(e) => setOidcClientSecret(e.target.value)}
                  disabled={loading || oidcLoading}
                />
                <p className="text-xs text-text-muted">Giá trị này được bảo mật và tự động ẩn sau khi lưu thành công.</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-semibold text-sm sm:text-base text-text-main">Phạm vi cấp quyền (Scopes)</label>
                <Input
                  placeholder="openid profile email"
                  value={oidcForm.oidcScopes}
                  onChange={(e) => updateOidcForm("oidcScopes", e.target.value)}
                  disabled={loading || oidcLoading}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-semibold text-sm sm:text-base text-text-main">Tên nút đăng nhập SSO</label>
                <Input
                  placeholder="Đăng nhập bằng tài khoản SSO"
                  value={oidcForm.oidcLoginLabel}
                  onChange={(e) => updateOidcForm("oidcLoginLabel", e.target.value)}
                  disabled={loading || oidcLoading}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-bg p-3.5 text-xs sm:text-sm text-text-muted">
              <p className="font-semibold text-text-main mb-1">Đường dẫn nhận Callback (Redirect URI)</p>
              <code className="block break-all font-mono select-all bg-black/5 dark:bg-white/5 p-2 rounded-lg border border-border/50 text-xs mt-1">{oidcRedirectUri}</code>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/50">
              <Button type="button" variant="primary" loading={oidcLoading} onClick={() => saveOidcSettings()} className="w-full sm:w-auto font-semibold">
                Lưu cấu hình SSO
              </Button>
              <Button type="button" variant="outline" loading={oidcTestLoading} onClick={testOidcConnection} className="w-full sm:w-auto font-medium">
                Kiểm tra kết nối SSO
              </Button>
            </div>

            {oidcTestStatus.message && (
              <p className={`text-xs sm:text-sm font-medium ${oidcTestStatus.type === "error" ? "text-red-500" : "text-green-500"}`}>
                {oidcTestStatus.message}
              </p>
            )}

            {oidcStatus.message && (
              <p className={`text-xs sm:text-sm font-medium ${oidcStatus.type === "error" ? "text-red-500" : "text-green-500"}`}>
                {oidcStatus.message}
              </p>
            )}

            {settings.authMode === "oidc" && (
              <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-medium">
                Hệ thống đang bắt buộc đăng nhập qua SSO. Chức năng đăng nhập bằng mật khẩu nội bộ tạm thời đóng.
              </p>
            )}

            {settings.authMode === "both" && (
              <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-medium">
                Đang mở song song 2 phương thức đăng nhập: Mật khẩu nội bộ & SSO.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
