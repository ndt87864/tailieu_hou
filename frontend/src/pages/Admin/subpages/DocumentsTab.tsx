import React, { useEffect, useState } from "react";
import apiClient from "../../../services/client.js";
import LoadingSpinner from "../../../components/common/LoadingSpinner.js";
import { toast } from "react-toastify";
import { Search, Plus, Trash2, Edit2, RefreshCw, Loader2, Eye, EyeOff, Crown } from "lucide-react";
import { useConfirm } from "../../../context/ConfirmContext.js";

interface Document {
  id: string;
  title: string;
  description: string;
  category_id: string | null;
  slug: string;
  active: boolean;
  premium: boolean;
  category?: { title: string } | null;
}

interface Category {
  id: string;
  title: string;
}

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  colorClass?: string;
}> = ({ checked, onChange, label, colorClass = "bg-brand-600" }) => (
  <label className="flex items-center gap-2 cursor-pointer select-none">
    <div
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
        checked ? colorClass : "bg-[var(--border)]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </div>
    <span className="text-xs text-[var(--fg-2)]">{label}</span>
  </label>
);

const DocumentsTab: React.FC = () => {
  const confirm = useConfirm();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category_id: "",
    slug: "",
    active: true,
    premium: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [docsRes, catsRes] = await Promise.all([
        apiClient.get("/api/v1/admin/documents"),
        apiClient.get("/api/v1/admin/categories"),
      ]);
      setDocuments(docsRes.data.documents || []);
      setCategories(catsRes.data.categories || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách dữ liệu.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      title: formData.title,
      description: formData.description,
      category_id: formData.category_id || null,
      slug: formData.slug || undefined,
      active: formData.active,
      premium: formData.premium,
    };

    try {
      if (editingDoc) {
        await apiClient.put(`/api/v1/admin/documents/${editingDoc.id}`, payload);
        toast.success("Cập nhật tài liệu thành công!");
        fetchInitialData();
      } else {
        await apiClient.post("/api/v1/documents", payload);
        toast.success("Tạo tài liệu mới thành công!");
        fetchInitialData();
      }
      closeForm();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Lưu thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (doc: Document) => {
    setEditingDoc(doc);
    setFormData({
      title: doc.title,
      description: doc.description || "",
      category_id: doc.category_id || "",
      slug: doc.slug || "",
      active: doc.active !== false,
      premium: doc.premium === true,
    });
    setShowModal(true);
  };

  const handleQuickToggle = async (doc: Document, field: "active" | "premium", value: boolean) => {
    setTogglingId(doc.id + field);
    try {
      const res = await apiClient.patch(`/api/v1/admin/documents/${doc.id}`, { [field]: value });
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, ...res.data.document } : d)));
      toast.success(
        field === "active"
          ? value ? "Đã bật hiển thị tài liệu." : "Đã ẩn tài liệu."
          : value ? "Đã bật chế độ Premium." : "Đã tắt chế độ Premium."
      );
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Cập nhật thất bại.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm("Bạn có chắc chắn muốn xóa tài liệu này? Mọi câu hỏi thuộc tài liệu này cũng sẽ bị xóa!");
    if (!isConfirmed) return;
    try {
      await apiClient.delete(`/api/v1/documents/${id}`);
      toast.success("Xóa tài liệu thành công!");
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Xóa thất bại.");
    }
  };

  const closeForm = () => {
    setEditingDoc(null);
    setFormData({ title: "", description: "", category_id: "", slug: "", active: true, premium: false });
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

  const filtered = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.category?.title || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 input-search-icon" />
          <input
            type="text"
            placeholder="Tìm kiếm tài liệu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-themed w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thêm tài liệu
          </button>
          <button
            onClick={fetchInitialData}
            className="btn-secondary p-2 rounded-xl hover:bg-[var(--bg-2)] transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table view - Desktop View */}
      <div className="card overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="table-themed">
            <thead>
              <tr>
                <th>Tên tài liệu</th>
                <th>Danh mục</th>
                <th>Mô tả</th>
                <th className="text-center">Hiển thị</th>
                <th className="text-center">Premium</th>
                <th className="th-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="td-empty">
                    Không tìm thấy tài liệu nào.
                  </td>
                </tr>
              ) : (
                filtered.map((doc) => (
                  <tr key={doc.id} className={!doc.active ? "opacity-50" : ""}>
                    <td className="font-semibold">
                      <div className="flex items-center gap-1.5">
                        {doc.title}
                        {doc.premium && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      </div>
                    </td>
                    <td className="td-brand">{doc.category?.title || "Khác"}</td>
                    <td className="td-truncate truncate">{doc.description || "—"}</td>
                    <td className="text-center">
                      <button
                        disabled={togglingId === doc.id + "active"}
                        onClick={() => handleQuickToggle(doc, "active", !doc.active)}
                        title={doc.active ? "Đang hiển thị — nhấn để ẩn" : "Đang ẩn — nhấn để hiện"}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                          doc.active
                            ? "text-emerald-500 hover:bg-emerald-500/10"
                            : "text-[var(--muted)] hover:bg-[var(--bg-2)]"
                        }`}
                      >
                        {doc.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="text-center">
                      <button
                        disabled={togglingId === doc.id + "premium"}
                        onClick={() => handleQuickToggle(doc, "premium", !doc.premium)}
                        title={doc.premium ? "Premium — nhấn để tắt" : "Miễn phí — nhấn để bật Premium"}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                          doc.premium
                            ? "text-amber-500 hover:bg-amber-500/10"
                            : "text-[var(--muted)] hover:bg-[var(--bg-2)]"
                        }`}
                      >
                        <Crown className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="td-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEditClick(doc)}
                          className="btn-icon-edit p-1.5 hover:bg-[var(--bg-2)] rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Documents List - Mobile View */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filtered.length === 0 ? (
          <div className="card p-6 text-center text-sm text-[var(--fg-2)]">
            Không tìm thấy tài liệu nào.
          </div>
        ) : (
          filtered.map((doc) => (
            <div key={doc.id} className={`admin-mobile-card ${!doc.active ? "opacity-60" : ""}`}>
              <div className="admin-mobile-card-header">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                    <span>{doc.title}</span>
                    {doc.premium && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  </div>
                  <div className="text-xs text-[var(--brand-600)] font-medium mt-1">
                    Danh mục: {doc.category?.title || "Khác"}
                  </div>
                </div>
              </div>

              <div className="admin-mobile-card-body">
                <p className="text-xs text-[var(--fg-2)] line-clamp-2 italic mb-1">
                  {doc.description || "Chưa có mô tả."}
                </p>
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Hiển thị (Active):</span>
                  <button
                    disabled={togglingId === doc.id + "active"}
                    onClick={() => handleQuickToggle(doc, "active", !doc.active)}
                    className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                      doc.active
                        ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                        : "text-[var(--muted)] bg-[var(--bg-2)] border-[var(--border)]"
                    }`}
                  >
                    {doc.active ? "Đang hiện" : "Đang ẩn"}
                  </button>
                </div>
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Premium:</span>
                  <button
                    disabled={togglingId === doc.id + "premium"}
                    onClick={() => handleQuickToggle(doc, "premium", !doc.premium)}
                    className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                      doc.premium
                        ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
                        : "text-[var(--muted)] bg-[var(--bg-2)] border-[var(--border)]"
                    }`}
                  >
                    {doc.premium ? "Yêu cầu Premium" : "Miễn phí"}
                  </button>
                </div>
              </div>

              <div className="admin-mobile-card-footer">
                <button
                  onClick={() => handleEditClick(doc)}
                  className="px-3 py-1.5 bg-[var(--surface-2)] text-[var(--fg)] border border-[var(--border)] rounded-lg text-xs font-medium hover:bg-[var(--bg-2)] transition-colors flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Chỉnh sửa
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors flex items-center gap-1 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Xóa
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 relative animate-scale-in">
            <h3 className="modal-heading text-base font-bold mb-4">
              {editingDoc ? "Cập nhật tài liệu" : "Tạo tài liệu mới"}
            </h3>
            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
              <div>
                <label className="form-label block text-xs font-semibold mb-1">Tên tài liệu</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Đề cương ôn tập Pháp luật đại cương"
                  value={formData.title}
                  onChange={(e) => {
                    setFormData({ ...formData, title: e.target.value });
                    if (!editingDoc) generateSlug(e.target.value);
                  }}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="form-label block text-xs font-semibold mb-1">Đường dẫn tĩnh (Slug)</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="form-label block text-xs font-semibold mb-1">Danh mục ôn thi</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none cursor-pointer"
                >
                  <option value="">-- Chọn danh mục --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label block text-xs font-semibold mb-1">Mô tả ngắn</label>
                <textarea
                  placeholder="Mô tả tóm tắt nội dung tài liệu..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="textarea-description w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500 resize-none"
                />
              </div>

              {/* Active & Premium toggles */}
              <div className="flex items-center gap-6 p-3 rounded-xl bg-[var(--bg-2)] border border-[var(--border)]">
                <ToggleSwitch
                  checked={formData.active}
                  onChange={(val) => setFormData({ ...formData, active: val })}
                  label="Hiển thị (Active)"
                  colorClass="bg-emerald-500"
                />
                <ToggleSwitch
                  checked={formData.premium}
                  onChange={(val) => setFormData({ ...formData, premium: val })}
                  label="Chỉ Premium"
                  colorClass="bg-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="btn-cancel px-4 py-2 text-sm font-medium rounded-xl hover:opacity-90"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
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

export default DocumentsTab;
