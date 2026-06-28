import React, { useEffect, useState } from "react";
import apiClient from "../../../services/client.js";
import LoadingSpinner from "../../../components/common/LoadingSpinner.js";
import { toast } from "react-toastify";
import { Search, Plus, Trash2, Edit2, RefreshCw, Loader2 } from "lucide-react";

interface Document {
  id: string;
  title: string;
  description: string;
  category_id: string | null;
  slug: string;
  category?: { title: string } | null;
}

interface Category {
  id: string;
  title: string;
}

const DocumentsTab: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ title: "", description: "", category_id: "", slug: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [docsRes, catsRes] = await Promise.all([
        apiClient.get("/api/v1/documents"),
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
    };

    try {
      if (editingDoc) {
        await apiClient.put(`/api/v1/documents/${editingDoc.id}`, payload);
        toast.success("Cập nhật tài liệu thành công!");
        // Reload list to get proper joins
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
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa tài liệu này? Mọi câu hỏi thuộc tài liệu này cũng sẽ bị xóa!")) return;
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
    setFormData({ title: "", description: "", category_id: "", slug: "" });
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
          <Search className="absolute left-3 top-2.5 w-4 h-4" style={{ color: "var(--meta)" }} />
          <input
            type="text"
            placeholder="Tìm kiếm tài liệu..."
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
            Thêm tài liệu
          </button>
          <button
            onClick={fetchInitialData}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg-2)" }}
            className="p-2 rounded-xl hover:bg-[var(--bg-2)] transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid view */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-themed">
            <thead>
              <tr>
                <th>Tên tài liệu</th>
                <th>Danh mục</th>
                <th>Mô tả</th>
                <th style={{ textAlign: "right" }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--meta)" }}>
                    Không tìm thấy tài liệu nào.
                  </td>
                </tr>
              ) : (
                filtered.map((doc) => (
                  <tr key={doc.id}>
                    <td className="font-semibold" style={{ color: "var(--fg)" }}>{doc.title}</td>
                    <td style={{ color: "var(--brand-600)" }}>{doc.category?.title || "Khác"}</td>
                    <td style={{ color: "var(--muted)", maxWidth: "250px" }} className="truncate">
                      {doc.description || "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEditClick(doc)}
                          className="p-1.5 hover:bg-[var(--bg-2)] rounded-lg transition-colors"
                          style={{ color: "var(--fg-2)" }}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 relative animate-scale-in">
            <h3 className="text-base font-bold mb-4" style={{ color: "var(--fg)" }}>
              {editingDoc ? "Cập nhật tài liệu" : "Tạo tài liệu mới"}
            </h3>
            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Tên tài liệu</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Đề cương ôn tập Pháp luật đại cương"
                  value={formData.title}
                  onChange={(e) => {
                    setFormData({ ...formData, title: e.target.value });
                    if (!editingDoc) generateSlug(e.target.value);
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
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Danh mục ôn thi</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)" }}
                  className="w-full px-3 py-2 text-sm rounded-xl outline-none cursor-pointer"
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
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Mô tả ngắn</label>
                <textarea
                  placeholder="Mô tả tóm tắt nội dung tài liệu..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)", height: "80px" }}
                  className="w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500 resize-none"
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

export default DocumentsTab;
