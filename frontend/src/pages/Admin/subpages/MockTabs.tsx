import React, { useState, useEffect } from "react";
import { Plus, Calendar, Lock, X, Loader2, Trash2, Leaf, Zap, Crown, Gem, Star, Heart, Gift, Award, Shield, Flame, Rocket, Sparkles } from "lucide-react";
import apiClient from "../../../services/client.js";
import { toast } from "react-toastify";
import { useConfirm } from "../../../context/ConfirmContext.js";

// 1. Quản lý phòng thi (Rooms)
export const RoomsTab: React.FC = () => {
  const [rooms] = useState([
    { id: 1, name: "Phòng thi trực tuyến Zoom 01", capacity: 40, status: "active" },
    { id: 2, name: "Phòng thi trực tuyến Zoom 02", capacity: 40, status: "active" },
    { id: 3, name: "Phòng thi trực tuyến Google Meet 01", capacity: 50, status: "active" },
    { id: 4, name: "Phòng thi Tự do 05", capacity: 100, status: "inactive" },
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="modal-heading text-base font-bold">Quản lý phòng thi</h3>
        <button className="btn-brand text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Thêm phòng</button>
      </div>
      <div className="card overflow-hidden">
        <table className="table-themed">
          <thead>
            <tr>
              <th>Tên phòng thi</th>
              <th>Sức chứa</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id}>
                <td className="font-medium user-name">{r.name}</td>
                <td className="td-fg2">{r.capacity} sinh viên</td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                    {r.status === "active" ? "HOẠT ĐỘNG" : "KHÓA"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 2. Quản lý ca thi (Sessions)
export const SessionsTab: React.FC = () => {
  const [sessions] = useState([
    { id: 1, code: "C1", time: "07:30 - 09:30", note: "Ca thi sáng" },
    { id: 2, code: "C2", time: "09:45 - 11:45", note: "Ca thi sáng muộn" },
    { id: 3, code: "C3", time: "13:30 - 15:30", note: "Ca thi chiều" },
    { id: 4, code: "C4", time: "15:45 - 17:45", note: "Ca thi chiều muộn" },
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="modal-heading text-base font-bold">Quản lý ca thi</h3>
        <button className="btn-brand text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Thêm ca thi</button>
      </div>
      <div className="card overflow-hidden">
        <table className="table-themed">
          <thead>
            <tr>
              <th>Mã ca thi</th>
              <th>Khung giờ</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold mock-session-code">{s.code}</td>
                <td className="mock-session-time">{s.time}</td>
                <td className="mock-session-note">{s.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface PricingPackage {
  id: string;
  name: string;
  price: string;
  savings: string;
  icon: string;
  features: string[];
  display_order: number;
}

// 3. Quản lý giá môn học (Pricing)
const iconOptions = [
  { value: "free", label: "Lá cây", component: Leaf },
  { value: "plus", label: "Tia sét", component: Zap },
  { value: "pro", label: "Vương miện", component: Crown },
  { value: "ultra", label: "Kim cương", component: Gem },
  { value: "star", label: "Ngôi sao", component: Star },
  { value: "heart", label: "Trái tim", component: Heart },
  { value: "gift", label: "Hộp quà", component: Gift },
  { value: "award", label: "Cúp / Giải thưởng", component: Award },
  { value: "shield", label: "Khiên bảo vệ", component: Shield },
  { value: "flame", label: "Ngọn lửa", component: Flame },
  { value: "rocket", label: "Tên lửa", component: Rocket },
  { value: "sparkles", label: "Lấp lánh", component: Sparkles },
];
export const PricingTab: React.FC = () => {
  const confirm = useConfirm();
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPkg, setEditingPkg] = useState<PricingPackage | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [savings, setSavings] = useState("");
  const [icon, setIcon] = useState("free");
  const [featuresText, setFeaturesText] = useState("");
  const [displayOrder, setDisplayOrder] = useState(1);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/v1/pricing-packages/admin");
      setPackages(res.data.packages || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể tải danh sách gói dịch vụ.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const openCreateModal = () => {
    setEditingPkg(null);
    setName("");
    setPrice("");
    setSavings("");
    setIcon("free");
    setFeaturesText("");
    setDisplayOrder(packages.length + 1);
    setShowModal(true);
  };

  const openEditModal = (pkg: PricingPackage) => {
    setEditingPkg(pkg);
    setName(pkg.name);
    setPrice(pkg.price);
    setSavings(pkg.savings || "");
    setIcon(pkg.icon || "free");
    setFeaturesText(Array.isArray(pkg.features) ? pkg.features.join("\n") : "");
    setDisplayOrder(pkg.display_order || 1);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm("Bạn có chắc chắn muốn xóa gói dịch vụ này?");
    if (!isConfirmed) return;
    try {
      await apiClient.delete(`/api/v1/pricing-packages/admin/${id}`);
      toast.success("Xóa gói dịch vụ thành công!");
      fetchPackages();
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi xóa gói dịch vụ.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) {
      toast.error("Vui lòng điền đầy đủ Tên gói và Giá.");
      return;
    }
    setSubmitting(true);
    try {
      const features = featuresText
        .split("\n")
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      const payload = {
        name,
        price,
        savings,
        icon,
        features,
        display_order: displayOrder,
      };

      if (editingPkg) {
        await apiClient.put(`/api/v1/pricing-packages/admin/${editingPkg.id}`, payload);
        toast.success("Cập nhật gói thành công!");
      } else {
        await apiClient.post("/api/v1/pricing-packages/admin", payload);
        toast.success("Thêm gói mới thành công!");
      }
      setShowModal(false);
      fetchPackages();
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi lưu thông tin gói.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="modal-heading text-base font-bold">Quản lý giá &amp; Gói dịch vụ</h3>
        <button
          onClick={openCreateModal}
          className="btn-brand text-xs flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Thêm gói mới
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {packages.map((p) => {
            const matchedIcon = iconOptions.find((opt) => opt.value === p.icon);
            const IconComponent = matchedIcon ? matchedIcon.component : Sparkles;
            return (
              <div key={p.id} className="card p-5 space-y-3 relative overflow-hidden border-t-4 border-t-emerald-500 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm card-title">{p.name}</h4>
                    <IconComponent className="w-5 h-5 text-emerald-500 shrink-0" />
                  </div>
                  <div className="text-2xl font-black text-emerald-600">{p.price}</div>
                  <p className="text-xs mock-pricing-note">{p.savings}</p>
                  <div className="mt-2 space-y-1">
                    <span className="text-[10px] font-bold text-muted block uppercase">Tính năng:</span>
                    {p.features && p.features.map((f, idx) => (
                      <div key={idx} className="text-[11px] text-[var(--fg-2)] flex items-start gap-1">
                        <span className="text-emerald-500">•</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => openEditModal(p)}
                    className="mock-pricing-btn flex-1 py-2 text-xs font-semibold rounded-xl hover:opacity-85"
                  >
                    Chỉnh sửa gói
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-2 border border-red-500/25 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors"
                    title="Xóa gói"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
              <h3 className="modal-heading text-base font-bold">
                {editingPkg ? "Chỉnh sửa Gói dịch vụ" : "Thêm Gói dịch vụ mới"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                    Tên gói
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                    Giá hiển thị
                  </label>
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                    placeholder="VD: 99.000đ"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                  Mô tả / Tiết kiệm (savings)
                </label>
                <input
                  type="text"
                  value={savings}
                  onChange={(e) => setSavings(e.target.value)}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                  placeholder="VD: Phù hợp ôn tập nhanh (30 ngày)"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                    Biểu tượng (icon)
                  </label>
                  <div className="grid grid-cols-6 gap-2 p-2 border border-[var(--border)] rounded-xl bg-[var(--surface-2)]">
                    {iconOptions.map((opt) => {
                      const IconComponent = opt.component;
                      const isSelected = icon === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setIcon(opt.value)}
                          title={opt.label}
                          className={`p-2 rounded-lg flex items-center justify-center border transition-all ${
                            isSelected
                              ? "bg-emerald-500/10 border-emerald-500 text-emerald-500 scale-105"
                              : "border-transparent text-[var(--fg-2)] hover:bg-[var(--bg-2)]"
                          }`}
                        >
                          <IconComponent className="w-5 h-5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                    Thứ tự hiển thị
                  </label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10))}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                  Danh sách tính năng (Mỗi dòng một tính năng)
                </label>
                <textarea
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none min-h-[120px] resize-y"
                  placeholder="Nhập mỗi tính năng trên một dòng..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-[var(--border)] hover:bg-[var(--bg-2)] text-[var(--fg-2)]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:opacity-90 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingPkg ? "Lưu thay đổi" : "Thêm mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// 4. Quản lý lịch (Reminders)
export const RemindersTab: React.FC = () => {
  return (
    <div className="card p-6 flex flex-col items-center justify-center text-center space-y-4">
      <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl"><Calendar className="w-8 h-8" /></div>
      <div className="max-w-sm space-y-1">
        <h4 className="font-bold text-sm mock-tab-title">Lịch nhắc ôn thi tự động</h4>
        <p className="mock-session-note">Tự động nhắc nhở ôn luyện cho sinh viên 2 ngày trước ca thi chính thức qua email và hệ thống.</p>
      </div>
      <button className="btn-brand text-xs">Cấu hình thông báo</button>
    </div>
  );
};

// 5. Quản lý tài khoản cao cấp (Premium)
export const PremiumTab: React.FC = () => {
  return (
    <div className="card p-6 flex flex-col items-center justify-center text-center space-y-4">
      <div className="p-3 bg-purple-500/10 text-purple-500 rounded-2xl"><Lock className="w-8 h-8" /></div>
      <div className="max-w-sm space-y-1">
        <h4 className="font-bold text-sm mock-tab-title">Quản lý Đặc quyền Premium</h4>
        <p className="mock-session-note">Cấu hình số câu hỏi tối đa được xem miễn phí, giá nâng cấp tài khoản VIP và các quyền lợi đi kèm.</p>
      </div>
      <div className="flex gap-4 text-xs font-semibold border-t mock-premium-border pt-4 w-full justify-around mt-4">
        <div>Quyền Free: <span className="text-amber-500">10 câu/ngày</span></div>
        <div>Quyền Plus: <span className="text-purple-500">100 câu/ngày</span></div>
        <div>Quyền Pro: <span className="text-emerald-500">Không giới hạn</span></div>
      </div>
    </div>
  );
};

// 6. Quản lý footer (Footer)
export const FooterTab: React.FC = () => {
  const [footerText, setFooterText] = useState("© 2026 — Nền tảng ôn thi trực tuyến đại học HOU chất lượng cao");

  return (
    <div className="space-y-4">
      <h3 className="modal-heading text-base font-bold">Cấu hình thông tin Footer</h3>
      <div className="card p-5 space-y-4">
        <div>
          <label className="form-label block text-xs font-semibold mb-1">Bản quyền chân trang</label>
          <input
            type="text"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
          />
        </div>
        <button className="btn-brand text-xs">Lưu thay đổi</button>
      </div>
    </div>
  );
};




// 9. Quản lý đăng ký môn (Proxy Registrations)
export const ProxyTab: React.FC = () => {
  return (
    <div className="space-y-4">
      <h3 className="modal-heading text-base font-bold">Quản lý Đăng ký môn hộ</h3>
      <div className="card p-6 text-center text-xs mock-proxy-empty">
        Không có yêu cầu đăng ký môn học hộ nào đang chờ duyệt.
      </div>
    </div>
  );
};
