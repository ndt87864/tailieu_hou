"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";

export default function EditProfileModal({ isOpen, onClose, userProfile, onProfileUpdated }) {
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (isOpen) {
      setFullName(userProfile?.name || "");
      setAvatarUrl(userProfile?.avatar || "");
      setPhone(userProfile?.phone || "");
      setMessage({ type: "", text: "" });
    }
  }, [isOpen, userProfile]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await fetch("http://localhost:3001/api/v1/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          full_name: fullName.trim(),
          avatar_url: avatarUrl.trim(),
          phone: phone.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Không thể cập nhật hồ sơ");
      }

      // Update localStorage cache
      const cachedStr = localStorage.getItem("user-profile");
      let cached = {};
      if (cachedStr) {
        try { cached = JSON.parse(cachedStr); } catch {}
      }
      cached.full_name = fullName.trim();
      cached.avatar_url = avatarUrl.trim();
      cached.phone = phone.trim();
      localStorage.setItem("user-profile", JSON.stringify(cached));

      setMessage({ type: "success", text: "Cập nhật thông tin cá nhân thành công!" });
      if (onProfileUpdated) onProfileUpdated();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Đã xảy ra lỗi khi lưu thông tin" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-2xl p-6 bg-surface border border-border shadow-2xl text-text-main animate-scale-in z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-brand-600 text-[22px]">person</span>
            <div>
              <h2 className="font-bold text-sm md:text-base text-text-main">Trang cá nhân</h2>
              <p className="text-[11px] text-text-muted">Chỉnh sửa thông tin tài khoản HOU</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {message.text && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs font-medium ${
              message.type === "success"
                ? "bg-green-500/10 text-green-600 border border-green-500/20"
                : "bg-red-500/10 text-red-600 border border-red-500/20"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-4 text-xs">
          {/* Avatar Preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-border/50">
            <div className="w-12 h-12 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center text-sm shadow-sm overflow-hidden shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                fullName ? fullName.charAt(0).toUpperCase() : "U"
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-text-main truncate">{fullName || "Người dùng HOU"}</p>
              <p className="text-[10px] text-text-muted truncate">{userProfile?.email}</p>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1">
              Họ và tên
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập họ và tên..."
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs text-text-main focus:outline-none focus:border-brand-500"
              required
            />
          </div>

          {/* Avatar URL */}
          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1">
              Đường dẫn ảnh đại diện (Avatar URL)
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs text-text-main focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1">
              Số điện thoại
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912345678"
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs text-text-main focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 mt-6 border-t border-border/60 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface-2 hover:bg-surface-3 text-text-main transition-colors"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md transition-colors disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
}

EditProfileModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  userProfile: PropTypes.object,
  onProfileUpdated: PropTypes.func,
};
