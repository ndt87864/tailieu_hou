import React, { useEffect, useState } from "react";
import apiClient from "../../../services/client.js";
import LoadingSpinner from "../../../components/common/LoadingSpinner.js";
import { toast } from "react-toastify";
import * as Icons from "lucide-react";

const { Search, Plus, Trash2, Edit2, RefreshCw, Loader2 } = Icons;

const PRESET_ICONS = [
  { name: "GraduationCap", label: "Mũ tốt nghiệp (NEU, Học phần chuyên ngành)" },
  { name: "Book", label: "Sách đóng (Giáo trình, Tài liệu chung)" },
  { name: "BookOpen", label: "Sách mở (Bài giảng, Tài liệu học tập, Môn đại cương)" },
  { name: "PenTool", label: "Bút vẽ (Thực hành, Vẽ, Thiết kế, Kỹ năng)" },
  { name: "FileText", label: "Văn bản (Đề cương, Tiểu luận, Tài liệu đọc)" },
  { name: "File", label: "Tệp tin (Tài liệu chung)" },
  { name: "Code", label: "Lập trình (Công nghệ thông tin, Tin học)" },
  { name: "Calculator", label: "Máy tính (Kế toán, Kiểm toán, Toán học)" },
  { name: "Scale", label: "Cán cân (Luật, Pháp lý, Luật kinh tế)" },
  { name: "Landmark", label: "Tòa nhà cổ kính (Ngân hàng, Tài chính, Viện học)" },
  { name: "Coins", label: "Đồng xu (Tài chính, Ngân hàng, Tiền tệ)" },
  { name: "TrendingUp", label: "Biểu đồ đi lên (Kinh tế, Quản trị, Đầu tư)" },
  { name: "School", label: "Ngôi trường (Đại học, NEU, Trường học)" },
  { name: "Briefcase", label: "Cặp tài liệu (Quản trị kinh doanh, Kinh tế, Khởi nghiệp)" },
  { name: "Database", label: "Cơ sở dữ liệu (Hệ thống thông tin, Lưu trữ)" },
  { name: "Globe", label: "Quả địa cầu (Tiếng Anh, Ngoại ngữ, Du lịch)" },
  { name: "Award", label: "Huy hiệu (Thành tích, Chứng chỉ, Đồ án xuất sắc)" },
  { name: "Brain", label: "Não bộ (Triết học, Logic, Tư duy, Tâm lý)" },
  { name: "Cpu", label: "Chip xử lý (Kỹ thuật điện tử, Công nghệ, AI)" },
  { name: "Heart", label: "Trái tim (Y học, Sức khỏe, Tâm lý, Xã hội)" },
  { name: "Shield", label: "Khiên bảo vệ (Bảo mật, Luật, An toàn)" },
  { name: "Music", label: "Nốt nhạc (Nghệ thuật, Âm nhạc)" },
  { name: "Layers", label: "Lớp chồng (Tổng hợp, Khác, Kiến trúc)" },
  { name: "Folder", label: "Thư mục (Tổng hợp tài liệu)" }
];

const renderCategoryIcon = (logo: string | null, title: string, className = "w-5 h-5") => {
  if (!logo) {
    return <span className="text-sm font-semibold">{title.slice(0, 2).toUpperCase()}</span>;
  }
  const IconComponent = (Icons as any)[logo];
  if (IconComponent) {
    return <IconComponent className={className} />;
  }
  return <span className="text-lg leading-none">{logo}</span>;
};

interface Category {
  id: string;
  title: string;
  slug: string;
  logo: string | null;
  stt: number;
}

