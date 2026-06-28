import React, { useEffect, useState } from "react";
import apiClient from "../../../services/client.js";
import { toast } from "react-toastify";
import { Save, Loader2, RefreshCw } from "lucide-react";


export const QuestionRatioTab: React.FC = () => {
  const [ratios, setRatios] = useState<{ free: number; plus: number; pro: number }>({
    free: 20,
    plus: 50,
    pro: 70,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const fetchRatios = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get("/api/v1/admin/question-ratios");
      const fetchedRatios = response.data?.ratios;
      if (Array.isArray(fetchedRatios)) {
        const newRatios = { ...ratios };
        fetchedRatios.forEach((item: any) => {
          if (item.role in newRatios) {
            newRatios[item.role as keyof typeof ratios] = item.ratio_percent;
          }
        });
        setRatios(newRatios);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể tải cấu hình tỷ lệ câu hỏi!");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRatios();
  }, []);

  const handleSliderChange = (role: "free" | "plus" | "pro", value: number) => {
    setRatios((prev) => ({
      ...prev,
      [role]: value,
    }));
  };

  const handleInputChange = (role: "free" | "plus" | "pro", value: string) => {
    let num = parseInt(value, 10);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 100) num = 100;
    setRatios((prev) => ({
      ...prev,
      [role]: num,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = Object.entries(ratios).map(([role, ratio_percent]) => ({
        role,
        ratio_percent,
      }));
      await apiClient.post("/api/v1/admin/question-ratios", { ratios: payload });
      toast.success("Cập nhật tỷ lệ câu hỏi thành công!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Không thể lưu cấu hình tỷ lệ câu hỏi!");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#008037] mb-2" />
        <span className="text-xs text-muted-foreground">Đang tải cấu hình...</span>
      </div>
    );
  }

  return (
    <div className="ratio-config-container space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="modal-heading text-base font-bold">Cấu hình tỷ lệ hiển thị câu hỏi</h3>
        <button
          onClick={fetchRatios}
          disabled={saving}
          className="p-2 text-muted hover:text-fg rounded-full hover:bg-[var(--bg-2)] transition"
          title="Tải lại"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="ratio-config-card">
        {/* Free Group */}
        <div className="ratio-slider-group">
          <div className="ratio-slider-header">
            <div>
              <div className="ratio-role-title">Tài khoản Free (Mặc định)</div>
              <div className="ratio-role-desc">Tỷ lệ số câu hỏi được phép xem của tài khoản khách hoặc tài khoản miễn phí.</div>
            </div>
          </div>
          <div className="ratio-controls">
            <input
              type="range"
              min="0"
              max="100"
              value={ratios.free}
              onChange={(e) => handleSliderChange("free", parseInt(e.target.value, 10))}
              className="ratio-slider-input"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={ratios.free}
              onChange={(e) => handleInputChange("free", e.target.value)}
              className="ratio-number-input"
            />
            <span className="text-sm font-semibold text-fg w-8">%</span>
          </div>
        </div>

        {/* Plus Group */}
        <div className="ratio-slider-group">
          <div className="ratio-slider-header">
            <div>
              <div className="ratio-role-title">Tài khoản Plus</div>
              <div className="ratio-role-desc">Áp dụng đối với các tài liệu CHƯA đăng ký mua lẻ. (Tài liệu đã đăng ký mặc định hiển thị 100%).</div>
            </div>
          </div>
          <div className="ratio-controls">
            <input
              type="range"
              min="0"
              max="100"
              value={ratios.plus}
              onChange={(e) => handleSliderChange("plus", parseInt(e.target.value, 10))}
              className="ratio-slider-input"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={ratios.plus}
              onChange={(e) => handleInputChange("plus", e.target.value)}
              className="ratio-number-input"
            />
            <span className="text-sm font-semibold text-fg w-8">%</span>
          </div>
        </div>

        {/* Pro Group */}
        <div className="ratio-slider-group">
          <div className="ratio-slider-header">
            <div>
              <div className="ratio-role-title">Tài khoản Pro</div>
              <div className="ratio-role-desc">Áp dụng đối với các danh mục môn học CHƯA đăng ký. (Danh mục môn đã đăng ký mặc định hiển thị 100%).</div>
            </div>
          </div>
          <div className="ratio-controls">
            <input
              type="range"
              min="0"
              max="100"
              value={ratios.pro}
              onChange={(e) => handleSliderChange("pro", parseInt(e.target.value, 10))}
              className="ratio-slider-input"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={ratios.pro}
              onChange={(e) => handleInputChange("pro", e.target.value)}
              className="ratio-number-input"
            />
            <span className="text-sm font-semibold text-fg w-8">%</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="ratio-btn-container">
          <button
            onClick={handleSave}
            disabled={saving}
            className="ratio-btn-save flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Lưu cấu hình
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
