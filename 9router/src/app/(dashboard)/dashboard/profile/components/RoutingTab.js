"use client";

import { Card, Toggle, Input } from "@/shared/components";

export default function RoutingTab({
  settings,
  loading,
  updateFallbackStrategy,
  updateStickyLimit,
  updateComboStrategy,
  updateComboStickyLimit,
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
            <span className="material-symbols-outlined text-[20px]">route</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold">Cấu hình định tuyến & Phân tải AI</h3>
        </div>
        <div className="flex flex-col gap-4">
          {/* Round Robin */}
          <div className="flex items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm sm:text-base text-text-main">Xoay vòng tài khoản (Round Robin)</p>
              <p className="text-xs sm:text-sm text-text-muted mt-0.5">
                Tự động luân chuyển các tài khoản AI để cân bằng tải và hạn chế chạm trần Rate Limit.
              </p>
            </div>
            <Toggle
              checked={settings.fallbackStrategy === "round-robin"}
              onChange={() => updateFallbackStrategy(settings.fallbackStrategy === "round-robin" ? "fill-first" : "round-robin")}
              disabled={loading}
            />
          </div>

          {/* Sticky Round Robin Limit */}
          {settings.fallbackStrategy === "round-robin" && (
            <div className="flex items-start sm:items-center justify-between gap-4 pt-2 border-t border-border/50">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm sm:text-base text-text-main">Số lượt gọi liên tiếp (Sticky Limit)</p>
                <p className="text-xs sm:text-sm text-text-muted mt-0.5">
                  Số truy vấn tối đa gửi đến 1 tài khoản trước khi chuyển sang tài khoản kế tiếp.
                </p>
              </div>
              <Input
                type="number"
                min="1"
                max="10"
                value={settings.stickyRoundRobinLimit || 3}
                onChange={(e) => updateStickyLimit(e.target.value)}
                disabled={loading}
                className="w-16 sm:w-20 text-center shrink-0 font-semibold"
              />
            </div>
          )}

          {/* Combo Round Robin */}
          <div className="flex items-start sm:items-center justify-between gap-4 pt-4 border-t border-border/50">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm sm:text-base text-text-main">Xoay vòng mô hình Combo (Combo Round Robin)</p>
              <p className="text-xs sm:text-sm text-text-muted mt-0.5">
                Luân phiên các nhà cung cấp trong combo thay vì luôn ưu tiên mô hình đầu tiên.
              </p>
            </div>
            <Toggle
              checked={settings.comboStrategy === "round-robin"}
              onChange={() => updateComboStrategy(settings.comboStrategy === "round-robin" ? "fallback" : "round-robin")}
              disabled={loading}
            />
          </div>

          {/* Combo Sticky Round Robin Limit */}
          {settings.comboStrategy === "round-robin" && (
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div>
                <p className="font-semibold text-sm sm:text-base text-text-main">Số lượt gọi mô hình Combo (Combo Sticky Limit)</p>
                <p className="text-xs sm:text-sm text-text-muted mt-0.5">
                  Số truy vấn tối đa cho mỗi mô hình trong Combo trước khi chuyển dòng.
                </p>
              </div>
              <Input
                type="number"
                min="1"
                max="100"
                value={settings.comboStickyRoundRobinLimit || 1}
                onChange={(e) => updateComboStickyLimit(e.target.value)}
                disabled={loading}
                className="w-20 text-center font-semibold"
              />
            </div>
          )}

          <p className="text-xs text-text-muted italic pt-3 border-t border-border/50 leading-relaxed">
            {settings.fallbackStrategy === "round-robin"
              ? `Hệ thống đang phân bổ đều lưu lượng qua các tài khoản (${settings.stickyRoundRobinLimit || 3} lượt gọi/tài khoản).`
              : "Hệ thống đang gọi tài khoản theo thứ tự ưu tiên ưu tiên hàng đầu (Fill First)."}
            {settings.comboStrategy === "round-robin"
              ? ` Mô hình Combo được xoay vòng sau mỗi ${settings.comboStickyRoundRobinLimit || 1} lượt gọi.`
              : " Mô hình Combo luôn bắt đầu bằng nhà cung cấp mặc định."}
          </p>
        </div>
      </Card>
    </div>
  );
}
