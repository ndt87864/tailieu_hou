import React, { useEffect, useState } from "react";
import apiClient from "../../services/client.js";
import { toast } from "react-toastify";
import { Save, Loader2, RefreshCw, Link2, Link2Off } from "lucide-react";
import { useUI } from "../../context/UIContext.js";

interface RoleConfig {
  ratio_percent: number;
  excel_ratio_unpaid: number;
  excel_ratio_paid: number;
}

export const QuestionRatioTab: React.FC = () => {
  const [ratios, setRatios] = useState<Record<"free" | "plus" | "pro", RoleConfig>>({
    free: { ratio_percent: 20, excel_ratio_unpaid: 0, excel_ratio_paid: 0 },
    plus: { ratio_percent: 50, excel_ratio_unpaid: 50, excel_ratio_paid: 100 },
    pro: { ratio_percent: 70, excel_ratio_unpaid: 100, excel_ratio_paid: 100 },
  });
  
  // Track synchronization state per role
  const [syncMap, setSyncMap] = useState<Record<"free" | "plus" | "pro", boolean>>({
    free: true,
    plus: false,
    pro: true,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const { setPageLoading } = useUI();

  const fetchRatios = async () => {
    setPageLoading(true);
    try {
      const response = await apiClient.get("/api/v1/admin/question-ratios");
      const fetchedRatios = response.data?.ratios;
      if (Array.isArray(fetchedRatios)) {
        const newRatios = { ...ratios };
        fetchedRatios.forEach((item: any) => {
          if (item.role in newRatios) {
            newRatios[item.role as "free" | "plus" | "pro"] = {
              ratio_percent: item.ratio_percent,
              excel_ratio_unpaid: item.excel_ratio_unpaid !== undefined 
                ? item.excel_ratio_unpaid 
                : (item.excel_ratio_percent !== undefined ? item.excel_ratio_percent : (item.role === "plus" ? 50 : (item.role === "free" ? 0 : 100))),
              excel_ratio_paid: item.excel_ratio_paid !== undefined 
                ? item.excel_ratio_paid 
                : (item.excel_ratio_percent !== undefined ? item.excel_ratio_percent : (item.role === "free" ? 0 : 100)),
            };
          }
        });
        setRatios(newRatios);
        
        // Sync states initially based on whether values are already identical
        setSyncMap({
          free: newRatios.free.excel_ratio_unpaid === newRatios.free.excel_ratio_paid,
          plus: newRatios.plus.excel_ratio_unpaid === newRatios.plus.excel_ratio_paid,
          pro: newRatios.pro.excel_ratio_unpaid === newRatios.pro.excel_ratio_paid,
        });
      }
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể tải cấu hình tỷ lệ câu hỏi!");
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchRatios();
  }, []);

  const handleSliderChange = (role: "free" | "plus" | "pro", field: keyof RoleConfig, value: number) => {
    setRatios((prev) => {
      const updatedConfig = { ...prev[role], [field]: value };
      
      // If sync is active, keep unpaid and paid identical
      if (syncMap[role]) {
        if (field === "excel_ratio_unpaid") {
          updatedConfig.excel_ratio_paid = value;
        } else if (field === "excel_ratio_paid") {
          updatedConfig.excel_ratio_unpaid = value;
        }
      }
      
      return {
        ...prev,
        [role]: updatedConfig,
      };
    });
  };

  const handleInputChange = (role: "free" | "plus" | "pro", field: keyof RoleConfig, value: string) => {
    let num = parseInt(value, 10);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 100) num = 100;
    
    setRatios((prev) => {
      const updatedConfig = { ...prev[role], [field]: num };
      
      // If sync is active, keep unpaid and paid identical
      if (syncMap[role]) {
        if (field === "excel_ratio_unpaid") {
          updatedConfig.excel_ratio_paid = num;
        } else if (field === "excel_ratio_paid") {
          updatedConfig.excel_ratio_unpaid = num;
        }
      }
      
      return {
        ...prev,
        [role]: updatedConfig,
      };
    });
  };

  const handleToggleSync = (role: "free" | "plus" | "pro") => {
    setSyncMap((prev) => {
      const nextSync = !prev[role];
      if (nextSync) {
        // Synchronize paid percentage to unpaid percentage immediately when activated
        setRatios((rPrev) => ({
          ...rPrev,
          [role]: {
            ...rPrev[role],
            excel_ratio_paid: rPrev[role].excel_ratio_unpaid,
          },
        }));
      }
      return {
        ...prev,
        [role]: nextSync,
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = Object.entries(ratios).map(([role, config]) => ({
        role,
        ratio_percent: config.ratio_percent,
        excel_ratio_unpaid: config.excel_ratio_unpaid,
        excel_ratio_paid: config.excel_ratio_paid,
      }));
      await apiClient.post("/api/v1/admin/question-ratios", { ratios: payload });
      toast.success("Cập nhật cấu hình tỷ lệ thành công!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Không thể lưu cấu hình tỷ lệ!");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const renderRoleSection = (roleKey: "free" | "plus" | "pro", title: string, desc: string) => {
    const config = ratios[roleKey];
    const isSynced = syncMap[roleKey];
    return (
      <div className="ratio-slider-group border-b border-[var(--border-soft)] pb-6 last:border-b-0 last:pb-0">
        <div className="ratio-slider-header mb-4 flex justify-between items-start">
          <div>
            <div className="ratio-role-title text-sm font-bold text-fg">{title}</div>
            <div className="ratio-role-desc text-xs text-muted mt-0.5">{desc}</div>
          </div>
          {roleKey !== "free" && (
            <button
              onClick={() => handleToggleSync(roleKey)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition shadow-sm ${
                isSynced 
                  ? "bg-brand-50 border-brand-200 text-brand-600 hover:bg-brand-100" 
                  : "bg-[var(--surface-muted)] border-[var(--border-soft)] text-[var(--muted)] hover:bg-[var(--bg-3)]"
              }`}
              title={isSynced ? "Bật tùy chỉnh riêng lẻ" : "Đồng bộ hóa tỷ lệ Đã mua & Chưa mua"}
            >
              {isSynced ? <Link2 className="w-3.5 h-3.5 text-brand-500" /> : <Link2Off className="w-3.5 h-3.5" />}
              <span>{isSynced ? "Đang đồng bộ Excel" : "Chỉnh Excel riêng lẻ"}</span>
            </button>
          )}
        </div>
        
        <div className="space-y-4 pl-2 border-l-2 border-brand-500/20">
          {/* Question Limit Slider */}
          <div>
            <div className="text-xs font-semibold text-fg mb-1">Tỷ lệ hiển thị câu hỏi (Chưa đăng ký):</div>
            <div className="ratio-controls flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={config.ratio_percent}
                onChange={(e) => handleSliderChange(roleKey, "ratio_percent", parseInt(e.target.value, 10))}
                className="ratio-slider-input flex-1"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={config.ratio_percent}
                onChange={(e) => handleInputChange(roleKey, "ratio_percent", e.target.value)}
                className="ratio-number-input w-16 text-center"
              />
              <span className="text-sm font-semibold text-fg w-8">%</span>
            </div>
          </div>

          {/* Excel Download Slider (Unpaid) */}
          <div>
            <div className="text-xs font-semibold text-fg mb-1">
              {roleKey === "free" ? "Tỷ lệ tải file Excel mặc định:" : "Tỷ lệ tải Excel khi CHƯA đăng ký mua:"}
            </div>
            <div className="ratio-controls flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={config.excel_ratio_unpaid}
                onChange={(e) => handleSliderChange(roleKey, "excel_ratio_unpaid", parseInt(e.target.value, 10))}
                className="ratio-slider-input flex-1"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={config.excel_ratio_unpaid}
                onChange={(e) => handleInputChange(roleKey, "excel_ratio_unpaid", e.target.value)}
                className="ratio-number-input w-16 text-center"
              />
              <span className="text-sm font-semibold text-fg w-8">%</span>
            </div>
          </div>

          {/* Excel Download Slider (Paid - Only for Plus/Pro) */}
          {roleKey !== "free" && !isSynced && (
            <div className="animate-fade-in">
              <div className="text-xs font-semibold text-fg mb-1">Tỷ lệ tải Excel khi ĐÃ đăng ký mua:</div>
              <div className="ratio-controls flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={config.excel_ratio_paid}
                  onChange={(e) => handleSliderChange(roleKey, "excel_ratio_paid", parseInt(e.target.value, 10))}
                  className="ratio-slider-input flex-1"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={config.excel_ratio_paid}
                  onChange={(e) => handleInputChange(roleKey, "excel_ratio_paid", e.target.value)}
                  className="ratio-number-input w-16 text-center"
                />
                <span className="text-sm font-semibold text-fg w-8">%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="ratio-config-container space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="modal-heading text-base font-bold">Cấu hình tỷ lệ câu hỏi & tải Excel</h3>
        <button
          onClick={fetchRatios}
          disabled={saving}
          className="p-2 text-muted hover:text-fg rounded-full hover:bg-[var(--bg-2)] transition"
          title="Tải lại"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="ratio-config-card bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-6 space-y-6">
        {renderRoleSection(
          "free",
          "Tài khoản Free (Mặc định)",
          "Tỷ lệ hiển thị và tải Excel cho khách hoặc tài khoản miễn phí."
        )}

        {renderRoleSection(
          "plus",
          "Tài khoản Plus",
          "Cấu hình tỉ lệ tải Excel cho tài liệu đã đăng ký mua lẻ và tài liệu chưa đăng ký."
        )}

        {renderRoleSection(
          "pro",
          "Tài khoản Pro",
          "Cấu hình tỉ lệ tải Excel cho môn học đã đăng ký trọn gói và môn học chưa đăng ký."
        )}

        {/* Action Button */}
        <div className="ratio-btn-container pt-4 border-t border-[var(--border-soft)]">
          <button
            onClick={handleSave}
            disabled={saving}
            className="ratio-btn-save flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50"
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
