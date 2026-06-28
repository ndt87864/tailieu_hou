import React, { useState, useEffect } from "react";
import { X, User, Loader2, Phone, Lock } from "lucide-react";
import { useAuth, supabase } from "../../context/AuthContext.js";
import apiClient from "../../services/client.js";
import { toast } from "react-toastify";
import "../../css/modal.css";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [changePassword, setChangePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && profile) {
      setFullName(profile.full_name || "");
      setAvatarUrl(profile.avatar_url || "");
      setPhone(profile.phone || "");
      setChangePassword(false);
      setPassword("");
      setConfirmPassword("");
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (changePassword) {
      if (!password) {
        toast.error("Vui lòng nhập mật khẩu mới");
        setSaving(false);
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Mật khẩu xác nhận không khớp");
        setSaving(false);
        return;
      }
      if (password.length < 6) {
        toast.error("Mật khẩu phải từ 6 ký tự trở lên");
        setSaving(false);
        return;
      }
    }

    try {
      // Cập nhật thông tin profile
      await apiClient.put("/api/v1/auth/profile", {
        full_name: fullName.trim(),
        avatar_url: avatarUrl.trim(),
        phone: phone.trim(),
      });

      // Cập nhật mật khẩu nếu được chọn
      if (changePassword) {
        const { error: authError } = await supabase.auth.updateUser({
          password: password,
        });
        if (authError) {
          throw new Error(authError.message);
        }
      }

      await refreshProfile();
      toast.success("Cập nhật thông tin cá nhân thành công!");
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || err.response?.data?.error || "Đã xảy ra lỗi khi cập nhật profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm transition-opacity duration-300 modal-backdrop"
        onClick={onClose}
      />

      {/* Modal */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-2xl p-6 animate-scale-in modal-container"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="modal-title">
              Chỉnh sửa hồ sơ
            </h2>
            <p className="modal-subtitle">
              Thay đổi thông tin hiển thị của bạn
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-[var(--bg-2)] transition-colors modal-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Avatar */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <div
            className="w-20 h-20 rounded-full border-2 overflow-hidden flex items-center justify-center bg-[var(--bg-2)] shadow-inner modal-avatar-preview"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(fullName || "default")}`;
                }}
              />
            ) : (
              <User className="w-10 h-10 text-[var(--muted)]" />
            )}
          </div>
          <span className="modal-avatar-label">Ảnh đại diện</span>
        </div>

        {/* Inputs */}
        <div className="space-y-4 mb-6">
          {/* Email (Read-only) */}
          <div>
            <label className="modal-form-label">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ""}
              readOnly
              disabled
              className="w-full px-4 py-2 rounded-xl border text-sm opacity-60 cursor-not-allowed modal-form-input"
            />
          </div>

          {/* Họ và tên */}
          <div>
            <label className="modal-form-label">
              Họ và tên
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập họ tên của bạn"
                required
                className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 modal-form-input"
              />
            </div>
          </div>

          {/* Số điện thoại */}
          <div>
            <label className="modal-form-label">
              Số điện thoại
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                <Phone className="w-4 h-4" />
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Nhập số điện thoại của bạn"
                className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 modal-form-input"
              />
            </div>
          </div>

          {/* Checkbox Đổi mật khẩu */}
          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="changePasswordCheckbox"
              checked={changePassword}
              onChange={(e) => setChangePassword(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <label
              htmlFor="changePasswordCheckbox"
              className="text-sm font-medium cursor-pointer modal-checkbox-label"
            >
              Đổi mật khẩu
            </label>
          </div>

          {/* Password fields when checked */}
          {changePassword && (
            <div className="space-y-4 pt-2 border-t border-[var(--border)]">
              <div>
                <label className="modal-form-label">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới"
                    required={changePassword}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 modal-form-input"
                  />
                </div>
              </div>

              <div>
                <label className="modal-form-label">
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Xác nhận mật khẩu mới"
                    required={changePassword}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 modal-form-input"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors modal-btn-cancel"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-brand px-4 py-2 rounded-xl text-sm font-medium text-white flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              "Lưu thay đổi"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProfileModal;