const CategoriesTab: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ title: "", slug: "", logo: "", stt: 0 });
  const [submitting, setSubmitting] = useState(false);

  const fetchCategories = () => {
    setLoading(true);
    apiClient
      .get("/api/v1/admin/categories")
      .then((res) => {
        setCategories(res.data.categories || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Không thể tải danh sách danh mục.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingCat) {
        const res = await apiClient.put(`/api/v1/admin/categories/${editingCat.id}`, formData);
        toast.success("Cập nhật danh mục thành công!");
        setCategories((prev) => prev.map((c) => (c.id === editingCat.id ? res.data.category : c)));
      } else {
        const res = await apiClient.post("/api/v1/admin/categories", formData);
        toast.success("Tạo danh mục mới thành công!");
        setCategories((prev) => [...prev, res.data.category]);
      }
      closeForm();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Lưu thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (cat: Category) => {
    setEditingCat(cat);
    setFormData({ title: cat.title, slug: cat.slug || "", logo: cat.logo || "", stt: cat.stt });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa danh mục này? Tài liệu thuộc danh mục sẽ không có danh mục.")) return;
    try {
      await apiClient.delete(`/api/v1/admin/categories/${id}`);
      toast.success("Xóa danh mục thành công!");
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Xóa thất bại.");
    }
  };

  const closeForm = () => {
    setEditingCat(null);
    setFormData({ title: "", slug: "", logo: "", stt: 0 });
    setShowModal(false);
  };

  const generateSlug = (val: string) => {
    const slug = val
      .toLowerCase()
      .replace(/á|à|ả|ã|ạ|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ/g, "a")
      .replace(/é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ/g, "e")
      .replace(/i|í|ì|ỉ|ĩ|ị/g, "i")
      .replace(/ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ/g, "o")
      .replace(/ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự/g, "u")
      .replace(/ý|ỳ|ỷ|ỹ|ỵ/g, "y")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9 -]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    setFormData((prev) => ({ ...prev, slug }));
  };

  const filtered = categories.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4" style={{ color: "var(--meta)" }} />
          <input
            type="text"
            placeholder="Tìm kiếm danh mục..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowModal(true)}
            style={{ background: "var(--brand-600)", color: "#fff" }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thêm danh mục
          </button>
          <button
            onClick={fetchCategories}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg-2)" }}
            className="p-2 rounded-xl hover:bg-[var(--bg-2)] transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid view */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((cat) => (
          <div key={cat.id} className="card p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-semibold shrink-0">
                {renderCategoryIcon(cat.logo, cat.title, "w-5 h-5")}
              </div>
              <div>
                <h4 className="font-semibold text-sm" style={{ color: "var(--fg)" }}>{cat.title}</h4>
                <p style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                  Thứ tự: {cat.stt} | Slug: {cat.slug}
                </p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => handleEditClick(cat)}
                className="p-1.5 hover:bg-[var(--bg-2)] rounded-lg transition-colors"
                style={{ color: "var(--fg-2)" }}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(cat.id)}
                className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 relative animate-scale-in">
            <h3 className="text-base font-bold mb-4" style={{ color: "var(--fg)" }}>
              {editingCat ? "Cập nhật danh mục" : "Tạo danh mục mới"}
            </h3>
            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Tên danh mục</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Tiếng Anh chuyên ngành"
                  value={formData.title}
                  onChange={(e) => {
                    setFormData({ ...formData, title: e.target.value });
                    if (!editingCat) generateSlug(e.target.value);
                  }}
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                  className="w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Đường dẫn tĩnh (Slug)</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                  className="w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Biểu tượng (Lucide Icon hoặc Emoji)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Tên Lucide Icon hoặc Emoji"
                    value={formData.logo}
                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                    style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                    className="flex-1 px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
                  />
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0 border border-indigo-500/20">
                    {renderCategoryIcon(formData.logo, formData.title || "DM", "w-5 h-5")}
                  </div>
                </div>
                
                {/* Previews grid of common icons */}
                <div className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-2)] max-h-32 overflow-y-auto">
                  <div className="text-[10px] font-bold text-[var(--muted)] mb-1.5 px-1 uppercase tracking-wider">Danh sách gợi ý</div>
                  <div className="grid grid-cols-6 gap-1">
                    {PRESET_ICONS.map((item) => {
                      const IconComp = (Icons as any)[item.name];
                      const isSelected = formData.logo === item.name;
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => setFormData({ ...formData, logo: item.name })}
                          title={item.label}
                          className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${
                            isSelected 
                              ? "bg-indigo-600 text-white" 
                              : "hover:bg-[var(--surface)] text-[var(--fg-2)]"
                          }`}
                        >
                          {IconComp ? <IconComp className="w-4 h-4" /> : item.name.slice(0, 2)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Thứ tự sắp xếp (STT)</label>
                <input
                  type="number"
                  required
                  value={formData.stt}
                  onChange={(e) => setFormData({ ...formData, stt: parseInt(e.target.value, 10) || 0 })}
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                  className="w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  style={{ background: "var(--bg-2)", color: "var(--fg-2)" }}
                  className="px-4 py-2 text-sm font-medium rounded-xl hover:opacity-90"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ background: "var(--brand-600)", color: "#fff" }}
                  className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    "Lưu lại"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesTab;
